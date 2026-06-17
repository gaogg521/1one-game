import fs from "node:fs";
import path from "node:path";

export type QaSmokeSnapshot = {
  script: string;
  ok: boolean;
  passed: number;
  total: number;
  ts: string;
  failedIds?: string[];
};

export const QA_SNAPSHOT_FILES = {
  admin: "admin-smoke.json",
  samplePlay: "sample-play.json",
  sampleDb: "sample-db-sync.json",
} as const;

export type QaSnapshotId = keyof typeof QA_SNAPSHOT_FILES;

const CACHE_DIR = path.join(process.cwd(), ".qa-cache");

function snapshotPath(id: QaSnapshotId): string {
  return path.join(CACHE_DIR, QA_SNAPSHOT_FILES[id]);
}

export function writeQaSnapshot(id: QaSnapshotId, snapshot: QaSmokeSnapshot): void {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(snapshotPath(id), `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}

export function readQaSnapshot(id: QaSnapshotId): QaSmokeSnapshot | null {
  try {
    const file = snapshotPath(id);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf8")) as QaSmokeSnapshot;
  } catch {
    return null;
  }
}

/** @deprecated use writeQaSnapshot("admin", ...) */
export function writeQaSmokeSnapshot(snapshot: QaSmokeSnapshot): void {
  writeQaSnapshot("admin", snapshot);
}

/** @deprecated use readQaSnapshot("admin") */
export function readQaSmokeSnapshot(): QaSmokeSnapshot | null {
  return readQaSnapshot("admin");
}
