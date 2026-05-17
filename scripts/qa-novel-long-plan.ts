/**
 * 长篇分段计划离线检查：npx tsx scripts/qa-novel-long-plan.ts
 */
import { LONG_NOVEL_PRODUCT, planLongNovelSegments } from "@/lib/novel-long-config";
import { usesSegmentedLongGeneration } from "@/lib/novel-long-generate";

const plan = planLongNovelSegments("long");
console.log("[OK] usesSegmentedLongGeneration(long):", usesSegmentedLongGeneration("long"));
console.log("[OK] product:", LONG_NOVEL_PRODUCT);
console.log("[OK] plan:", plan);
if (plan.totalSegments < 3) {
  console.error("[FAIL] totalSegments < 3");
  process.exit(1);
}
console.log("[OK] qa-novel-long-plan");
