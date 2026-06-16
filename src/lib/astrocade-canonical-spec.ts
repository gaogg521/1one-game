import type { AppLocale } from "@/i18n/routing";
import type { GameSpec } from "@/lib/game-spec";
import { enrichGameSpecForRuntime } from "@/lib/enrich-game-spec";
import { mockSpecFromPrompt } from "@/lib/mock-spec";
import { normalizeAstrocadePlaySpec } from "@/lib/astrocade-play-spec";
import { inferSampleIdFromPrompt } from "@/lib/sample-play-profiles";
import { SAMPLES } from "@/lib/samples";
import { sampleProjectId, isSampleGalleryProject } from "@/lib/sample-gallery";

export type CanonicalSpecOptions = {
  sampleId?: string;
  projectId?: string;
  /** 已入库 / API 传入的 spec；会与 prompt 一并规范化 */
  persistedSpec?: GameSpec;
};

/**
 * Astrocade 对标唯一 spec 入口：样品 seed · 用户 POST · duplicate · 试玩 enrich 同源。
 * 同 prompt → 同 GameSpec（含 profile / blueprint / theme）。
 */
export function buildCanonicalAstrocadeSpec(
  prompt: string,
  locale: AppLocale = "zh-Hans",
  opts: CanonicalSpecOptions = {},
): GameSpec {
  const trimmed = prompt.trim();
  const persistedVariantId = opts.persistedSpec?.samplePlayProfile?.variantId;
  const inferredId =
    opts.sampleId ?? inferSampleIdFromPrompt(trimmed) ?? persistedVariantId;
  const sample = inferredId ? SAMPLES.find((s) => s.id === inferredId) : undefined;

  /** 已知样品 prompt / variant：mock 起跑；否则沿用 persisted */
  const base: GameSpec = sample
    ? mockSpecFromPrompt(trimmed, {
        sampleId: sample.id,
        title: sample.title,
        subtitle: sample.subtitle,
      })
    : opts.persistedSpec ?? mockSpecFromPrompt(trimmed);

  const projectId = opts.projectId;
  const sampleId =
    opts.sampleId ??
    (projectId && isSampleGalleryProject(projectId) ? projectId.slice("sample-".length) : undefined) ??
    inferredId;

  return enrichGameSpecForRuntime(base, trimmed, locale, {
    sampleId,
    projectId,
  });
}

/** 试玩前：normalize + canonical（幂等） */
export function canonicalSpecForPlay(
  spec: GameSpec,
  promptHint: string,
  locale: AppLocale,
  projectId?: string | null,
): GameSpec {
  return buildCanonicalAstrocadeSpec(promptHint, locale, {
    persistedSpec: normalizeAstrocadePlaySpec(spec),
    projectId: projectId ?? undefined,
  });
}

/** 有 samplePlayProfile 时，运行时资产与样品馆同源（全局视觉对标） */
export function resolveAssetProjectId(spec: GameSpec, projectId?: string | null): string | null {
  const variantId = spec.samplePlayProfile?.variantId;
  if (variantId) return sampleProjectId(variantId);
  return projectId ?? null;
}

/** 试玩页统一背景 URL：profile 存在时与样品馆同源，避免 user projectId 覆盖样品资产 */
export function resolvePlayBackgroundUrl(
  spec: GameSpec,
  promptHint: string,
  locale: AppLocale,
  projectId?: string | null,
): string | null {
  const specPlay = canonicalSpecForPlay(spec, promptHint, locale, projectId);
  const assetProjectId = resolveAssetProjectId(specPlay, projectId);
  return assetProjectId ? `/game-bg/${assetProjectId}.png` : null;
}
