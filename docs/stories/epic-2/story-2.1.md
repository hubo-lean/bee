# Story 2.1: Manual Text Capture

## Story Overview

| Field                | Value                                           |
| -------------------- | ----------------------------------------------- |
| **Story ID**         | 2.1                                             |
| **Epic**             | [Epic 2: Unified Inbox & Capture](epic-2.md)    |
| **Priority**         | P0 - Critical Path                              |
| **Estimated Effort** | Medium (2-3 days)                               |
| **Dependencies**     | Epic 1 (Foundation complete)                    |
| **Blocks**           | Stories 2.2, 2.3, 2.4, 2.5                      |

## User Story

**As a** user,
**I want** to quickly capture a text note from anywhere in the app,
**So that** I can get ideas out of my head and into the system without friction.

## Detailed Description

This story implements the core capture functionality - the most critical interaction in Bee. The capture experience must be:

- **Instant access:** One tap from any screen (FAB on mobile, keyboard shortcut on desktop)
- **Zero friction:** No questions asked - just capture and confirm
- **Fast feedback:** Success confirmation in under 2 seconds
- **Ready for next:** Input clears automatically for rapid successive captures

The capture modal/drawer will be used as the foundation for photo and voice capture in subsequent stories.

## Acceptance Criteria

### AC1: Capture Button Accessibility

- [ ] Floating Action Button (FAB) visible on all authenticated screens (mobile)
- [ ] FAB positioned bottom-right with safe area padding
- [ ] Keyboard shortcut `Cmd/Ctrl + K` opens capture on desktop
- [ ] Capture button in sidebar on desktop view
- [ ] Visual affordance indicating capture is available

### AC2: Capture Modal/Drawer

- [ ] Opens as bottom drawer on mobile (smooth animation)
- [ ] Opens as centered modal on desktop
- [ ] Text input field with auto-focus
- [ ] Placeholder text: "What's on your mind?"
- [ ] Multi-line textarea that expands up to 6 lines
- [ ] Submit button with loading state
- [ ] Close/cancel via swipe down (mobile) or Escape key (desktop)

### AC3: Capture Submission

- [ ] Submit via button click or `Cmd/Ctrl + Enter`
- [ ] InboxItem created with:
  - `type: "manual"`
  - `content: [user input]`
  - `source: "capture"`
  - `status: "pending"`
  - `userId: [current user]`
  - `createdAt: [timestamp]`
- [ ] Optimistic UI update (assumes success)
- [ ] Background sync to database

### AC4: Success Feedback

- [ ] Toast notification: "Captured!" with checkmark icon
- [ ] Toast auto-dismisses after 2 seconds
- [ ] Input field clears after successful capture
- [ ] Modal/drawer remains open for next capture
- [ ] Inbox badge count increments

### AC5: Error Handling

- [ ] Network error shows retry option in toast
- [ ] Validation: prevent empty submissions
- [ ] Character limit: 10,000 characters max
- [ ] Offline capture queued for sync (stretch goal)

### AC6: Performance

- [ ] Capture to confirmation < 2 seconds
- [ ] Modal/drawer opens in < 100ms
- [ ] No perceptible lag during typing

## Technical Implementation Notes

### File: `components/capture/capture-modal.tsx`

```typescript
'use client';

import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useMediaQuery } from '@/hooks/use-media-query';
import { api } from '@/lib/trpc/client';
import { toast } from 'sonner';

const captureSchema = z.object({
  content: z
    .string()
    .min(1, 'Please enter something to capture')
    .max(10000, 'Content too long (max 10,000 characters)'),
});

type CaptureFormData = z.infer<typeof captureSchema>;

interface CaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CaptureModal({ isOpen, onClose }: CaptureModalProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CaptureFormData>({
    resolver: zodResolver(captureSchema),
  });

  const utils = api.useUtils();
  const createInboxItem = api.inbox.create.useMutation({
    onSuccess: () => {
      toast.success('Captured!', {
        duration: 2000,
        icon: '✓',
      });
      reset();
      utils.inbox.count.invalidate();
      // Keep modal open for next capture
    },
    onError: (error) => {
      toast.error('Failed to capture', {
        description: error.message,
        action: {
          label: 'Retry',
          onClick: () => handleSubmit(onSubmit)(),
        },
      });
    },
  });

  const onSubmit = (data: CaptureFormData) => {
    createInboxItem.mutate({
      type: 'manual',
      content: data.content,
      source: 'capture',
    });
  };

  // Auto-focus textarea when modal opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Keyboard shortcut for submit
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(onSubmit)();
    }
  };

  if (isMobile) {
    return (
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 z-40 bg-black/50"
            />
            {/* Bottom Drawer */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100) onClose();
              }}
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-white pb-safe"
            >
              {/* Drag handle */}
              <div className="flex justify-center py-3">
                <div className="h-1 w-10 rounded-full bg-gray-300" />
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="px-4 pb-4">
                <Textarea
                  {...register('content')}
                  ref={(e) => {
                    register('content').ref(e);
                    (textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = e;
                  }}
                  placeholder="What's on your mind?"
                  className="min-h-[120px] resize-none border-0 text-lg focus-visible:ring-0"
                  onKeyDown={handleKeyDown}
                />
                {errors.content && (
                  <p className="mt-1 text-sm text-red-500">{errors.content.message}</p>
                )}

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    Press ⌘+Enter to capture
                  </span>
                  <Button
                    type="submit"
                    disabled={createInboxItem.isPending}
                    className="rounded-full px-6"
                  >
                    {createInboxItem.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Capture
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  // Desktop modal
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Quick Capture</h2>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)}>
              <Textarea
                {...register('content')}
                ref={(e) => {
                  register('content').ref(e);
                  (textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = e;
                }}
                placeholder="What's on your mind?"
                className="min-h-[150px] resize-none text-base"
                onKeyDown={handleKeyDown}
              />
              {errors.content && (
                <p className="mt-1 text-sm text-red-500">{errors.content.message}</p>
              )}

              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  ⌘+Enter to capture
                </span>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createInboxItem.isPending}>
                    {createInboxItem.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Capture'
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

### File: `components/capture/capture-provider.tsx`

```typescript
'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CaptureModal } from './capture-modal';

interface CaptureContextType {
  openCapture: () => void;
  closeCapture: () => void;
  isOpen: boolean;
}

const CaptureContext = createContext<CaptureContextType | null>(null);

export function CaptureProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openCapture = useCallback(() => setIsOpen(true), []);
  const closeCapture = useCallback(() => setIsOpen(false), []);

  // Global keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <CaptureContext.Provider value={{ openCapture, closeCapture, isOpen }}>
      {children}
      <CaptureModal isOpen={isOpen} onClose={closeCapture} />
    </CaptureContext.Provider>
  );
}

export function useCapture() {
  const context = useContext(CaptureContext);
  if (!context) {
    throw new Error('useCapture must be used within a CaptureProvider');
  }
  return context;
}
```

### File: `components/capture/capture-fab.tsx`

```typescript
'use client';

import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCapture } from './capture-provider';

interface CaptureFabProps {
  className?: string;
}

export function CaptureFab({ className }: CaptureFabProps) {
  const { openCapture } = useCapture();

  return (
    <button
      onClick={openCapture}
      className={cn(
        'fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center',
        'rounded-full bg-primary text-primary-foreground shadow-lg',
        'transition-transform hover:scale-105 active:scale-95',
        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
        'pb-safe', // Safe area for notched devices
        className
      )}
      aria-label="Quick capture"
    >
      <Plus className="h-6 w-6" />
    </button>
  );
}
```

### File: `server/routers/inbox.ts`

```typescript
import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { prisma } from '@packages/db';
import { TRPCError } from '@trpc/server';

export const inboxRouter = router({
  // Create new inbox item
  create: protectedProcedure
    .input(
      z.object({
        type: z.enum(['manual', 'image', 'voice', 'email', 'forward']),
        content: z.string().min(1).max(10000),
        source: z.string(),
        mediaUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const inboxItem = await prisma.inboxItem.create({
        data: {
          userId: ctx.session.user.id,
          type: input.type,
          content: input.content,
          source: input.source,
          mediaUrl: input.mediaUrl,
          status: 'pending',
        },
      });

      return inboxItem;
    }),

  // Get inbox count for badge
  count: protectedProcedure.query(async ({ ctx }) => {
    const count = await prisma.inboxItem.count({
      where: {
        userId: ctx.session.user.id,
        status: { in: ['pending', 'processing'] },
      },
    });

    return { count };
  }),

  // List inbox items (for Story 2.5)
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
        status: z.enum(['pending', 'processing', 'reviewed', 'archived']).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const items = await prisma.inboxItem.findMany({
        where: {
          userId: ctx.session.user.id,
          ...(input.status && { status: input.status }),
        },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: 'desc' },
      });

      let nextCursor: string | undefined;
      if (items.length > input.limit) {
        const nextItem = items.pop();
        nextCursor = nextItem!.id;
      }

      return {
        items,
        nextCursor,
      };
    }),

  // Get single inbox item
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const item = await prisma.inboxItem.findFirst({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
      });

      if (!item) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Inbox item not found',
        });
      }

      return item;
    }),
});
```

### File: `hooks/use-media-query.ts`

```typescript
import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);

    // Set initial value
    setMatches(media.matches);

    // Listen for changes
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', listener);

    return () => media.removeEventListener('change', listener);
  }, [query]);

  return matches;
}
```

### File: `app/(auth)/layout.tsx` (Update)

```typescript
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/navigation/sidebar';
import { BottomNav } from '@/components/navigation/bottom-nav';
import { CaptureProvider } from '@/components/capture/capture-provider';
import { CaptureFab } from '@/components/capture/capture-fab';
import { Toaster } from 'sonner';

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <CaptureProvider>
      <div className="flex min-h-screen">
        {/* Desktop sidebar */}
        <Sidebar className="hidden md:flex" user={session.user} />

        {/* Main content */}
        <main className="flex-1 pb-16 md:pb-0 md:pl-64">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <BottomNav className="md:hidden" />

        {/* Capture FAB (mobile only) */}
        <CaptureFab className="md:hidden" />

        {/* Toast notifications */}
        <Toaster position="top-center" />
      </div>
    </CaptureProvider>
  );
}
```

## Files to Create/Modify

| File                                     | Action | Purpose                          |
| ---------------------------------------- | ------ | -------------------------------- |
| `components/capture/capture-modal.tsx`   | Create | Main capture modal component     |
| `components/capture/capture-provider.tsx`| Create | Context for capture state        |
| `components/capture/capture-fab.tsx`     | Create | Floating action button           |
| `hooks/use-media-query.ts`               | Create | Responsive hook                  |
| `server/routers/inbox.ts`                | Create | tRPC router for inbox            |
| `server/routers/index.ts`                | Modify | Add inbox router                 |
| `app/(auth)/layout.tsx`                  | Modify | Add CaptureProvider and FAB      |

## Dependencies to Install

```bash
pnpm add framer-motion sonner @hookform/resolvers zod react-hook-form
pnpm dlx shadcn-ui@latest add textarea toast
```

## Environment Variables Required

None additional for this story.

## Testing Requirements

### Manual Testing

1. **Mobile (375px viewport):**
   - FAB visible in bottom-right corner
   - Tap FAB opens bottom drawer
   - Drawer has drag handle for close
   - Swipe down closes drawer
   - Type text and tap Capture
   - Toast shows "Captured!"
   - Input clears, drawer stays open

2. **Desktop:**
   - Press `Cmd/Ctrl + K` opens modal
   - Modal centered with backdrop
   - Auto-focus on textarea
   - Press `Cmd/Ctrl + Enter` submits
   - Press `Escape` closes modal
   - Success toast appears

3. **Error Cases:**
   - Try to submit empty (validation error)
   - Disconnect network, try capture (error toast with retry)

### Integration Tests

```typescript
// server/routers/inbox.test.ts
import { describe, it, expect } from 'vitest';
import { createCaller } from '../trpc';

describe('inbox.create', () => {
  it('creates an inbox item with manual type', async () => {
    const caller = createCaller({ session: mockSession });

    const result = await caller.inbox.create({
      type: 'manual',
      content: 'Test capture',
      source: 'capture',
    });

    expect(result.type).toBe('manual');
    expect(result.content).toBe('Test capture');
    expect(result.status).toBe('pending');
  });

  it('rejects empty content', async () => {
    const caller = createCaller({ session: mockSession });

    await expect(
      caller.inbox.create({
        type: 'manual',
        content: '',
        source: 'capture',
      })
    ).rejects.toThrow();
  });
});
```

## Definition of Done

- [ ] All acceptance criteria met
- [ ] FAB visible and functional on mobile
- [ ] Keyboard shortcut works on desktop
- [ ] Capture completes in < 2 seconds
- [ ] Success toast shows and auto-dismisses
- [ ] Input clears after capture
- [ ] Inbox count badge increments
- [ ] Error handling for network failures
- [ ] Integration tests pass
- [ ] No TypeScript errors
- [ ] Accessible (keyboard navigation, ARIA labels)

## Notes & Decisions

- **Modal stays open after capture:** Enables rapid successive captures without reopening
- **Optimistic UI:** Assumes success, rolls back on error for perceived speed
- **Character limit (10,000):** Generous limit for long captures while preventing abuse
- **No categories at capture:** Zero friction - AI handles classification in Epic 3
- **sonner for toasts:** Lightweight, good animations, works well with Next.js

## Related Documentation

- [Architecture Document](../../architecture.md) - InboxItem data model
- [PRD](../../prd.md) - FR1-FR3 (Capture requirements)
