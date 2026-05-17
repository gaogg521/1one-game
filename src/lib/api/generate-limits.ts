/** 单机内存限流阈值（毫秒窗口）；多实例部署需换 Redis/KV（见 README）。 */

import { PRODUCT } from "@/lib/product-config";

export function generateRateLimits() {
  const { windowMs, postMax, streamMax, variantsMax, refineMax } = PRODUCT.api.rateLimit;
  return {
    windowMs,
    postMax,
    streamMax,
    variantsMax,
    refineMax,
  } as const;
}
