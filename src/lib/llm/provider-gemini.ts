import { safeErrorSummary } from "@/lib/llm/errors";
import type { LlmJsonRequest, LlmJsonResult, LlmMode } from "@/lib/llm/types";

type GeminiPart = { text?: unknown };

type GeminiResponse = {
  candidates?: ReadonlyArray<{
    content?: { parts?: ReadonlyArray<GeminiPart | undefined> | undefined };
  }>;
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  const ms = Math.max(1_000, Math.min(90_000, Math.floor(timeoutMs)));
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const timer = setTimeout(() => {
        clearTimeout(timer);
        reject(new Error(`${label} timeout after ${ms}ms`));
      }, ms);
    }),
  ]);
}

export async function llmJsonGemini(req: LlmJsonRequest): Promise<LlmJsonResult> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    return { ok: false, provider: "gemini", model: req.model, modeTried: req.mode, error: "missing GEMINI_API_KEY" };
  }

  const base = (process.env.GEMINI_BASE_URL?.trim() || "https://generativelanguage.googleapis.com").replace(/\/+$/, "");
  const url = `${base}/v1beta/models/${encodeURIComponent(req.model)}:generateContent?key=${encodeURIComponent(key)}`;

  const responseMimeType = req.mode === "json_schema" || req.mode === "json_object" ? "application/json" : "text/plain";
  const mode: LlmMode = "json_object";
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), req.timeoutMs);
  try {
    const body = {
      systemInstruction: { role: "system", parts: [{ text: req.system }] },
      contents: [{ role: "user", parts: [{ text: req.user }] }],
      generationConfig: {
        temperature: req.temperature,
        responseMimeType,
      },
    };
    const res = await withTimeout(
      fetch(url, {
        method: "POST",
        signal: ac.signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      req.timeoutMs + 2500,
      "gemini generateContent",
    );
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, provider: "gemini", model: req.model, modeTried: req.mode, error: `HTTP ${res.status} ${t}`.slice(0, 800) };
    }
    const json = (await res.json()) as GeminiResponse;
    const parts = json?.candidates?.[0]?.content?.parts;
    const text = Array.isArray(parts)
      ? parts.map((p) => (typeof p?.text === "string" ? p.text : "")).join("\n").trim()
      : "";
    const raw = text ? (JSON.parse(text) as unknown) : null;
    if (raw === null) return { ok: false, provider: "gemini", model: req.model, modeTried: req.mode, error: "empty output" };
    return { ok: true, provider: "gemini", model: req.model, mode, raw };
  } catch (e) {
    return { ok: false, provider: "gemini", model: req.model, modeTried: req.mode, error: safeErrorSummary(e) };
  } finally {
    clearTimeout(timer);
  }
}

