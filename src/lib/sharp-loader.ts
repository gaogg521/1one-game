import type sharp from "sharp";

type SharpModule = typeof sharp;

let cached: SharpModule | null | undefined;

/** 延迟加载 sharp，避免 CentOS 7 等旧 libstdc++ 在 next build 收集页面数据时即 dlopen 失败。 */
export async function loadSharp(): Promise<SharpModule> {
  if (cached === null) {
    throw new Error("sharp native module is not available on this platform");
  }
  if (!cached) {
    try {
      cached = (await import("sharp")).default;
    } catch {
      cached = null;
      throw new Error("sharp native module is not available on this platform");
    }
  }
  return cached;
}
