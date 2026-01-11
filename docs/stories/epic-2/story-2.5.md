# Story 2.5: Inbox List View

## Story Overview

| Field                | Value                                           |
| -------------------- | ----------------------------------------------- |
| **Story ID**         | 2.5                                             |
| **Epic**             | [Epic 2: Unified Inbox & Capture](epic-2.md)    |
| **Priority**         | P0 - Critical Path                              |
| **Estimated Effort** | Medium (2-3 days)                               |
| **Dependencies**     | Story 2.1 (Manual Text Capture)                 |
| **Blocks**           | Epic 3 (AI Classification), Epic 4 (Swipe Review)|

## User Story

**As a** user,
**I want** to see all items in my unified inbox,
**So that** I can understand what's been captured and what needs processing.

## Detailed Description

This story creates the inbox list view - the central hub where users see all captured items awaiting processing. The inbox view provides:

- **List of all items** with preview, source icon, and timestamp
- **Item types differentiated** visually (text, image, voice, email)
- **Status indicators** showing AI processing state
- **Item detail view** for full content viewing
- **Inbox count badge** on navigation

The inbox is the starting point for the daily swipe review (Epic 4) and shows the user's capture activity.

## Acceptance Criteria

### AC1: Inbox List View

- [ ] Route: `/inbox`
- [ ] Shows all items with status `pending` or `processing`
- [ ] Sorted by newest first (default)
- [ ] Infinite scroll pagination (20 items per page)
- [ ] Pull-to-refresh on mobile

### AC2: Item Card Display

Each item card shows:
- [ ] Source type icon (text, image, mic, mail)
- [ ] Content preview (truncated to ~100 chars)
- [ ] Thumbnail for image items
- [ ] Timestamp (relative: "2 hours ago")
- [ ] AI processing status badge (pending, processing, classified)
- [ ] Tap to open detail view

### AC3: Empty State

- [ ] Shown when inbox is empty
- [ ] Illustration/icon indicating empty inbox
- [ ] Message: "Your inbox is empty"
- [ ] Call-to-action: "Capture something" linking to capture modal

### AC4: Loading States

- [ ] Skeleton cards while loading initial data
- [ ] Loading spinner at bottom during pagination
- [ ] Smooth transition when new items load

### AC5: Item Detail View

- [ ] Opens as slide-over panel or modal
- [ ] Shows full content (not truncated)
- [ ] For images: full-size view with zoom
- [ ] For voice: audio player with transcription
- [ ] For email: formatted email display
- [ ] Close via X button or swipe

### AC6: Navigation Badge

- [ ] Inbox count shown on navigation icon
- [ ] Badge shows items with status `pending` or `processing`
- [ ] Badge updates when new items captured
- [ ] Badge hidden when count is 0

### AC7: Real-time Updates

- [ ] New captures appear without manual refresh
- [ ] Status changes (processing → classified) update in real-time
- [ ] Optimistic updates when user interacts

## Technical Implementation Notes

### File: `app/(auth)/inbox/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { InboxList } from '@/components/inbox/inbox-list';
import { InboxItemDetail } from '@/components/inbox/inbox-item-detail';
import { EmptyInbox } from '@/components/inbox/empty-inbox';
import { InboxSkeleton } from '@/components/inbox/inbox-skeleton';
import { api } from '@/lib/trpc/client';

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
  } = api.inbox.list.useInfiniteQuery(
    { limit: 20 },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  const items = data?.pages.flatMap((page) => page.items) ?? [];

  const selectedItem = selectedItemId
    ? items.find((item) => item.id === selectedItemId)
    : null;

  if (isLoading) {
    return <InboxSkeleton />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-gray-500">Failed to load inbox</p>
        <button
          onClick={() => refetch()}
          className="mt-2 text-primary hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return <EmptyInbox />;
  }

  return (
    <div className="relative">
      <header className="sticky top-0 z-10 bg-white/80 px-4 py-3 backdrop-blur">
        <h1 className="text-xl font-semibold">Inbox</h1>
        <p className="text-sm text-gray-500">{items.length} items</p>
      </header>

      <InboxList
        items={items}
        onItemClick={setSelectedItemId}
        onLoadMore={fetchNextPage}
        hasMore={hasNextPage}
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
```

### File: `components/inbox/inbox-list.tsx`

```typescript
'use client';

import { useEffect, useRef } from 'react';
import { InboxItem } from '@prisma/client';
import { InboxCard } from './inbox-card';
import { Loader2 } from 'lucide-react';

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

  // Intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, onLoadMore]);

  return (
    <div className="divide-y">
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
          <div className="flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        )}
      </div>
    </div>
  );
}
```

### File: `components/inbox/inbox-card.tsx`

```typescript
'use client';

import { InboxItem } from '@prisma/client';
import { formatDistanceToNow } from 'date-fns';
import {
  FileText,
  Image,
  Mic,
  Mail,
  Loader2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface InboxCardProps {
  item: InboxItem;
  onClick: () => void;
}

const typeIcons = {
  manual: FileText,
  image: Image,
  voice: Mic,
  email: Mail,
  forward: Mail,
};

const statusConfig = {
  pending: {
    icon: null,
    color: 'text-gray-400',
    label: 'Pending',
  },
  processing: {
    icon: Loader2,
    color: 'text-blue-500',
    label: 'Processing',
    animate: true,
  },
  reviewed: {
    icon: CheckCircle,
    color: 'text-green-500',
    label: 'Classified',
  },
  archived: {
    icon: null,
    color: 'text-gray-400',
    label: 'Archived',
  },
};

export function InboxCard({ item, onClick }: InboxCardProps) {
  const TypeIcon = typeIcons[item.type as keyof typeof typeIcons] || FileText;
  const status = statusConfig[item.status as keyof typeof statusConfig];
  const StatusIcon = status?.icon;

  // Truncate content for preview
  const preview = item.content.length > 100
    ? item.content.slice(0, 100) + '...'
    : item.content;

  return (
    <button
      onClick={onClick}
      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 active:bg-gray-100"
    >
      {/* Type icon */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100">
        <TypeIcon className="h-5 w-5 text-gray-600" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-sm text-gray-900">{preview}</p>

          {/* Image thumbnail */}
          {item.type === 'image' && item.mediaUrl && (
            <img
              src={item.mediaUrl}
              alt=""
              className="h-12 w-12 shrink-0 rounded object-cover"
            />
          )}
        </div>

        <div className="mt-1 flex items-center gap-2">
          {/* Status indicator */}
          {StatusIcon && (
            <StatusIcon
              className={cn(
                'h-3.5 w-3.5',
                status.color,
                status.animate && 'animate-spin'
              )}
            />
          )}

          {/* Timestamp */}
          <span className="text-xs text-gray-500">
            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
          </span>

          {/* Voice indicator */}
          {item.type === 'voice' && item.mediaUrl && (
            <span className="text-xs text-gray-400">🎙️</span>
          )}
        </div>
      </div>
    </button>
  );
}
```

### File: `components/inbox/inbox-item-detail.tsx`

```typescript
'use client';

import { InboxItem } from '@prisma/client';
import { motion } from 'framer-motion';
import { X, FileText, Image, Mic, Mail } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { AudioPlayer } from './audio-player';
import { useMediaQuery } from '@/hooks/use-media-query';

interface InboxItemDetailProps {
  item: InboxItem;
  onClose: () => void;
}

const typeLabels = {
  manual: 'Text Note',
  image: 'Image',
  voice: 'Voice Note',
  email: 'Email',
  forward: 'Forwarded Email',
};

const typeIcons = {
  manual: FileText,
  image: Image,
  voice: Mic,
  email: Mail,
  forward: Mail,
};

export function InboxItemDetail({ item, onClose }: InboxItemDetailProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const TypeIcon = typeIcons[item.type as keyof typeof typeIcons] || FileText;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/50"
      />

      {/* Panel */}
      <motion.div
        initial={isMobile ? { y: '100%' } : { x: '100%' }}
        animate={isMobile ? { y: 0 } : { x: 0 }}
        exit={isMobile ? { y: '100%' } : { x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        drag={isMobile ? 'y' : false}
        dragConstraints={{ top: 0 }}
        dragElastic={0.2}
        onDragEnd={(_, info) => {
          if (info.offset.y > 100) onClose();
        }}
        className={cn(
          'fixed z-50 bg-white',
          isMobile
            ? 'inset-x-0 bottom-0 max-h-[90vh] rounded-t-2xl pb-safe'
            : 'bottom-0 right-0 top-0 w-full max-w-md shadow-xl'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <TypeIcon className="h-5 w-5 text-gray-600" />
            <span className="font-medium">
              {typeLabels[item.type as keyof typeof typeLabels]}
            </span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-4" style={{ maxHeight: 'calc(90vh - 60px)' }}>
          {/* Image display */}
          {item.type === 'image' && item.mediaUrl && (
            <div className="mb-4">
              <img
                src={item.mediaUrl}
                alt="Captured image"
                className="w-full rounded-lg"
              />
            </div>
          )}

          {/* Voice player */}
          {item.type === 'voice' && item.mediaUrl && (
            <div className="mb-4">
              <AudioPlayer src={item.mediaUrl} />
            </div>
          )}

          {/* Content text */}
          <div className="prose prose-sm max-w-none">
            <p className="whitespace-pre-wrap">{item.content}</p>
          </div>

          {/* Metadata */}
          <div className="mt-6 space-y-2 text-sm text-gray-500">
            <p>
              <span className="font-medium">Captured:</span>{' '}
              {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
            </p>
            <p>
              <span className="font-medium">Source:</span> {item.source}
            </p>
            <p>
              <span className="font-medium">Status:</span>{' '}
              <span className="capitalize">{item.status}</span>
            </p>
          </div>

          {/* AI Classification (when available) */}
          {item.aiClassification && (
            <div className="mt-6 rounded-lg bg-blue-50 p-4">
              <h4 className="font-medium text-blue-900">AI Classification</h4>
              <p className="mt-1 text-sm text-blue-700">
                Category: {(item.aiClassification as any).category}
              </p>
              <p className="text-sm text-blue-700">
                Confidence: {((item.aiClassification as any).confidence * 100).toFixed(0)}%
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}
```

### File: `components/inbox/empty-inbox.tsx`

```typescript
'use client';

import { Inbox, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCapture } from '@/components/capture/capture-provider';

export function EmptyInbox() {
  const { openCapture } = useCapture();

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
        <Inbox className="h-10 w-10 text-gray-400" />
      </div>
      <h2 className="text-xl font-semibold text-gray-900">Your inbox is empty</h2>
      <p className="mt-2 max-w-sm text-gray-500">
        Capture ideas, photos, voice notes, or forward emails to get started.
      </p>
      <Button onClick={openCapture} className="mt-6">
        <Plus className="mr-2 h-4 w-4" />
        Capture something
      </Button>
    </div>
  );
}
```

### File: `components/inbox/inbox-skeleton.tsx`

```typescript
import { Skeleton } from '@/components/ui/skeleton';

export function InboxSkeleton() {
  return (
    <div className="p-4">
      <Skeleton className="mb-4 h-8 w-24" />
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### File: `components/navigation/inbox-badge.tsx`

```typescript
'use client';

import { api } from '@/lib/trpc/client';

export function InboxBadge() {
  const { data } = api.inbox.count.useQuery(undefined, {
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (!data?.count || data.count === 0) {
    return null;
  }

  return (
    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-medium text-white">
      {data.count > 99 ? '99+' : data.count}
    </span>
  );
}
```

### Update Navigation Components

```typescript
// In sidebar.tsx and bottom-nav.tsx, wrap Inbox icon:

import { InboxBadge } from './inbox-badge';

// In the navigation item for Inbox:
<div className="relative">
  <Inbox className="h-5 w-5" />
  <InboxBadge />
</div>
```

## Files to Create/Modify

| File                                        | Action | Purpose                          |
| ------------------------------------------- | ------ | -------------------------------- |
| `app/(auth)/inbox/page.tsx`                 | Create | Inbox page component             |
| `components/inbox/inbox-list.tsx`           | Create | List component with infinite scroll |
| `components/inbox/inbox-card.tsx`           | Create | Individual item card             |
| `components/inbox/inbox-item-detail.tsx`    | Create | Detail panel/modal               |
| `components/inbox/empty-inbox.tsx`          | Create | Empty state component            |
| `components/inbox/inbox-skeleton.tsx`       | Create | Loading skeleton                 |
| `components/navigation/inbox-badge.tsx`     | Create | Count badge component            |
| `components/navigation/sidebar.tsx`         | Modify | Add badge to inbox link          |
| `components/navigation/bottom-nav.tsx`      | Modify | Add badge to inbox link          |

## Dependencies to Install

```bash
pnpm add date-fns
pnpm dlx shadcn-ui@latest add skeleton
```

## Environment Variables Required

None additional for this story.

## Testing Requirements

### Manual Testing

1. **Empty State:**
   - Clear all inbox items (or use new user)
   - Navigate to /inbox
   - Empty state displays with capture CTA
   - Click capture opens modal

2. **Item Display:**
   - Create items of each type (text, image, voice, email)
   - Verify correct icons display
   - Verify content preview truncates
   - Verify timestamps format correctly
   - Verify image thumbnails display

3. **Pagination:**
   - Create 30+ items
   - Scroll to bottom
   - Verify more items load
   - Verify spinner shows during load

4. **Item Detail:**
   - Tap an item
   - Detail panel opens
   - Full content visible
   - Image/audio displays correctly
   - Close via X or swipe

5. **Badge:**
   - Verify badge shows correct count
   - Add new item - badge updates
   - Zero items - badge hidden

### Integration Tests

```typescript
describe('Inbox list', () => {
  it('returns paginated inbox items', async () => {
    const caller = createCaller({ session: mockSession });

    const result = await caller.inbox.list({ limit: 5 });

    expect(result.items.length).toBeLessThanOrEqual(5);
    expect(result.items[0].createdAt).toBeDefined();
  });

  it('returns inbox count', async () => {
    const caller = createCaller({ session: mockSession });

    const result = await caller.inbox.count();

    expect(typeof result.count).toBe('number');
  });
});
```

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Inbox page displays all captured items
- [ ] Items sorted by newest first
- [ ] Infinite scroll works smoothly
- [ ] Empty state displays when no items
- [ ] Item detail view shows full content
- [ ] Image/voice items display media correctly
- [ ] Badge shows correct count
- [ ] Badge updates on new captures
- [ ] Loading states display properly
- [ ] Integration tests pass

## Notes & Decisions

- **Infinite scroll over pagination buttons:** More natural for mobile, matches modern app UX
- **Item detail as slide-over:** Keeps context of list visible, quick dismiss
- **30-second badge refresh:** Balance between real-time and API efficiency
- **Status badges:** Prepare for AI processing status in Epic 3

## Related Documentation

- [Architecture Document](../../architecture.md) - InboxItem data model
- [PRD](../../prd.md) - FR1 (Unified inbox)
- [Story 2.1](story-2.1.md) - tRPC inbox router
