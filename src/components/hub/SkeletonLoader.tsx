/**
 * Reusable skeleton loader components for Hub pages.
 * Tech-Noir aesthetic: #0a0a0a base, zinc-800 shimmer.
 */

interface SkeletonProps {
  className?: string;
}

/** Base shimmer block */
export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`bg-zinc-800/50 rounded animate-pulse ${className}`}
      aria-hidden="true"
    />
  );
}

/** KPI card skeleton (matches KPICard layout) */
export function SkeletonKPI() {
  return (
    <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4 space-y-3">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-8 w-28" />
      <Skeleton className="h-2.5 w-16" />
    </div>
  );
}

/** Chart skeleton (matches MacroChart layout) */
export function SkeletonChart({ height = "h-64" }: { height?: string }) {
  return (
    <div className={`bg-[#111] border border-[#1a1a1a] rounded-xl p-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-6 w-20 rounded-md" />
      </div>
      <Skeleton className={`w-full rounded-lg ${height}`} />
    </div>
  );
}

/** Table row skeleton */
export function SkeletonTableRow({ cols = 5 }: { cols?: number }) {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-[#1a1a1a]">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className={`h-4 ${i === 0 ? "w-40" : "w-20"}`} />
      ))}
    </div>
  );
}

/** Full page skeleton (Dashboard-like) */
export function SkeletonPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300" role="status" aria-label="Carregando...">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-3 w-80" />
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonKPI key={i} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SkeletonChart />
        <SkeletonChart />
      </div>

      {/* Table */}
      <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4">
        <Skeleton className="h-5 w-32 mb-4" />
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonTableRow key={i} />
        ))}
      </div>
    </div>
  );
}

/** Section skeleton (for lazy-loaded sections) */
export function SkeletonSection() {
  return (
    <div className="space-y-4 py-6" role="status" aria-label="Carregando seção...">
      <Skeleton className="h-6 w-48" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <SkeletonKPI />
        <SkeletonKPI />
        <SkeletonKPI />
      </div>
      <SkeletonChart />
    </div>
  );
}

/** Fund card skeleton (for lâminas/rankings) */
export function SkeletonFundCard() {
  return (
    <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="flex gap-6">
        <div className="space-y-1.5">
          <Skeleton className="h-2.5 w-10" />
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-2.5 w-10" />
          <Skeleton className="h-5 w-16" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-2.5 w-10" />
          <Skeleton className="h-5 w-16" />
        </div>
      </div>
    </div>
  );
}
