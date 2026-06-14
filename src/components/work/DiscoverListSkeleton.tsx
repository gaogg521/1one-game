"use client";

type Props = {
  count?: number;
  frameClass?: string;
};

export function DiscoverListSkeleton({ count = 8, frameClass = "aspect-[3/4]" }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-testid="discover-list-skeleton">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)]">
          <div className={`${frameClass} animate-pulse bg-[color:color-mix(in_srgb,var(--gc-border)_40%,transparent)]`} />
          <div className="space-y-2 p-2.5">
            <div className="h-3 w-3/4 animate-pulse rounded bg-[color:color-mix(in_srgb,var(--gc-border)_50%,transparent)]" />
            <div className="h-2 w-1/2 animate-pulse rounded bg-[color:color-mix(in_srgb,var(--gc-border)_40%,transparent)]" />
          </div>
        </div>
      ))}
    </div>
  );
}
