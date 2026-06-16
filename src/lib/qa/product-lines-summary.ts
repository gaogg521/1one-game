export type ProductLineFilter = "game" | "novel" | "comic" | undefined;

export function shouldWriteProductLinesAggregate(filter: ProductLineFilter): boolean {
  return filter === undefined;
}
