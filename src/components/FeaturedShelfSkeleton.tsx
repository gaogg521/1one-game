export function FeaturedShelfSkeleton({
  count = 6,
  aspect = "4/3",
}: {
  count?: number;
  aspect?: string;
}) {
  return (
    <section className="border-t border-[color:var(--gc-border)] px-6 py-16 sm:px-10 sm:py-20 lg:px-14 lg:py-20 xl:px-20 2xl:px-28">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-[var(--gc-surface-glass)]" />
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:mt-10 lg:grid-cols-6 lg:gap-3">
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl bg-[var(--gc-surface-glass)]"
            style={{ aspectRatio: aspect }}
          />
        ))}
      </div>
    </section>
  );
}
