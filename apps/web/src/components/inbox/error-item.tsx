"use client";

import { useState } from "react";
import { RotateCcw, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatDistanceToNow } from "date-fns";

interface ProcessingMeta {
  lastError?: string;
  retryCount?: number;
  failedAt?: string;
}

interface ErrorItemData {
  id: string;
  type: string;
  content: string;
  source: string;
  status: string;
  createdAt: Date;
  processingMeta: ProcessingMeta;
}

interface ErrorItemProps {
  item: ErrorItemData;
  onRetrySuccess?: () => void;
  className?: string;
}

/**
 * Story 3.5: Error item display with retry functionality
 * Shows classification errors with details and retry button
 */
export function ErrorItem({ item, onRetrySuccess, className }: ErrorItemProps) {
  const [expanded, setExpanded] = useState(false);
  const utils = trpc.useUtils();

  const { mutate: retryClassification, isPending } = trpc.inbox.retryClassification.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        utils.inbox.errorItems.invalidate();
        utils.inbox.queueMetrics.invalidate();
        utils.inbox.list.invalidate();
        onRetrySuccess?.();
      }
    },
  });

  const handleRetry = () => {
    retryClassification({ id: item.id });
  };

  return (
    <div
      className={`bg-white border border-red-200 rounded-lg overflow-hidden ${className ?? ""}`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Error indicator */}
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
              <span className="text-sm font-medium text-red-600">
                Classification Failed
              </span>
              <span className="text-xs text-gray-400">
                {item.processingMeta.retryCount ?? 0} retries
              </span>
            </div>

            {/* Content preview */}
            <p className="text-sm text-gray-700 line-clamp-2">
              {item.content}
            </p>

            {/* Metadata */}
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
              <span className="capitalize">{item.type}</span>
              <span>{item.source}</span>
              <span>
                {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRetry}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RotateCcw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
              {isPending ? "Retrying..." : "Retry"}
            </button>

            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors"
              aria-label={expanded ? "Collapse details" : "Expand details"}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded error details */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-red-100 bg-red-50/50">
          <div className="mt-3 space-y-2">
            <div>
              <span className="text-xs font-medium text-gray-500">Error Message:</span>
              <p className="text-sm text-red-600 font-mono bg-white p-2 rounded mt-1 break-all">
                {item.processingMeta.lastError ?? "Unknown error"}
              </p>
            </div>

            {item.processingMeta.failedAt && (
              <div>
                <span className="text-xs font-medium text-gray-500">Failed At:</span>
                <p className="text-sm text-gray-600">
                  {new Date(item.processingMeta.failedAt).toLocaleString()}
                </p>
              </div>
            )}

            <div>
              <span className="text-xs font-medium text-gray-500">Full Content:</span>
              <p className="text-sm text-gray-600 bg-white p-2 rounded mt-1 whitespace-pre-wrap max-h-40 overflow-y-auto">
                {item.content}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * List of error items with retry all functionality
 */
interface ErrorItemsListProps {
  className?: string;
}

export function ErrorItemsList({ className }: ErrorItemsListProps) {
  const { data: items, isLoading } = trpc.inbox.errorItems.useQuery({ limit: 20 });

  if (isLoading) {
    return (
      <div className={`space-y-3 ${className ?? ""}`}>
        {[...Array(2)].map((_, i) => (
          <div key={i} className="animate-pulse bg-gray-100 rounded-lg h-24" />
        ))}
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className={`text-center py-8 text-gray-500 ${className ?? ""}`}>
        <p className="text-lg font-medium">No errors</p>
        <p className="text-sm">All items processed successfully</p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className ?? ""}`}>
      {items.map((item) => (
        <ErrorItem
          key={item.id}
          item={{
            ...item,
            createdAt: new Date(item.createdAt),
          }}
        />
      ))}
    </div>
  );
}
