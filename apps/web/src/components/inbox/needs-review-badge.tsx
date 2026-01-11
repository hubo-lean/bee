"use client";

import { trpc } from "@/lib/trpc";

interface NeedsReviewBadgeProps {
  className?: string;
}

/**
 * Badge showing count of items that need manual review (low confidence)
 * Used in navigation to alert users of pending reviews
 */
export function NeedsReviewBadge({ className }: NeedsReviewBadgeProps) {
  const { data } = trpc.inbox.needsReviewCount.useQuery();

  if (!data?.count) return null;

  return (
    <span
      className={`inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium bg-amber-500 text-white rounded-full ${className ?? ""}`}
    >
      {data.count > 99 ? "99+" : data.count}
    </span>
  );
}
