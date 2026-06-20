"use client";

/**
 * 创作台快速入口：
 *   1) 8 真玩法大卡片（一键填示例 prompt）
 *   2) 60 模板分类 chip（动作 / 益智 / 棋牌 / ...）
 *   3) prompt 实时主题预览（fingerprint → mood/music/color/模板）
 *
 * 设计目标：让新用户一眼看懂平台能力，不必面对空白输入框发呆。
 *
 * 适配值来自 @/lib/prompt-fingerprint + @/lib/prompt-theme-adapter；
 * 推荐模板来自 @/lib/template-selector；
 * 模板清单来自 @/lib/game-templates/registry 的 listTemplateDefinitions()。
 */
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import type { AppLocale } from "@/i18n/routing";
import { listTemplateDefinitions, type GameTemplateId } from "@/lib/game-templates/registry";
import { detectTemplateFromPrompt } from "@/lib/template-selector";
import { fingerprintPrompt } from "@/lib/prompt-fingerprint";
import { adaptThemeFromFingerprint, type PhaserMood, type ThemeAdaptation } from "@/lib/prompt-theme-adapter";

export type CreateQuickStartProps = {
  prompt: string;
  onPromptChange: (p: string) => void;
  locale: AppLocale;
};

// ── 8 真玩法（templateId → 一键填入的示例 prompt + emoji + 主题渐变色）──
// 数据从 listTemplateDefinitions() 读取以校验存在性；这里只声明"主推卡片"的元信息。
type HotCard = {
  templateId: GameTemplateId;
  emoji: string;
  /** 主标题 i18n key（zh-Hans.json createFlow.quickStart.hot.{id}） */
  titleKey: string;
  /** 一句话描述 i18n key */
  descKey: string;
  /** 点击后填入的示例 prompt i18n key */
  promptKey: string;
  /** 卡片渐变背景 CSS（与 var(--gc-*) 协调） */
  gradient: string;
};

const HOT_CARDS: HotCard[] = [
  {
    templateId: "mahjong",
    emoji: "🀄",
    titleKey: "hot.mahjong.title",
    descKey: "hot.mahjong.desc",
    promptKey: "hot.mahjong.prompt",
    gradient: "linear-gradient(135deg, #14532d 0%, #166534 60%, #22c55e 130%)",
  },
  {
    templateId: "tetris",
    emoji: "🟦",
    titleKey: "hot.tetris.title",
    descKey: "hot.tetris.desc",
    promptKey: "hot.tetris.prompt",
    gradient: "linear-gradient(135deg, #155e75 0%, #0e7490 60%, #22d3ee 130%)",
  },
  {
    templateId: "endless-runner",
    emoji: "🏃",
    titleKey: "hot.runner.title",
    descKey: "hot.runner.desc",
    promptKey: "hot.runner.prompt",
    gradient: "linear-gradient(135deg, #9a3412 0%, #c2410c 60%, #fb923c 130%)",
  },
  {
    templateId: "fruit-ninja",
    emoji: "🍉",
    titleKey: "hot.fruitNinja.title",
    descKey: "hot.fruitNinja.desc",
    promptKey: "hot.fruitNinja.prompt",
    gradient: "linear-gradient(135deg, #991b1b 0%, #dc2626 60%, #f87171 130%)",
  },
  {
    templateId: "mahjong-solitaire",
    emoji: "🀄",
    titleKey: "hot.mahjongSolitaire.title",
    descKey: "hot.mahjongSolitaire.desc",
    promptKey: "hot.mahjongSolitaire.prompt",
    gradient: "linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 60%, #60a5fa 130%)",
  },
  {
    templateId: "dou-dizhu",
    emoji: "🃏",
    titleKey: "hot.douDizhu.title",
    descKey: "hot.douDizhu.desc",
    promptKey: "hot.douDizhu.prompt",
    gradient: "linear-gradient(135deg, #581c87 0%, #7e22ce 60%, #c084fc 130%)",
  },
  {
    templateId: "breakout",
    emoji: "🧱",
    titleKey: "hot.breakout.title",
    descKey: "hot.breakout.desc",
    promptKey: "hot.breakout.prompt",
    gradient: "linear-gradient(135deg, #854d0e 0%, #ca8a04 60%, #fde047 130%)",
  },
  {
    templateId: "merge",
    emoji: "🔢",
    titleKey: "hot.merge2048.title",
    descKey: "hot.merge2048.desc",
    promptKey: "hot.merge2048.prompt",
    gradient: "linear-gradient(135deg, #831843 0%, #be185d 60%, #f9a8d4 130%)",
  },
];

// ── 分类映射（templateId → category） ──
// 去重后每模板只归一类；优先级：棋牌 > 卡牌 / 酷跑 > 动作 / 射击重复。
// 来源：任务规约 + listTemplateDefinitions() 的实际 id。
type Category = "action" | "puzzle" | "board" | "runner" | "shooter" | "casual" | "horror" | "card" | "strategy" | "sports" | "rhythm";

const CATEGORY_ORDER: Category[] = [
  "action",
  "puzzle",
  "board",
  "runner",
  "shooter",
  "casual",
  "horror",
  "card",
  "strategy",
  "sports",
  "rhythm",
];

// 每个分类下的 templateId 列表（按规约；重复条目由归类函数去重，先来先得）
const CATEGORY_MEMBERS: Array<{ cat: Category; ids: string[] }> = [
  {
    cat: "action",
    ids: ["platformer", "shooter", "stealth", "sniper", "run-and-gun", "fighting", "moba", "hack-and-slash"],
  },
  {
    cat: "puzzle",
    ids: ["puzzle", "tetris", "merge", "whack-a-mole", "word-game", "escape-room", "hidden-object", "mystery", "mahjong-solitaire", "merge"],
  },
  {
    cat: "board",
    ids: ["chess", "checkers", "chinese-checkers", "junqi", "aeroplane-chess", "turn-based", "mahjong", "dou-dizhu", "uno", "poker", "solitaire", "blackjack"],
  },
  { cat: "runner", ids: ["coaster", "racing", "endless-runner", "skiing"] },
  { cat: "shooter", ids: ["shooter", "sniper", "run-and-gun"] },
  {
    cat: "casual",
    ids: ["farming", "idle", "cooking", "pet", "garden", "cafe", "tycoon", "dating-sim", "sandbox", "customization", "coloring"],
  },
  { cat: "horror", ids: ["horror"] },
  { cat: "card", ids: ["card", "mahjong", "dou-dizhu", "uno", "poker", "solitaire", "blackjack"] },
  { cat: "strategy", ids: ["strategy", "auto-battler", "towerDefense", "turn-based"] },
  { cat: "sports", ids: ["sports"] },
  { cat: "rhythm", ids: ["rhythm"] },
];

// 卡片填入示例 prompt 时的「附加分类标签」——一些通用补充模板
const EXTRA_CUSTOM_TEMPLATES: Array<{ id: string; emoji: string; cat: Category }> = [
  { id: "towerDefense", emoji: "🗼", cat: "strategy" },
  { id: "physics", emoji: "🧲", cat: "casual" },
  { id: "pong", emoji: "🏓", cat: "action" },
  { id: "cut-the-rope", emoji: "✂️", cat: "puzzle" },
  { id: "pokemon-battle", emoji: "🐾", cat: "strategy" },
  { id: "survivor", emoji: "🧟", cat: "action" },
  { id: "collector", emoji: "💎", cat: "casual" },
  { id: "avoider", emoji: "🌀", cat: "action" },
  { id: "coaster", emoji: "🎢", cat: "runner" },
];

// ── mood / music / category → emoji ──
const MOOD_EMOJI: Record<PhaserMood, string> = {
  forest: "🌲",
  space: "🌌",
  ocean: "🌊",
  cyber: "🌆",
  generic: "✨",
};

const MUSIC_EMOJI: Record<ThemeAdaptation["musicProfile"], string> = {
  organic: "🎵",
  pulse: "🥁",
  minimal: "🎼",
  neon: "🎹",
};

const CATEGORY_EMOJI: Record<Category, string> = {
  action: "⚔️",
  puzzle: "🧩",
  board: "♟️",
  runner: "🏃",
  shooter: "🎯",
  casual: "🌱",
  horror: "👻",
  card: "🃏",
  strategy: "🗺️",
  sports: "⚽",
  rhythm: "🎼",
};

/** 把 templateId 归到唯一分类（按 CATEGORY_ORDER 优先级，先命中先归） */
function categorizeAllTemplateIds(allIds: string[]): Record<Category, string[]> {
  const assigned = new Set<string>();
  const result: Record<Category, string[]> = {
    action: [],
    puzzle: [],
    board: [],
    runner: [],
    shooter: [],
    casual: [],
    horror: [],
    card: [],
    strategy: [],
    sports: [],
    rhythm: [],
  };
  // 按 CATEGORY_ORDER 顺序归，确保棋牌优先于卡牌、酷跑优先于动作
  for (const cat of CATEGORY_ORDER) {
    const member = CATEGORY_MEMBERS.find((m) => m.cat === cat);
    if (!member) continue;
    for (const id of member.ids) {
      // 只归入实际存在的 templateId，且未被更早分类取走的
      if (allIds.includes(id) && !assigned.has(id)) {
        result[cat].push(id);
        assigned.add(id);
      }
    }
  }
  // 补充 EXTRA_CUSTOM_TEMPLATES（若仍未归类）
  for (const extra of EXTRA_CUSTOM_TEMPLATES) {
    if (allIds.includes(extra.id) && !assigned.has(extra.id)) {
      result[extra.cat].push(extra.id);
      assigned.add(extra.id);
    }
  }
  return result;
}

export function CreateQuickStart({ prompt, onPromptChange }: CreateQuickStartProps) {
  const t = useTranslations("createFlow.quickStart");

  // 全部模板清单（client 端常量，但放这里以便 useMemo 稳定）
  const allTemplates = useMemo(() => listTemplateDefinitions(), []);
  const allIds = useMemo(() => allTemplates.map((d) => d.id), [allTemplates]);

  // 分类结果
  const byCategory = useMemo(() => categorizeAllTemplateIds(allIds), [allIds]);

  // 当前激活分类 tab（默认 action）
  const [activeCat, setActiveCat] = useState<Category>("action");
  const activeTemplateIds = byCategory[activeCat] ?? [];

  // templateId → defaultSubtitle（chip label，回退到 id）
  const templateLabel = (id: string): string => {
    const def = allTemplates.find((d) => d.id === id);
    return def?.defaultSubtitle ?? id;
  };

  // ── prompt 实时主题预览（debounce 300ms） ──
  const [debouncedPrompt, setDebouncedPrompt] = useState(prompt);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedPrompt(prompt), 300);
    return () => window.clearTimeout(timer);
  }, [prompt]);

  const preview = useMemo(() => {
    const trimmed = debouncedPrompt.trim();
    if (!trimmed) return null;
    const fp = fingerprintPrompt(trimmed);
    const adapt = adaptThemeFromFingerprint(fp);
    const templateId = detectTemplateFromPrompt(trimmed);
    return { fp, adapt, templateId };
  }, [debouncedPrompt]);

  const fillPrompt = (text: string) => {
    onPromptChange(text);
  };

  return (
    <section className="flex flex-col gap-6" aria-label={t("sectionAria")}>
      {/* ─────────── 1. 8 真玩法大卡片 ─────────── */}
      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-[var(--gc-text)]">
          <span className="mr-1.5">🔥</span>
          {t("hotTitle")}
          <span className="ml-2 text-xs font-normal text-[var(--gc-text-faint)]">
            {t("hotSubtitle")}
          </span>
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {HOT_CARDS.map((card) => {
            // 防御：模板不存在则跳过（避免热更新定义变化后渲染异常）
            if (!allIds.includes(card.templateId)) return null;
            const title = t(card.titleKey);
            const desc = t(card.descKey);
            const samplePrompt = t(card.promptKey);
            return (
              <button
                key={card.templateId}
                type="button"
                onClick={() => fillPrompt(samplePrompt)}
                title={t("hotCardHint", { sample: samplePrompt })}
                className="group relative flex flex-col items-start gap-1 overflow-hidden rounded-2xl border border-[color:var(--gc-border)] px-4 py-3.5 text-left transition hover:-translate-y-0.5 hover:border-[color:color-mix(in_srgb,var(--gc-accent)_55%,transparent)] hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--gc-accent)_45%,transparent)]"
                style={{ background: card.gradient }}
              >
                <span className="absolute right-2 top-2 text-2xl opacity-90 drop-shadow-sm">{card.emoji}</span>
                <span className="text-sm font-semibold text-white drop-shadow-sm">{title}</span>
                <span className="text-[11px] leading-snug text-white/85 drop-shadow-sm">{desc}</span>
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-black/25 px-2 py-0.5 text-[10px] text-white/90 opacity-0 transition group-hover:opacity-100">
                  {t("clickToFill")}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─────────── 2. 60 模板分类快选 chip ─────────── */}
      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-[var(--gc-text)]">
          <span className="mr-1.5">🎮</span>
          {t("allTitle", { count: allIds.length })}
          <span className="ml-2 text-xs font-normal text-[var(--gc-text-faint)]">
            {t("allSubtitle")}
          </span>
        </h2>
        {/* 分类 tab */}
        <div className="flex flex-wrap gap-1.5">
          {CATEGORY_ORDER.map((cat) => {
            const count = byCategory[cat]?.length ?? 0;
            if (count === 0) return null;
            const isActive = cat === activeCat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCat(cat)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  isActive
                    ? "border-[color:color-mix(in_srgb,var(--gc-accent)_55%,transparent)] bg-[color:color-mix(in_srgb,var(--gc-accent)_18%,transparent)] text-[var(--gc-text)]"
                    : "border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] text-[var(--gc-text-soft)] hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,transparent)] hover:text-[var(--gc-text)]"
                }`}
              >
                <span aria-hidden>{CATEGORY_EMOJI[cat]}</span>
                <span>{t(`cat.${cat}`)}</span>
                <span className="tabular-nums text-[var(--gc-text-faint)]">{count}</span>
              </button>
            );
          })}
        </div>
        {/* 当前分类下的 chip */}
        <div className="flex flex-wrap gap-2 rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)]/60 px-3 py-3">
          {activeTemplateIds.length === 0 ? (
            <p className="text-xs text-[var(--gc-text-faint)]">{t("emptyCategory")}</p>
          ) : (
            activeTemplateIds.map((id) => {
              const def = allTemplates.find((d) => d.id === id);
              const label = templateLabel(id);
              const sample = def?.llmSummary ?? label;
              // chip 点击 → 填入「示例化」prompt（用 defaultSubtitle 拼成可生成句）
              const fillText = t("chipPromptTemplate", {
                subtitle: label,
                summary: sample,
              });
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => fillPrompt(fillText)}
                  title={t("chipHint", { sample })}
                  className="rounded-full border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-3 py-1 text-xs text-[var(--gc-text-soft)] transition hover:border-[color:color-mix(in_srgb,var(--gc-accent)_45%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--gc-accent)_8%,transparent)] hover:text-[var(--gc-text)]"
                >
                  <span className="font-mono text-[10px] text-[var(--gc-text-faint)]">{id}</span>
                  <span className="ml-1.5">{label}</span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ─────────── 3. prompt 实时主题预览 ─────────── */}
      {preview ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-[color:color-mix(in_srgb,var(--gc-accent)_25%,var(--gc-border))] bg-[color:color-mix(in_srgb,var(--gc-accent)_6%,transparent)] px-4 py-4">
          <h3 className="text-sm font-semibold text-[var(--gc-text)]">
            <span className="mr-1.5">🎨</span>
            {t("previewTitle")}
            <span className="ml-2 text-xs font-normal text-[var(--gc-text-faint)]">
              {t("previewSubtitle")}
            </span>
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* 场景 mood */}
            <PreviewCell
              label={t("previewMood")}
              emoji={MOOD_EMOJI[preview.adapt.phaserMood]}
              value={preview.adapt.phaserMood}
              decorWords={preview.adapt.sceneDecorWords.slice(0, 3).join(" · ")}
            />
            {/* 音乐 profile */}
            <PreviewCell
              label={t("previewMusic")}
              emoji={MUSIC_EMOJI[preview.adapt.musicProfile]}
              value={preview.adapt.musicProfile}
              decorWords={preview.adapt.bgmTag}
            />
            {/* 怪物配色 */}
            <ColorSwatchCell
              label={t("previewEnemy")}
              root={preview.adapt.enemyRoot}
              color={preview.adapt.enemyColor}
            />
            {/* 收集物配色 */}
            <ColorSwatchCell
              label={t("previewCollectible")}
              root={preview.adapt.collectibleRoot}
              color={preview.adapt.collectibleColor}
            />
          </div>
          {/* 推荐模板 */}
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-3 py-2">
            <span className="text-xs text-[var(--gc-muted)]">{t("previewTemplate")}</span>
            {preview.templateId ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:color-mix(in_srgb,var(--gc-accent)_45%,transparent)] bg-[color:color-mix(in_srgb,var(--gc-accent)_12%,transparent)] px-2.5 py-0.5 text-xs font-medium text-[var(--gc-text)]">
                <span className="font-mono text-[10px] text-[var(--gc-text-faint)]">{preview.templateId}</span>
                <span>{templateLabel(preview.templateId)}</span>
              </span>
            ) : (
              <span className="text-xs text-[var(--gc-text-faint)] italic">{t("previewNoTemplate")}</span>
            )}
            {/* 主题词 chips（轻量展示，让用户看到"千人千面"如何理解其输入） */}
            {preview.fp.themeWords.length > 0 ? (
              <div className="ml-auto flex flex-wrap items-center gap-1">
                {preview.fp.themeWords.slice(0, 5).map((w) => (
                  <span
                    key={w}
                    className="rounded-full border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-2 py-0.5 text-[10px] text-[var(--gc-text-soft)]"
                  >
                    {w}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

// ── 子组件 ──

function PreviewCell({
  label,
  emoji,
  value,
  decorWords,
}: {
  label: string;
  emoji: string;
  value: string;
  decorWords?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-3 py-2.5">
      <span className="text-[11px] text-[var(--gc-muted)]">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-lg" aria-hidden>{emoji}</span>
        <span className="text-sm font-medium text-[var(--gc-text)]">{value}</span>
      </div>
      {decorWords ? (
        <span className="truncate text-[10px] text-[var(--gc-text-faint)]" title={decorWords}>
          {decorWords}
        </span>
      ) : null}
    </div>
  );
}

function ColorSwatchCell({
  label,
  root,
  color,
}: {
  label: string;
  root: string;
  color: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-3 py-2.5">
      <span className="text-[11px] text-[var(--gc-muted)]">{label}</span>
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-5 w-5 shrink-0 rounded-md border border-[color:var(--gc-border)]"
          style={{ background: color }}
          aria-hidden
        />
        <span className="text-sm font-medium text-[var(--gc-text)]">{root}</span>
      </div>
      <span className="font-mono text-[10px] text-[var(--gc-text-faint)]">{color}</span>
    </div>
  );
}

export default CreateQuickStart;
