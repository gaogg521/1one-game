import type { ComicPage } from "@/lib/comic-format";
import type { ComicDirectorPack } from "@/lib/comic-director-types";
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
): ComicConsistencyReport {
  const issues: ComicConsistencyIssue[] = [];
  const charIds = new Set(director.characters.map((c) => c.id));
  const locIds = new Set(director.locations.map((l) => l.id));
  const mainNames = director.characters.map((c) => c.name).filter((n) => n.length >= 2);

  for (const page of pages) {
    for (const panel of page.panels) {
      const p = panel as PlannedComicPanel;
      const scene = p.scene ?? 0;

      for (const cid of p.characterIds ?? []) {
        if (!charIds.has(cid)) {
          issues.push({
            code: "unknown_character_id",
            message: `第 ${scene} 格引用了未知角色 id：${cid}`,
            scene,
            severity: "warn",
          });
        }
      }

      if (p.locationId && !locIds.has(p.locationId)) {
        issues.push({
          code: "unknown_location_id",
          message: `第 ${scene} 格引用了未知场景 id：${p.locationId}`,
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
            message: `第 ${scene} 格文案含禁忌词「${taboo}」`,
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
        message: `开篇格建议出现主角 ${lead.name}（${lead.id}）`,
        severity: "warn",
      });
    }
  }

  const hasError = issues.some((i) => i.severity === "error");
  return { ok: !hasError, issues };
}

export function formatComicConsistencyIssues(issues: ComicConsistencyIssue[]): string {
  if (issues.length === 0) return "";
  return issues.map((i) => `[${i.severity}] ${i.message}`).join("\n");
}
