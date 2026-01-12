"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function ReviewSkeleton() {
  return (
    <div className="flex flex-col h-[100dvh]">
      {/* Header skeleton */}
      <header className="flex items-center justify-between p-4 border-b">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-16" />
      </header>

      {/* Progress skeleton */}
      <div className="px-4 py-2 space-y-2">
        <Skeleton className="h-1.5 w-full rounded-full" />
        <div className="flex justify-between">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="flex gap-4">
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-8" />
        </div>
      </div>

      {/* Card skeleton */}
      <div className="flex-1 px-4 py-6">
        <div className="h-full rounded-xl border bg-card shadow-lg">
          <div className="p-4 space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>

            {/* Content */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>

            {/* Category */}
            <div className="pt-4">
              <Skeleton className="h-8 w-28 rounded-full" />
            </div>

            {/* Actions */}
            <div className="pt-2 space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </div>

      {/* Gesture hints skeleton */}
      <div className="grid grid-cols-4 gap-2 p-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}
