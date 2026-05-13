export type TavilyResult = {
  title: string;
  url: string;
  content: string;
  score?: number;
};

export type TavilySearchResponse = {
  query: string;
  answer?: string;
  results: TavilyResult[];
};

const TAVILY_ENDPOINT = "https://api.tavily.com/search";
const TIMEOUT_MS = 12_000;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export async function tavilySearch(params: {
  query: string;
  maxResults?: number;
  searchDepth?: "basic" | "advanced" | "fast" | "ultra-fast";
  includeAnswer?: boolean;
}): Promise<TavilySearchResponse> {
  const key = process.env.TAVILY_API_KEY?.trim();
  if (!key) throw new Error("未配置 TAVILY_API_KEY");

  const max_results = clamp(params.maxResults ?? 6, 0, 12);
  const search_depth = params.searchDepth ?? "basic";
  const include_answer = params.includeAnswer ?? false;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(TAVILY_ENDPOINT, {
      method: "POST",
      signal: ac.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        query: params.query,
        search_depth,
        max_results,
        include_answer,
      }),
    });
    if (!res.ok) {
      throw new Error(`Tavily 请求失败 HTTP ${res.status}`);
    }
    const raw = (await res.json()) as Partial<TavilySearchResponse>;

    const results = Array.isArray(raw.results) ? raw.results : [];
    return {
      query: String(raw.query ?? params.query),
      answer: typeof raw.answer === "string" ? raw.answer : undefined,
      results: results
        .filter((r) => r && typeof (r as TavilyResult).url === "string")
        .map((r) => ({
          title: String((r as TavilyResult).title ?? ""),
          url: String((r as TavilyResult).url ?? ""),
          content: String((r as TavilyResult).content ?? ""),
          score: typeof (r as TavilyResult).score === "number" ? (r as TavilyResult).score : undefined,
        })),
    };
  } finally {
    clearTimeout(timer);
  }
}

