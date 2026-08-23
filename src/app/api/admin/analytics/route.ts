import { NextResponse } from "next/server";
import { buildDayRange, clampDays, countByDay, toDayKey } from "@/lib/admin/analytics";
import { countReferralPaidOrders } from "@/lib/admin/referral-funnel";
import { requireAdmin } from "@/lib/auth/admin";
import { assessComicCreatorQuality, assessGameCreatorQuality, assessNovelCreatorQuality } from "@/lib/creator-quality";
import type { CreatorQualityReport, CreatorWorkKind } from "@/lib/creator-workflow";
import { parseGameSpec } from "@/lib/game-spec";
import { prisma } from "@/lib/prisma";
import { summarizeLiteraryEngagementRows } from "@/lib/literary-engagement";

type QualityRow = { kind: CreatorWorkKind; templateId?: string; report: CreatorQualityReport };

function roundScore(total: number, count: number): number | null {
  return count ? Math.round((total / count) * 10) / 10 : null;
}

function summarizeQuality(rows: QualityRow[], kind: CreatorWorkKind) {
  const matching = rows.filter((row) => row.kind === kind);
  const scoreRows = matching.filter((row) => row.report.score !== undefined);
  return {
    kind,
    evaluated: matching.length,
    ready: matching.filter((row) => row.report.verdict === "ready").length,
    needsPolish: matching.filter((row) => row.report.verdict === "needs_polish").length,
    blocked: matching.filter((row) => row.report.verdict === "blocked").length,
    averageScore: roundScore(scoreRows.reduce((sum, row) => sum + (row.report.score ?? 0), 0), scoreRows.length),
  };
}

export async function GET(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const { searchParams } = new URL(req.url);
  const days = clampDays(searchParams.get("days"), 14);
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));

  const dayKeys = buildDayRange(days);
  // Keep the admin overview available during a rolling restart where Prisma
  // Client predates the optional GameplayEvent model.
  const gameplayEventQuery = prisma.gameplayEvent
    ? prisma.gameplayEvent.findMany({
        where: { createdAt: { gte: since } },
        select: { templateId: true, event: true, sessionId: true, elapsedMs: true, won: true, verticalSliceScore: true },
      })
    : Promise.resolve([]);

  const [
    shareRows,
    userRows,
    referralRows,
    gameRows,
    novelRows,
    comicRows,
    byChannel,
    shareTotal,
    referralSignups,
    paidOrders,
    activeSubs,
    quotaByReason,
    providerUsage,
    plans,
    visibilityG,
    visibilityN,
    visibilityC,
    featuredG,
    featuredN,
    featuredC,
    gameplayEvents,
    qualityProjects,
    qualityNovels,
    qualityComics,
    literaryEvents,
  ] = await Promise.all([
    prisma.shareEvent.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.user.findMany({
      where: { referredById: { not: null }, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.project.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.novel.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.comic.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.shareEvent.groupBy({
      by: ["channel"],
      where: { createdAt: { gte: since } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
    prisma.shareEvent.count({ where: { createdAt: { gte: since } } }),
    prisma.user.count({
      where: { referredById: { not: null }, createdAt: { gte: since } },
    }),
    prisma.paymentEvent.findMany({
      where: { status: "paid", paidAt: { gte: since } },
      select: {
        amountCents: true,
        planId: true,
        provider: true,
        paidAt: true,
        // A paid order only belongs in the social funnel when the payer is a
        // referred user. All-platform revenue remains visible separately.
        user: { select: { referredById: true } },
      },
    }),
    prisma.userSubscription.groupBy({
      by: ["planId", "status"],
      _count: { id: true },
    }),
    prisma.quotaLedger.groupBy({
      by: ["reason"],
      where: { createdAt: { gte: since } },
      _count: { id: true },
      _sum: { delta: true },
    }),
    prisma.providerUsageEvent.groupBy({
      by: ["provider", "model", "modality", "status"],
      where: { createdAt: { gte: since } },
      _count: { id: true },
      _sum: { durationMs: true, estimatedCostMicros: true },
      orderBy: { _count: { id: "desc" } },
    }),
    prisma.subscriptionPlan.findMany({ select: { id: true, name: true } }),
    prisma.project.groupBy({ by: ["visibility"], _count: { id: true } }),
    prisma.novel.groupBy({ by: ["visibility"], _count: { id: true } }),
    prisma.comic.groupBy({ by: ["visibility"], _count: { id: true } }),
    prisma.project.count({ where: { featured: true } }),
    prisma.novel.count({ where: { featured: true } }),
    prisma.comic.count({ where: { featured: true } }),
    gameplayEventQuery,
    prisma.project.findMany({
      orderBy: { updatedAt: "desc" },
      take: 200,
      select: { specJson: true },
    }),
    prisma.novel.findMany({
      orderBy: { updatedAt: "desc" },
      take: 200,
      select: { content: true, prompt: true, lengthTier: true },
    }),
    prisma.comic.findMany({
      orderBy: { updatedAt: "desc" },
      take: 200,
      select: { imageUrls: true },
    }),
    prisma.literaryEngagementEvent.findMany({
      where: { createdAt: { gte: since } },
      select: { workType: true, workId: true, sessionId: true, event: true, unitIndex: true },
    }),
  ]);

  const planName = new Map(plans.map((p) => [p.id, p.name]));

  const visibilityTotals = new Map<string, number>();
  for (const row of [...visibilityG, ...visibilityN, ...visibilityC]) {
    visibilityTotals.set(row.visibility, (visibilityTotals.get(row.visibility) ?? 0) + row._count.id);
  }

  const [gameTotal, novelTotal, comicTotal] = await Promise.all([
    prisma.project.count(),
    prisma.novel.count(),
    prisma.comic.count(),
  ]);

  const activeSubscriptionCount = activeSubs
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + s._count.id, 0);

  const planBreakdown = activeSubs
    .filter((s) => s.status === "active")
    .map((s) => ({
      planId: s.planId,
      label: planName.get(s.planId) ?? s.planId,
      count: s._count.id,
    }))
    .sort((a, b) => b.count - a.count);

  const revenueCents = paidOrders.reduce((sum, o) => sum + o.amountCents, 0);
  const referralPaidOrders = countReferralPaidOrders(paidOrders);
  const usageTotal = providerUsage.reduce((sum, row) => sum + row._count.id, 0);
  const usagePriced = providerUsage.reduce((sum, row) => sum + (row._sum.estimatedCostMicros == null ? 0 : row._count.id), 0);
  const providerCostMicros = providerUsage.reduce((sum, row) => sum + (row._sum.estimatedCostMicros ?? 0), 0);

  const conversionRate =
    shareTotal > 0 ? Math.round((referralSignups / shareTotal) * 1000) / 10 : 0;
  const gameplayStarts = gameplayEvents.filter((event) => event.event === "start");
  const startedSessions = new Set(gameplayStarts.map((event) => event.sessionId));
  const firstMinuteSessions = new Set(gameplayEvents.filter((event) => event.event === "first_minute").map((event) => event.sessionId));
  const firstActionSessions = new Set(gameplayEvents.filter((event) => event.event === "first_action").map((event) => event.sessionId));
  const failedEnds = gameplayEvents.filter((event) => event.event === "end" && event.won === false);
  const firstMinuteRate = startedSessions.size ? Math.round((firstMinuteSessions.size / startedSessions.size) * 1000) / 10 : 0;
  const firstActionRate = startedSessions.size ? Math.round((firstActionSessions.size / startedSessions.size) * 1000) / 10 : 0;
  const averageFailureSec = failedEnds.length
    ? Math.round(failedEnds.reduce((sum, event) => sum + (event.elapsedMs ?? 0), 0) / failedEnds.length / 1000)
    : 0;
  const qualityScores = gameplayStarts.map((event) => event.verticalSliceScore).filter((score): score is number => typeof score === "number");
  const averageQualityScore = qualityScores.length ? Math.round(qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length) : 0;
  const gameplayByTemplate = new Map<string, { starts: Set<string>; firstMinute: Set<string>; retries: number }>();
  for (const event of gameplayEvents) {
    const row = gameplayByTemplate.get(event.templateId) ?? { starts: new Set<string>(), firstMinute: new Set<string>(), retries: 0 };
    if (event.event === "start") row.starts.add(event.sessionId);
    if (event.event === "first_minute") row.firstMinute.add(event.sessionId);
    if (event.event === "retry") row.retries += 1;
    gameplayByTemplate.set(event.templateId, row);
  }
  const literaryByWork = summarizeLiteraryEngagementRows(literaryEvents, () => 1);
  const literaryByType = (["novel", "comic"] as const).map((kind) => {
    const summaries = [...literaryByWork.entries()]
      .filter(([key]) => key.startsWith(`${kind}:`))
      .map(([, summary]) => summary);
    const starts = summaries.reduce((sum, summary) => sum + summary.starts, 0);
    const completed = summaries.reduce((sum, summary) => sum + summary.completed, 0);
    return { kind, starts, completed, completionRate: starts ? Math.round((completed / starts) * 1000) / 10 : 0, unitViews: summaries.reduce((sum, summary) => sum + summary.unitViews, 0) };
  });

  // Admin receives aggregates only: no prompt, story text, image URL, owner
  // or work id leaves this route. Bad legacy specs are excluded rather than
  // silently treated as a low-quality score.
  const qualityRows: QualityRow[] = [];
  for (const project of qualityProjects) {
    try {
      const spec = parseGameSpec(JSON.parse(project.specJson));
      qualityRows.push({ kind: "game", templateId: spec.templateId, report: assessGameCreatorQuality(spec).report });
    } catch {
      // Corrupt historical rows belong in the repair queue, not this score denominator.
    }
  }
  for (const novel of qualityNovels) {
    qualityRows.push({
      kind: "novel",
      report: assessNovelCreatorQuality({ content: novel.content, prompt: novel.prompt, lengthTier: novel.lengthTier }).report,
    });
  }
  for (const comic of qualityComics) {
    qualityRows.push({ kind: "comic", report: assessComicCreatorQuality(comic.imageUrls).report });
  }

  const templateQuality = new Map<string, { evaluated: number; ready: number; scoreTotal: number; scoreCount: number }>();
  for (const row of qualityRows) {
    if (row.kind !== "game" || !row.templateId) continue;
    const current = templateQuality.get(row.templateId) ?? { evaluated: 0, ready: 0, scoreTotal: 0, scoreCount: 0 };
    current.evaluated += 1;
    current.ready += row.report.verdict === "ready" ? 1 : 0;
    if (row.report.score !== undefined) {
      current.scoreTotal += row.report.score;
      current.scoreCount += 1;
    }
    templateQuality.set(row.templateId, current);
  }
  const templateIds = new Set([...templateQuality.keys(), ...gameplayByTemplate.keys()]);

  return NextResponse.json({
    days,
    since: toDayKey(since),
    series: {
      shareEvents: countByDay(
        shareRows.map((r) => r.createdAt),
        dayKeys,
      ),
      userSignups: countByDay(
        userRows.map((r) => r.createdAt),
        dayKeys,
      ),
      referralSignups: countByDay(
        referralRows.map((r) => r.createdAt),
        dayKeys,
      ),
      worksCreated: {
        game: countByDay(
          gameRows.map((r) => r.createdAt),
          dayKeys,
        ),
        novel: countByDay(
          novelRows.map((r) => r.createdAt),
          dayKeys,
        ),
        comic: countByDay(
          comicRows.map((r) => r.createdAt),
          dayKeys,
        ),
      },
    },
    product: {
      worksByType: { game: gameTotal, novel: novelTotal, comic: comicTotal },
      visibility: Object.fromEntries(visibilityTotals),
      featured: featuredG + featuredN + featuredC,
    },
    social: {
      shareTotal,
      referralSignups,
      conversionRate,
      channels: byChannel.map((c) => ({
        channel: c.channel,
        count: c._count.id,
      })),
      funnel: [
        { stage: "shareEvents", value: shareTotal },
        { stage: "referralSignups", value: referralSignups },
        { stage: "referralPaidOrders", value: referralPaidOrders },
        { stage: "allPaidOrders", value: paidOrders.length },
      ],
    },
    commerce: {
      paidOrders: paidOrders.length,
      revenueCents,
      activeSubscriptions: activeSubscriptionCount,
      planBreakdown,
      quotaByReason: quotaByReason
        .map((q) => ({
          reason: q.reason,
          events: q._count.id,
          deltaSum: q._sum.delta ?? 0,
        }))
        .sort((a, b) => Math.abs(b.deltaSum) - Math.abs(a.deltaSum)),
      paymentsByDay: countByDay(
        paidOrders.filter((o) => o.paidAt).map((o) => o.paidAt!),
        dayKeys,
      ),
      providerUsage: providerUsage.map((row) => ({
        provider: row.provider,
        model: row.model,
        modality: row.modality,
        status: row.status,
        events: row._count.id,
        durationMs: row._sum.durationMs ?? 0,
        estimatedCostMicros: row._sum.estimatedCostMicros,
      })),
      providerCost: {
        events: usageTotal,
        pricedEvents: usagePriced,
        coverageRate: usageTotal ? Math.round((usagePriced / usageTotal) * 1000) / 10 : 0,
        estimatedCostMicros: providerCostMicros,
      },
    },
    gameplay: {
      starts: startedSessions.size,
      firstMinuteRate,
      firstActionRate,
      retries: gameplayEvents.filter((event) => event.event === "retry").length,
      averageFailureSec,
      averageQualityScore,
      byTemplate: [...gameplayByTemplate.entries()]
        .map(([templateId, row]) => ({
          templateId,
          starts: row.starts.size,
          firstMinuteRate: row.starts.size ? Math.round((row.firstMinute.size / row.starts.size) * 1000) / 10 : 0,
          retries: row.retries,
        }))
        .sort((a, b) => b.starts - a.starts),
    },
    literary: {
      byType: literaryByType,
    },
    quality: {
      sampleLimitPerMedium: 200,
      byMedium: (["game", "novel", "comic"] as const).map((kind) => summarizeQuality(qualityRows, kind)),
      byTemplate: [...templateIds]
        .map((templateId) => {
          const quality = templateQuality.get(templateId);
          const telemetry = gameplayByTemplate.get(templateId);
          return {
            templateId,
            evaluated: quality?.evaluated ?? 0,
            ready: quality?.ready ?? 0,
            averageScore: quality ? roundScore(quality.scoreTotal, quality.scoreCount) : null,
            starts: telemetry?.starts.size ?? 0,
            firstMinuteRate: telemetry?.starts.size
              ? Math.round((telemetry.firstMinute.size / telemetry.starts.size) * 1000) / 10
              : null,
          };
        })
        .sort((a, b) => b.evaluated - a.evaluated || b.starts - a.starts || a.templateId.localeCompare(b.templateId)),
    },
  });
}
