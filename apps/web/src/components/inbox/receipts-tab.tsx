"use client";

import { trpc, type RouterOutputs } from "@/lib/trpc";
import { formatDistanceToNow } from "date-fns";

interface ReceiptsTabProps {
  className?: string;
}

/**
 * Displays list of auto-filed items (high-confidence classifications)
 * Allows users to spot-check AI decisions
 */
type ReceiptsPage = RouterOutputs["inbox"]["receipts"];

export function ReceiptsTab({ className }: ReceiptsTabProps) {
  const { data, isLoading, fetchNextPage, hasNextPage } = trpc.inbox.receipts.useInfiniteQuery(
    { limit: 20 },
    {
      getNextPageParam: (lastPage: ReceiptsPage) => lastPage.nextCursor,
    }
  );

  if (isLoading) {
    return (
      <div className={`space-y-3 ${className ?? ""}`}>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse bg-gray-100 rounded-lg h-20" />
        ))}
      </div>
    );
  }

  const receipts = data?.pages.flatMap((page: ReceiptsPage) => page.receipts) ?? [];

  if (receipts.length === 0) {
    return (
      <div className={`text-center py-8 text-gray-500 ${className ?? ""}`}>
        <p className="text-lg font-medium">No receipts yet</p>
        <p className="text-sm">Auto-filed items will appear here</p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className ?? ""}`}>
      {receipts.map((receipt) => (
        <div
          key={receipt.id}
          className="bg-white border rounded-lg p-4 hover:shadow-sm transition-shadow"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                  {receipt.aiCategory}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                  {Math.round(receipt.aiConfidence * 100)}%
                </span>
              </div>
              <p className="text-sm text-gray-600 line-clamp-2">
                {receipt.aiReasoning}
              </p>
              {receipt.inboxItem && (
                <p className="text-xs text-gray-400 mt-1 truncate">
                  {receipt.inboxItem.content?.substring(0, 100)}
                  {(receipt.inboxItem.content?.length ?? 0) > 100 && "..."}
                </p>
              )}
            </div>
            <div className="text-right text-xs text-gray-400 whitespace-nowrap">
              {formatDistanceToNow(new Date(receipt.createdAt), { addSuffix: true })}
            </div>
          </div>
        </div>
      ))}

      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          className="w-full py-2 text-sm text-blue-600 hover:text-blue-800"
        >
          Load more
        </button>
      )}
    </div>
  );
}
