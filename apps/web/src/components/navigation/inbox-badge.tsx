"use client";

import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

interface InboxBadgeProps {
  className?: string;
}

export function InboxBadge({ className }: InboxBadgeProps) {
  const { data } = trpc.inbox.count.useQuery(undefined, {
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const count = data?.count ?? 0;

  if (count === 0) {
    return null;
  }

  const displayCount = count > 99 ? "99+" : count.toString();

  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-medium text-white",
        className
      )}
      aria-label={`${count} pending items`}
    >
      {displayCount}
    </span>
  );
}
