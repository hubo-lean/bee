import { Skeleton } from "@/components/ui/skeleton";

function InboxCardSkeleton() {
  return (
    <div className="flex items-start gap-3 px-4 py-4">
      {/* Icon skeleton */}
      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />

      {/* Content skeleton */}
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />

        {/* Metadata skeleton */}
        <div className="flex items-center gap-2 pt-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="ml-auto h-5 w-16 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function InboxSkeleton() {
  return (
    <div className="space-y-0">
      {/* Header skeleton */}
      <div className="sticky top-0 z-10 bg-white/80 px-4 py-3 backdrop-blur">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="mt-1 h-4 w-16" />
      </div>

      {/* Card skeletons */}
      <div className="divide-y">
        {Array.from({ length: 5 }).map((_, i) => (
          <InboxCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
