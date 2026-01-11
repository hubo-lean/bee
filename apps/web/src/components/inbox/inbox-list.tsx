"use client";

import { useRef, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { InboxCard } from "./inbox-card";

interface InboxItem {
  id: string;
  type: string;
  content: string;
  source: string;
  status: string;
  mediaUrl: string | null;
  createdAt: Date;
}

interface InboxListProps {
  items: InboxItem[];
  onItemClick: (id: string) => void;
  onLoadMore: () => void;
  hasMore: boolean;
  isLoadingMore: boolean;
}

export function InboxList({
  items,
  onItemClick,
  onLoadMore,
  hasMore,
  isLoadingMore,
}: InboxListProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          onLoadMore();
        }
      },
      { threshold: 0.1, rootMargin: "100px" }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, onLoadMore]);

  return (
    <div className="divide-y" role="list" aria-label="Inbox items">
      {items.map((item) => (
        <InboxCard
          key={item.id}
          item={item}
          onClick={() => onItemClick(item.id)}
        />
      ))}

      {/* Load more trigger */}
      <div ref={loadMoreRef} className="py-4">
        {isLoadingMore && (
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            <span className="ml-2 text-sm text-gray-500">Loading more...</span>
          </div>
        )}
        {!hasMore && items.length > 0 && (
          <p className="text-center text-sm text-gray-400">
            No more items to load
          </p>
        )}
      </div>
    </div>
  );
}
