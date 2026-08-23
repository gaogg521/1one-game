"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { mergeLocaleHeaders } from "@/lib/i18n/client-headers";
import type { NovelBible, NovelChapterPlan, ChapterPlanItem } from "@/lib/novel-long-pipeline-types";

type Props = {
  novelId: string;
  initialBible?: NovelBible | null;
  initialChapterPlan?: NovelChapterPlan | null;
};

const PHASES = ["opening", "rising", "climax", "resolution"] as const;

function cloneBible(value: NovelBible): NovelBible {
  return { ...value, characters: value.characters.map((character) => ({ ...character })), taboos: [...(value.taboos ?? [])] };
}

function clonePlan(value: NovelChapterPlan): NovelChapterPlan {
  return { chapters: value.chapters.map((chapter) => ({ ...chapter })) };
}

/** Owner-only story facts and outline editor. Saving always creates a Core revision. */
export function NovelStoryPlanPanel({ novelId, initialBible, initialChapterPlan }: Props) {
  const t = useTranslations("storyPlan");
  const locale = useLocale() as AppLocale;
  const [bible, setBible] = useState<NovelBible | null>(() => (initialBible ? cloneBible(initialBible) : null));
  const [chapterPlan, setChapterPlan] = useState<NovelChapterPlan | null>(() =>
    initialChapterPlan ? clonePlan(initialChapterPlan) : null,
  );
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!bible || !chapterPlan) return null;

  function updateBible<K extends keyof NovelBible>(key: K, value: NovelBible[K]) {
    setBible((current) => (current ? { ...current, [key]: value } : current));
  }

  function updateChapter(index: number, patch: Partial<ChapterPlanItem>) {
    setChapterPlan((current) =>
      current
        ? { chapters: current.chapters.map((chapter, chapterIndex) => (chapterIndex === index ? { ...chapter, ...patch } : chapter)) }
        : current,
    );
  }

  async function save() {
    if (saving || !bible || !chapterPlan) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/novel/${encodeURIComponent(novelId)}/story-plan`, {
        method: "PUT",
        headers: mergeLocaleHeaders(locale, { "Content-Type": "application/json" }),
        body: JSON.stringify({ bible, chapterPlan }),
      });
      const data = (await response.json()) as {
        storyPlan?: { bible?: NovelBible; chapterPlan?: NovelChapterPlan };
        errorKey?: string;
      };
      if (!response.ok || !data.storyPlan?.bible || !data.storyPlan.chapterPlan) {
        const key = data.errorKey;
        setError(
          key === "storyPlanGenerating"
            ? t("generating")
            : key === "storyPlanUnavailable"
              ? t("unavailable")
              : key === "invalidStoryPlan"
                ? t("invalid")
                : t("saveFailed"),
        );
        return;
      }
      setBible(cloneBible(data.storyPlan.bible));
      setChapterPlan(clonePlan(data.storyPlan.chapterPlan));
      setEditing(false);
    } catch {
      setError(t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      className="rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-4 sm:p-5"
      data-testid="novel-story-plan"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--gc-accent)]">{t("eyebrow")}</p>
          <h2 className="mt-1 text-base font-semibold text-[var(--gc-text)]">{t("title")}</h2>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-[var(--gc-muted)]">{t("desc")}</p>
        </div>
        <span className="rounded-full border border-[color:var(--gc-border)] px-2.5 py-1 text-[10px] text-[var(--gc-text-soft)]">
          {t("chapterCount", { count: chapterPlan.chapters.length })}
        </span>
      </div>

      {!editing ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Fact label={t("world")} value={bible.worldSetting} />
            <Fact label={t("conflict")} value={bible.coreConflict} />
            <Fact label={t("ending")} value={bible.endingDirection} />
            {bible.tone ? <Fact label={t("tone")} value={bible.tone} /> : null}
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--gc-text-faint)]">{t("characters")}</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {bible.characters.map((character) => (
                <div key={`${character.name}-${character.role}`} className="rounded-lg border border-[color:var(--gc-border)] p-3 text-xs">
                  <p className="font-medium text-[var(--gc-text)]">{character.name} · {character.role}</p>
                  <p className="mt-1 text-[var(--gc-muted)]">{character.traits}</p>
                  {character.relationships ? <p className="mt-1 text-[var(--gc-text-faint)]">{character.relationships}</p> : null}
                </div>
              ))}
            </div>
          </div>
          <Outline chapters={chapterPlan.chapters} t={t} />
          <button type="button" onClick={() => setEditing(true)} className="text-xs font-medium text-[var(--gc-accent)] hover:underline">
            {t("edit")}
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-4 border-t border-[color:var(--gc-border)] pt-4">
          <Field label={t("world")} value={bible.worldSetting} onChange={(value) => updateBible("worldSetting", value)} />
          <Field label={t("conflict")} value={bible.coreConflict} onChange={(value) => updateBible("coreConflict", value)} />
          <Field label={t("ending")} value={bible.endingDirection} onChange={(value) => updateBible("endingDirection", value)} />
          <Field label={t("tone")} value={bible.tone ?? ""} onChange={(value) => updateBible("tone", value || undefined)} rows={2} />
          <Field
            label={t("taboos")}
            value={(bible.taboos ?? []).join("\n")}
            onChange={(value) => updateBible("taboos", value.split("\n").map((item) => item.trim()).filter(Boolean))}
            rows={2}
          />
          <div>
            <p className="text-xs font-medium text-[var(--gc-text-soft)]">{t("characters")}</p>
            <div className="mt-2 space-y-2">
              {bible.characters.map((character, index) => (
                <div key={`${character.name}-${index}`} className="grid gap-2 rounded-xl border border-[color:var(--gc-border)] p-3 sm:grid-cols-2">
                  <input value={character.name} onChange={(event) => updateCharacter(setBible, index, { name: event.target.value })} placeholder={t("characterName")} className={inputClass} />
                  <input value={character.role} onChange={(event) => updateCharacter(setBible, index, { role: event.target.value })} placeholder={t("characterRole")} className={inputClass} />
                  <input value={character.traits} onChange={(event) => updateCharacter(setBible, index, { traits: event.target.value })} placeholder={t("characterTraits")} className={inputClass} />
                  <input value={character.relationships ?? ""} onChange={(event) => updateCharacter(setBible, index, { relationships: event.target.value || undefined })} placeholder={t("relationships")} className={inputClass} />
                  <button type="button" disabled={bible.characters.length <= 2} onClick={() => updateBible("characters", bible.characters.filter((_, itemIndex) => itemIndex !== index))} className="text-left text-[10px] text-red-400 disabled:opacity-35 sm:col-span-2">
                    {t("removeCharacter")}
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => updateBible("characters", [...bible.characters, { name: "", role: "", traits: "" }])} className="mt-2 text-xs text-[var(--gc-accent)]">
              {t("addCharacter")}
            </button>
          </div>
          <div>
            <p className="text-xs font-medium text-[var(--gc-text-soft)]">{t("outline")}</p>
            <div className="mt-2 space-y-2">
              {chapterPlan.chapters.map((chapter, index) => (
                <div key={chapter.num} className="grid gap-2 rounded-xl border border-[color:var(--gc-border)] p-3 sm:grid-cols-[56px_1fr_130px]">
                  <span className="pt-2 text-xs text-[var(--gc-muted)]">#{chapter.num}</span>
                  <input value={chapter.title} onChange={(event) => updateChapter(index, { title: event.target.value })} placeholder={t("chapterTitle")} className={inputClass} />
                  <select value={chapter.phase} onChange={(event) => updateChapter(index, { phase: event.target.value as ChapterPlanItem["phase"] })} className={inputClass}>
                    {PHASES.map((phase) => <option key={phase} value={phase}>{t(`phase_${phase}`)}</option>)}
                  </select>
                  <textarea value={chapter.summary} onChange={(event) => updateChapter(index, { summary: event.target.value })} rows={2} placeholder={t("chapterSummary")} className={`${inputClass} resize-y sm:col-span-3`} />
                </div>
              ))}
            </div>
          </div>
          {error ? <p className="text-xs text-red-400">{error}</p> : null}
          <div className="flex gap-2">
            <button type="button" onClick={() => void save()} disabled={saving} className="rounded-lg bg-[var(--gc-accent)]/20 px-3 py-2 text-xs font-medium text-[var(--gc-text)] disabled:opacity-50">
              {saving ? t("saving") : t("save")}
            </button>
            <button type="button" onClick={() => { setBible(cloneBible(initialBible!)); setChapterPlan(clonePlan(initialChapterPlan!)); setEditing(false); setError(""); }} disabled={saving} className="rounded-lg border border-[color:var(--gc-border)] px-3 py-2 text-xs text-[var(--gc-muted)]">
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

const inputClass = "w-full rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-bg)] px-3 py-2 text-xs text-[var(--gc-text)]";

function Fact({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] font-medium uppercase tracking-wider text-[var(--gc-text-faint)]">{label}</p><p className="mt-1 text-xs leading-relaxed text-[var(--gc-text-soft)]">{value}</p></div>;
}

function Field({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (value: string) => void; rows?: number }) {
  return <label className="block text-xs font-medium text-[var(--gc-text-soft)]">{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} rows={rows} className={`${inputClass} mt-1 resize-y`} /></label>;
}

function Outline({ chapters, t }: { chapters: ChapterPlanItem[]; t: ReturnType<typeof useTranslations> }) {
  return <div><p className="text-[10px] font-medium uppercase tracking-wider text-[var(--gc-text-faint)]">{t("outline")}</p><ol className="mt-2 space-y-2">{chapters.map((chapter) => <li key={chapter.num} className="rounded-lg border border-[color:var(--gc-border)] p-3 text-xs"><p className="font-medium text-[var(--gc-text)]">#{chapter.num} · {chapter.title} <span className="text-[var(--gc-text-faint)]">· {t(`phase_${chapter.phase}`)}</span></p><p className="mt-1 leading-relaxed text-[var(--gc-muted)]">{chapter.summary}</p></li>)}</ol></div>;
}

function updateCharacter(
  setBible: React.Dispatch<React.SetStateAction<NovelBible | null>>,
  index: number,
  patch: Partial<NovelBible["characters"][number]>,
) {
  setBible((current) => current ? { ...current, characters: current.characters.map((character, characterIndex) => characterIndex === index ? { ...character, ...patch } : character) } : current);
}
