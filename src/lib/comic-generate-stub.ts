/** Playwright / qa:full：无 LLM 时的确定性漫画生成响应（勿在生产开启）。 */
export function isComicGenerateStubEnabled(): boolean {
  return process.env.E2E_COMIC_STUB === "1";
}

export function stubComicGenerateResponse(pageCount = 8): {
  ok: true;
  comic: { id: string };
  pageCount: number;
  panelCount: number;
  panelsRendered: number;
  pipeline: string;
  storyboardSource: string;
  provider: string;
  model: string;
  imageSource: string;
} {
  const pages = Math.max(1, Math.min(32, pageCount));
  const panels = pages * 3;
  return {
    ok: true,
    comic: { id: "e2e-comic-stub" },
    pageCount: pages,
    panelCount: panels,
    panelsRendered: panels,
    pipeline: "e2e-stub",
    storyboardSource: "stub",
    provider: "e2e-stub",
    model: "stub",
    imageSource: "none",
  };
}
