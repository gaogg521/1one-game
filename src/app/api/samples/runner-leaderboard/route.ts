import { NextResponse } from "next/server";
import {
  getCloudRunnerLeaderboard,
  insertCloudRunnerLeaderboardEntry,
} from "@/lib/runner-leaderboard-store";
import { isRunnerLeaderboardVariant } from "@/lib/runner-leaderboard";

export async function GET(req: Request) {
  const variant = new URL(req.url).searchParams.get("variant")?.trim() ?? "";
  if (!isRunnerLeaderboardVariant(variant)) {
    return NextResponse.json({ error: "invalid_variant" }, { status: 400 });
  }
  const entries = getCloudRunnerLeaderboard(variant);
  return NextResponse.json({ variantId: variant, entries });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const raw = body as Record<string, unknown>;
  const variantId = typeof raw.variantId === "string" ? raw.variantId.trim() : "";
  if (!isRunnerLeaderboardVariant(variantId)) {
    return NextResponse.json({ error: "invalid_variant" }, { status: 400 });
  }
  const score = Number(raw.score);
  const combo = Number(raw.combo);
  const distance = Number(raw.distance);
  if (!Number.isFinite(score) || score < 0 || score > 9_999_999) {
    return NextResponse.json({ error: "invalid_score" }, { status: 400 });
  }
  if (!Number.isFinite(combo) || combo < 0 || combo > 999) {
    return NextResponse.json({ error: "invalid_combo" }, { status: 400 });
  }
  if (!Number.isFinite(distance) || distance < 0 || distance > 999_999) {
    return NextResponse.json({ error: "invalid_distance" }, { status: 400 });
  }
  const coinsRaw = raw.coins;
  const coins =
    coinsRaw == null ? undefined : Number.isFinite(Number(coinsRaw)) ? Math.max(0, Number(coinsRaw)) : undefined;
  const nickname = typeof raw.nickname === "string" ? raw.nickname : undefined;
  const result = insertCloudRunnerLeaderboardEntry(variantId, {
    score: Math.round(score),
    combo: Math.round(combo),
    distance: Math.round(distance),
    coins,
    ...(nickname ? { nickname } : {}),
  });
  if (!result) {
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }
  return NextResponse.json({
    variantId,
    entries: result.entries,
    rank: result.rank,
    isNewBest: result.isNewBest,
    inserted: result.inserted,
  });
}
