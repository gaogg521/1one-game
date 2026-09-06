/**
 * Shape coercion for novel-brief replies.
 *
 * Measured 2026-09-06: minimax-2-7 answers this schema in ~41s with good
 * content, but nests fields the schema wants flat — `protagonist` comes back
 * as `{name, background, motivation}`, `plotBeats` as `{act1, act2, act3}`.
 * Validation then rejected it, the caller retried in json_object mode, failed
 * the same way, moved to the next model, failed twice more, and after ~320s
 * fell back to the static template. Four full model calls thrown away over a
 * container type.
 *
 * Re-shaping what the model already said turns that into one 41s call that
 * succeeds. Nothing here invents content: a value that is not present stays
 * absent so schema validation and the fallback still do their job.
 */

type Dict = Record<string, unknown>;

const isDict = (v: unknown): v is Dict => typeof v === "object" && v !== null && !Array.isArray(v);

/** Flattens an object or array of scalars into one readable sentence. */
function flattenToString(value: unknown, depth = 0): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (depth > 2) return undefined;
  if (Array.isArray(value)) {
    const parts = value.map((v) => flattenToString(v, depth + 1)).filter(Boolean);
    return parts.length ? parts.join("；") : undefined;
  }
  if (isDict(value)) {
    // Keep the labels: "姓名：林昭；动机：查明真相" reads better than a bare list
    // and preserves what the model actually distinguished.
    const parts = Object.entries(value)
      .map(([k, v]) => {
        const inner = flattenToString(v, depth + 1);
        return inner ? (/^\d+$/.test(k) ? inner : `${k}：${inner}`) : undefined;
      })
      .filter(Boolean);
    return parts.length ? parts.join("；") : undefined;
  }
  return undefined;
}

/** Turns a scalar, or an object of scalars, into a list of strings. */
function toStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const out = value.map((v) => flattenToString(v)).filter((v): v is string => Boolean(v));
    return out.length ? out : undefined;
  }
  if (isDict(value)) {
    const out = Object.values(value).map((v) => flattenToString(v)).filter((v): v is string => Boolean(v));
    return out.length ? out : undefined;
  }
  const single = flattenToString(value);
  return single ? [single] : undefined;
}

const STRING_FIELDS = ["logline", "setting", "world", "protagonist", "coreConflict", "protagonistGoal", "tone"] as const;
const ARRAY_FIELDS = ["characters", "antagonists", "plotBeats", "keyScenes", "writingStyle", "narrativeHints", "negatives"] as const;

/** Best-effort re-shaping of a novel-brief reply before schema validation. */
export function coerceNovelBriefShape(raw: unknown): unknown {
  if (!isDict(raw)) return raw;
  const out: Dict = { ...raw };

  for (const field of STRING_FIELDS) {
    if (out[field] === undefined || typeof out[field] === "string") continue;
    const flat = flattenToString(out[field]);
    if (flat) out[field] = flat;
    else delete out[field];
  }

  for (const field of ARRAY_FIELDS) {
    if (out[field] === undefined) continue;
    if (Array.isArray(out[field]) && (out[field] as unknown[]).every((v) => typeof v === "string")) continue;
    const list = toStringArray(out[field]);
    if (list) out[field] = list;
    else delete out[field];
  }

  return out;
}
