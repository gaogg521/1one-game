import { shouldWriteProductLinesAggregate } from "../src/lib/qa/product-lines-summary";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

assert(shouldWriteProductLinesAggregate(undefined), "full qa:product-lines run should write aggregate summary");
assert(!shouldWriteProductLinesAggregate("game"), "single game line should not overwrite aggregate summary");
assert(!shouldWriteProductLinesAggregate("novel"), "single novel line should not overwrite aggregate summary");
assert(!shouldWriteProductLinesAggregate("comic"), "single comic line should not overwrite aggregate summary");

console.log("[OK] qa-product-lines-summary-contracts");
