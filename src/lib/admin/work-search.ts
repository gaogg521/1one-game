export function adminWorkSearchWhere(q: string | undefined | null): {
  OR?: Array<
    | { id: string }
    | { id: { startsWith: string } }
    | { shareCode: string }
    | { title: { contains: string } }
    | { prompt: { contains: string } }
  >;
} {
  const term = q?.trim();
  if (!term) return {};
  return {
    OR: [
      { id: term },
      { id: { startsWith: term } },
      { shareCode: term },
      { title: { contains: term } },
      { prompt: { contains: term } },
    ],
  };
}
