import { prisma } from "@/lib/prisma";
import { isEmailDeliveryConfigured } from "@/lib/auth/email-sender";
import { loadEmailConfig } from "@/lib/email-config";
import { buildAdminSampleGalleryReport } from "@/lib/admin-sample-gallery";
import { readQaSnapshot, type QaSmokeSnapshot, type QaSnapshotId } from "@/lib/qa-cache";
import { getEffectiveProviders, getEffectiveRoutes, loadRuntimeConfig, resolveSceneRoute } from "@/lib/runtime-config";
import { assessNovelRehearsalReadiness } from "@/lib/generation-rehearsal-readiness";

export type OpsHealthStatus = "ok" | "warn" | "fail";

export type OpsHealthCheck = {
  id: string;
  status: OpsHealthStatus;
  labelKey: string;
  detail?: string;
  hintKey?: string;
  /** For newly added operational checks before every locale has a translation. */
  label?: string;
  hint?: string;
};

export type OpsHealthQaSnapshot = {
  script: string;
  ok: boolean;
  passed: number;
  total: number;
  ts: string;
  ageHours: number;
  failedIds?: string[];
};

export type OpsHealthQaCommand = {
  id: string;
  command: string;
  labelKey: string;
};

export type AdminOpsHealthReport = {
  overall: OpsHealthStatus;
  checks: OpsHealthCheck[];
  qaCommands: OpsHealthQaCommand[];
  qaSnapshots: OpsHealthQaSnapshot[];
  ts: string;
};

function enrichSnapshot(raw: QaSmokeSnapshot): OpsHealthQaSnapshot {
  const ageMs = Date.now() - new Date(raw.ts).getTime();
  const ageHours = Math.max(0, ageMs / (60 * 60 * 1000));
  return { ...raw, ageHours: Math.round(ageHours * 10) / 10 };
}

function pushSnapshotCheck(
  checks: OpsHealthCheck[],
  id: QaSnapshotId,
  checkId: string,
  labelKey: string,
  hintMissing: string,
  hintStale: string,
  hintFailed: string,
): OpsHealthQaSnapshot | null {
  const raw = readQaSnapshot(id);
  if (!raw) {
    checks.push({
      id: checkId,
      status: "warn",
      labelKey,
      detail: "—",
      hintKey: hintMissing,
    });
    return null;
  }
  const snap = enrichSnapshot(raw);
  checks.push({
    id: checkId,
    status: raw.ok ? (snap.ageHours > 48 ? "warn" : "ok") : "fail",
    labelKey,
    detail: `${raw.passed}/${raw.total}`,
    hintKey: raw.ok ? (snap.ageHours > 48 ? hintStale : undefined) : hintFailed,
  });

  return snap;
}

function worstStatus(checks: OpsHealthCheck[]): OpsHealthStatus {
  if (checks.some((c) => c.status === "fail")) return "fail";
  if (checks.some((c) => c.status === "warn")) return "warn";
  return "ok";
}

export async function buildAdminOpsHealthReport(): Promise<AdminOpsHealthReport> {
  const checks: OpsHealthCheck[] = [];

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.push({ id: "db", status: "ok", labelKey: "healthCheck_db" });
  } catch (e) {
    checks.push({
      id: "db",
      status: "fail",
      labelKey: "healthCheck_db",
      detail: e instanceof Error ? e.message : "down",
      hintKey: "healthHint_db",
    });
  }

  try {
    await loadEmailConfig();
    checks.push({
      id: "email",
      status: isEmailDeliveryConfigured() ? "ok" : "warn",
      labelKey: "healthCheck_email",
      detail: isEmailDeliveryConfigured() ? "configured" : "missing",
      hintKey: isEmailDeliveryConfigured() ? undefined : "healthHint_email",
    });
  } catch {
    checks.push({
      id: "email",
      status: "warn",
      labelKey: "healthCheck_email",
      detail: "load_failed",
      hintKey: "healthHint_email",
    });
  }

  const sampleReport = await buildAdminSampleGalleryReport();
  const sampleStatus: OpsHealthStatus =
    sampleReport.syncedCount >= sampleReport.catalogCount
      ? sampleReport.items.some((i) => !i.hasCover)
        ? "warn"
        : "ok"
      : "warn";
  checks.push({
    id: "samples_sync",
    status: sampleStatus,
    labelKey: "healthCheck_samplesSync",
    detail: `${sampleReport.syncedCount}/${sampleReport.catalogCount}`,
    hintKey:
      sampleReport.syncedCount < sampleReport.catalogCount
        ? "healthHint_samplesSync"
        : sampleReport.items.some((i) => !i.hasCover)
          ? "healthHint_samplesCover"
          : undefined,
  });

  const noCoverCount = sampleReport.items.filter((i) => !i.hasCover).length;
  if (noCoverCount > 0) {
    checks.push({
      id: "samples_cover",
      status: "warn",
      labelKey: "healthCheck_samplesCover",
      detail: String(noCoverCount),
      hintKey: "healthHint_samplesCoverCmd",
    });
  } else {
    checks.push({ id: "samples_cover", status: "ok", labelKey: "healthCheck_samplesCover" });
  }

  const since1h = new Date(Date.now() - 60 * 60 * 1000);
  const [pendingG, pendingN, pendingC, genErrors1h, genSuccess1h] = await Promise.all([
    prisma.project.count({ where: { visibility: "pending_review" } }),
    prisma.novel.count({ where: { visibility: "pending_review" } }),
    prisma.comic.count({ where: { visibility: "pending_review" } }),
    prisma.generationError.count({ where: { createdAt: { gte: since1h } } }),
    prisma.project.count({ where: { createdAt: { gte: since1h }, status: "ready" } }),
  ]);
  const pendingTotal = pendingG + pendingN + pendingC;
  checks.push({
    id: "moderation",
    status: pendingTotal > 0 ? "warn" : "ok",
    labelKey: "healthCheck_moderation",
    detail: String(pendingTotal),
    hintKey: pendingTotal > 0 ? "healthHint_moderation" : undefined,
  });

  const totalGen1h = genErrors1h + genSuccess1h;
  const errorRate1h = totalGen1h > 0 ? Math.round((genErrors1h / totalGen1h) * 100) : 0;
  checks.push({
    id: "gen_errors",
    status: genErrors1h > 20 ? "fail" : genErrors1h > 5 ? "warn" : "ok",
    labelKey: "healthCheck_genErrors",
    detail: `${genErrors1h} errors / ${totalGen1h} attempts (${errorRate1h}% failure rate, 1h)`,
    hintKey: genErrors1h > 5 ? "healthHint_genErrors" : undefined,
  });

  const [runtime, queuedGenerationJobs, runningGenerationJobs] = await Promise.all([
    loadRuntimeConfig(),
    prisma.generationJob.count({ where: { status: { in: ["queued", "retrying"] } } }),
    prisma.generationJob.count({ where: { status: "running" } }),
  ]);
  const budget = runtime.dbPayload.dailyBudgetMicros;
  if (budget) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayUsage = await prisma.providerUsageEvent.aggregate({
      where: { createdAt: { gte: today } },
      _sum: { estimatedCostMicros: true },
    });
    const spent = todayUsage._sum.estimatedCostMicros ?? 0;
    const ratio = spent / budget;
    checks.push({
      id: "daily_model_budget",
      status: ratio >= 1 ? "fail" : ratio >= 0.8 ? "warn" : "ok",
      labelKey: "healthCheck_db",
      label: "当日模型预算",
      detail: `${spent}/${budget} μ (${Math.round(ratio * 100)}%)`,
      hint:
        ratio >= 1
          ? "已超过当日预算，请暂停非必要重试并检查高成本路由。"
          : ratio >= 0.8
            ? "预算接近阈值，请检查失败重试和高成本模型。"
            : "预算处于安全范围。",
    });
  }
  const rehearsal = assessNovelRehearsalReadiness({
    route: resolveSceneRoute(runtime.payload, "novel"),
    queuedJobs: queuedGenerationJobs,
    runningJobs: runningGenerationJobs,
  });
  checks.push({
    id: "novel_rehearsal",
    status: rehearsal.status,
    labelKey: "healthCheck_novelRehearsal",
    detail: rehearsal.detail,
    hintKey: rehearsal.hintKey,
  });

  const providers = getEffectiveProviders(runtime.payload);
  const routes = getEffectiveRoutes(runtime.payload);
  const readyRoutes = routes.filter((route) => {
    const provider = providers.find((item) => item.id === route.providerId && item.enabled !== false);
    return Boolean(route.primary?.trim() && provider?.apiKey?.trim() && (provider.protocol !== "openai_compatible" || provider.baseUrl?.trim()));
  });
  const localeOverrides = runtime.payload.localeRoutes?.length ?? 0;
  checks.push({
    id: "model_routes",
    status: readyRoutes.length === routes.length && routes.length > 0 ? "ok" : "fail",
    labelKey: "healthCheck_db",
    label: "模型路由预检",
    detail: `${readyRoutes.length}/${routes.length} 全局路由就绪；${localeOverrides} 个语言覆盖`,
    hint: readyRoutes.length === routes.length ? "配置有效；连通性与真实生成结果需由独立探测/运营记录确认。" : "存在缺少主模型、服务商、密钥或 OpenAI Base URL 的路由。",
  });

  const probeRows = await prisma.runtimeProviderProbe.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { providerId: true, ok: true, latencyMs: true, createdAt: true },
  }).catch(() => []);
  const latestProbeByProvider = new Map<string, (typeof probeRows)[number]>();
  for (const probe of probeRows) if (!latestProbeByProvider.has(probe.providerId)) latestProbeByProvider.set(probe.providerId, probe);
  const enabledProviders = providers.filter((provider) => provider.enabled !== false && provider.apiKey?.trim());
  const failedProbes = enabledProviders.filter((provider) => latestProbeByProvider.get(provider.id)?.ok === false);
  const missingProbes = enabledProviders.filter((provider) => !latestProbeByProvider.has(provider.id));
  checks.push({
    id: "provider_probes",
    status: failedProbes.length ? "fail" : missingProbes.length ? "warn" : "ok",
    labelKey: "healthCheck_db",
    label: "网关真实探测",
    detail: `${enabledProviders.length - missingProbes.length - failedProbes.length}/${enabledProviders.length} 最近成功`,
    hint: failedProbes.length
      ? "至少一个已配置网关最近探测失败；请在网关模型页重新测试并检查网络、白名单或密钥。"
      : missingProbes.length
        ? "尚未对所有已配置网关执行真实探测；配置存在不等于可调用。"
        : "最近探测均成功；仍需通过真实生成成功率持续观察。",
  });

  const qaCommands: OpsHealthQaCommand[] = [
    { id: "admin", command: "npm run qa:admin-console", labelKey: "healthQa_admin" },
    { id: "samples_db", command: "npm run qa:sample-gallery-db-sync", labelKey: "healthQa_samplesDb" },
    {
      id: "samples_play",
      command: "npm run qa:sample-gameplay-interaction",
      labelKey: "healthQa_samplesPlay",
    },
    { id: "board", command: "npm run qa:board-showcase-samples", labelKey: "healthQa_board" },
    { id: "seed", command: "npm run seed:samples", labelKey: "healthQa_seed" },
    { id: "novel_rehearsal", command: "npm run qa:novel-continuation-job-api", labelKey: "healthQa_novelRehearsal" },
  ];

  const qaSnapshots: OpsHealthQaSnapshot[] = [];
  const adminSnap = pushSnapshotCheck(
    checks,
    "admin",
    "qa_smoke",
    "healthCheck_qaSmoke",
    "healthHint_qaMissing",
    "healthHint_qaStale",
    "healthHint_qaFailed",
  );
  if (adminSnap) qaSnapshots.push(adminSnap);

  const playSnap = pushSnapshotCheck(
    checks,
    "samplePlay",
    "qa_sample_play",
    "healthCheck_qaSamplePlay",
    "healthHint_qaSamplePlayMissing",
    "healthHint_qaStale",
    "healthHint_qaSamplePlayFailed",
  );
  if (playSnap) qaSnapshots.push(playSnap);

  const dbSnap = pushSnapshotCheck(
    checks,
    "sampleDb",
    "qa_sample_db",
    "healthCheck_qaSampleDb",
    "healthHint_qaSampleDbMissing",
    "healthHint_qaStale",
    "healthHint_qaSampleDbFailed",
  );
  if (dbSnap) qaSnapshots.push(dbSnap);

  return {
    overall: worstStatus(checks),
    checks,
    qaCommands,
    qaSnapshots,
    ts: new Date().toISOString(),
  };
}
