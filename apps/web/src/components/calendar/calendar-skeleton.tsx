"use client";

import { Skeleton } from "@/components/ui/skeleton";

interface CalendarSkeletonProps {
  view: "week" | "day";
}

export function CalendarSkeleton({ view }: CalendarSkeletonProps) {
  const hours = Array.from({ length: 12 }, (_, i) => i);
  const days = view === "week" ? 5 : 1;

  return (
    <div className="flex flex-col h-full animate-pulse">
      {/* Header skeleton */}
      <div className="grid grid-cols-[60px_repeat(5,1fr)] gap-px mb-2">
        <div className="h-12" />
        {Array.from({ length: days }).map((_, i) => (
          <div key={i} className="h-12 flex flex-col items-center justify-center">
            <Skeleton className="h-3 w-8 mb-1" />
            <Skeleton className="h-6 w-6 rounded-full" />
          </div>
        ))}
      </div>

      {/* Grid skeleton */}
      <div className="flex-1 overflow-hidden">
        <div className={`grid grid-cols-[60px_repeat(${days},1fr)] gap-px`}>
          {/* Time column */}
          <div>
            {hours.map((hour) => (
              <div key={hour} className="h-16 flex justify-end pr-2 pt-1">
                <Skeleton className="h-3 w-8" />
              </div>
            ))}
          </div>

          {/* Day columns */}
          {Array.from({ length: days }).map((_, dayIndex) => (
            <div key={dayIndex} className="relative">
              {hours.map((hour) => (
                <div key={hour} className="h-16 border-b border-gray-100" />
              ))}
              {/* Random event skeletons */}
              {dayIndex % 2 === 0 && (
                <Skeleton
                  className="absolute left-1 right-1"
                  style={{
                    top: `${64 + dayIndex * 32}px`,
                    height: "48px",
                  }}
                />
              )}
              {dayIndex % 3 === 1 && (
                <Skeleton
                  className="absolute left-1 right-1"
                  style={{
                    top: `${192 + dayIndex * 16}px`,
                    height: "64px",
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
