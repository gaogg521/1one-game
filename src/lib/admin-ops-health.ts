import { prisma } from "@/lib/prisma";
import { isEmailDeliveryConfigured } from "@/lib/auth/email-sender";
import { loadEmailConfig } from "@/lib/email-config";
import { buildAdminSampleGalleryReport } from "@/lib/admin-sample-gallery";
import { readQaSnapshot, type QaSmokeSnapshot, type QaSnapshotId } from "@/lib/qa-cache";

export type OpsHealthStatus = "ok" | "warn" | "fail";

export type OpsHealthCheck = {
  id: string;
  status: OpsHealthStatus;
  labelKey: string;
  detail?: string;
  hintKey?: string;
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
