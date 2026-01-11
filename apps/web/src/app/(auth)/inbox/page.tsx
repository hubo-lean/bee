"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { InboxList } from "@/components/inbox/inbox-list";
import { InboxItemDetail } from "@/components/inbox/inbox-item-detail";
import { EmptyInbox } from "@/components/inbox/empty-inbox";
import { InboxSkeleton } from "@/components/inbox/inbox-skeleton";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export default function InboxPage() {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = trpc.inbox.list.useInfiniteQuery(
    { limit: 20 },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  const items = data?.pages.flatMap((page) => page.items) ?? [];
  const selectedItem = selectedItemId
    ? items.find((item) => item.id === selectedItemId)
    : null;

  // Loading state
  if (isLoading) {
    return <InboxSkeleton />;
  }

  // Error state
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-gray-500">Failed to load inbox</p>
        <Button
          variant="link"
          onClick={() => refetch()}
          className="mt-2 text-primary"
        >
          Try again
        </Button>
      </div>
    );
  }

  // Empty state
  if (items.length === 0) {
    return <EmptyInbox />;
  }

  return (
    <div className="relative">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-white/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Inbox</h1>
            <p className="text-sm text-gray-500">{items.length} items</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            disabled={isRefetching}
            aria-label="Refresh inbox"
          >
            <RefreshCw
              className={`h-5 w-5 ${isRefetching ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </header>

      {/* List */}
      <InboxList
        items={items}
        onItemClick={setSelectedItemId}
        onLoadMore={() => fetchNextPage()}
        hasMore={!!hasNextPage}
        isLoadingMore={isFetchingNextPage}
      />

      {/* Detail panel */}
      {selectedItem && (
        <InboxItemDetail
          item={selectedItem}
          onClose={() => setSelectedItemId(null)}
        />
      )}
    </div>
  );
}
