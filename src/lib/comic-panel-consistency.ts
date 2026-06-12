import type { AppLocale } from "@/i18n/routing";
import { comicConsistencyMessage } from "@/lib/i18n/progress-message";
import type { ComicPage } from "@/lib/comic-format";
import type { ComicDirectorPack } from "@/lib/comic-director-types";
import { isPlaceholderComicPanel } from "@/lib/comic-panel-prompt-urban";
import type { PlannedComicPanel } from "@/lib/comic-shot-plan";

export type ComicConsistencyIssue = {
  code: string;
  message: string;
  scene?: number;
  severity: "warn" | "error";
};

export type ComicConsistencyReport = {
  ok: boolean;
  issues: ComicConsistencyIssue[];
};

/** 规则检查：角色 id、场景 id、导演禁忌词。 */
export function checkComicPanelsConsistency(
  pages: ComicPage[],
  director: ComicDirectorPack,
  uiLocale: AppLocale = "zh-Hans",
): ComicConsistencyReport {
  const issues: ComicConsistencyIssue[] = [];
  const charIds = new Set(director.characters.map((c) => c.id));
  const locIds = new Set(director.locations.map((l) => l.id));
  const mainNames = director.characters.map((c) => c.name).filter((n) => n.length >= 2);
  const msg = (key: string, params?: Record<string, string | number>) =>
    comicConsistencyMessage(uiLocale, key, params);

  for (const page of pages) {
    for (const panel of page.panels) {
      const p = panel as PlannedComicPanel;
      const scene = p.scene ?? 0;

      for (const cid of p.characterIds ?? []) {
        if (!charIds.has(cid)) {
          issues.push({
            code: "unknown_character_id",
            message: msg("unknownCharacterId", { scene, id: cid }),
            scene,
            severity: "warn",
          });
        }
      }

      if (p.locationId && !locIds.has(p.locationId)) {
        issues.push({
          code: "unknown_location_id",
          message: msg("unknownLocationId", { scene, id: p.locationId }),
          scene,
          severity: "warn",
        });
      }

      const blob = `${p.caption} ${p.sceneDescriptionEn ?? ""} ${p.prompt ?? ""}`.toLowerCase();
      for (const taboo of director.taboos ?? []) {
        const t = taboo.trim().toLowerCase();
        if (t.length >= 4 && blob.includes(t)) {
          issues.push({
            code: "taboo_keyword_in_panel",
            message: msg("tabooKeywordInPanel", { scene, taboo }),
            scene,
            severity: "warn",
          });
        }
      }
    }
  }

  const firstPage = pages[0];
  const firstPanel = firstPage?.panels[0] as PlannedComicPanel | undefined;
  if (firstPanel && mainNames.length > 0) {
    const lead = director.characters[0]!;
    if (!(firstPanel.characterIds ?? []).includes(lead.id)) {
      issues.push({
        code: "lead_missing_opening",
        message: msg("leadMissingOpening", { name: lead.name, id: lead.id }),
        severity: "warn",
      });
    }
  }

  for (const page of pages) {
    for (const panel of page.panels) {
      const scene = (panel as PlannedComicPanel).scene ?? 0;
      if (!panel.caption?.trim()) {
        issues.push({
          code: "missing_caption",
          message: msg("missingCaption", { scene }),
          scene,
          severity: "warn",
        });
      }
    }
  }

  const hasError = issues.some((i) => i.severity === "error");
  return { ok: !hasError, issues };
}

/** 补全缺字分镜：漫画必须有 caption（对白/旁白等），配图不含可读文字。 */
export function ensureComicPanelsHaveReadableText(pages: ComicPage[]): number {
  let fixed = 0;
  for (const page of pages) {
    for (const panel of page.panels) {
      if (panel.caption?.trim()) continue;
      const p = panel as PlannedComicPanel;
      const sceneDesc = p.sceneDescriptionEn?.trim();
      const promptLooksGeneric =
        !panel.prompt?.trim() ||
        /^Japanese |^Comic panel|^Manga comic/i.test(panel.prompt.trim());
      const fallback = sceneDesc?.slice(0, 48) || (!promptLooksGeneric ? panel.prompt?.trim().slice(0, 48) : "");
      if (!fallback || isPlaceholderComicPanel({ caption: fallback, prompt: panel.prompt })) {
        continue;
      }
      panel.caption = fallback;
      if (!panel.textType) panel.textType = "narration";
      fixed += 1;
    }
  }
  return fixed;
}

export function formatComicConsistencyIssues(issues: ComicConsistencyIssue[]): string {
  if (issues.length === 0) return "";
  return issues.map((i) => `[${i.severity}] ${i.message}`).join("\n");
}
