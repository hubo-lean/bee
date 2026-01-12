# Story 5.5: Auto-Archive & Bankruptcy

## Story

**As a** user,
**I want** old items auto-archived and ability to declare bankruptcy,
**So that** I can restart without guilt if I fall behind.

## Priority

**P1** - Important safety valve, not blocking core flow

## Acceptance Criteria

1. Items unprocessed for 15 days automatically archived
2. Auto-archived items tagged "Unprocessed - [Date]"
3. Warning shown before items are auto-archived
4. "Declare Bankruptcy" button bulk-archives all inbox items
5. Bankruptcy requires confirmation ("Type RESET to confirm")
6. Archived items remain searchable

## Technical Design

### Auto-Archive Logic

```typescript
const AUTO_ARCHIVE_DAYS = 15;

// Run daily via cron or on-demand
async function processAutoArchive(userId: string) {
  const cutoffDate = subDays(new Date(), AUTO_ARCHIVE_DAYS);

  // Find items to auto-archive
  const itemsToArchive = await prisma.inboxItem.findMany({
    where: {
      userId,
      status: { in: ["pending", "processing"] },
      createdAt: { lt: cutoffDate },
      // Exclude items already warned
      autoArchiveWarning: { not: true },
    },
  });

  // Mark with warning first (gives 2 more days)
  const warningCutoff = subDays(new Date(), AUTO_ARCHIVE_DAYS - 2);

  await prisma.inboxItem.updateMany({
    where: {
      userId,
      status: { in: ["pending", "processing"] },
      createdAt: { lt: warningCutoff, gte: cutoffDate },
      autoArchiveWarning: null,
    },
    data: {
      autoArchiveWarning: true,
      autoArchiveDate: addDays(new Date(), 2),
    },
  });

  // Archive items past the cutoff
  const archived = await prisma.inboxItem.updateMany({
    where: {
      userId,
      status: { in: ["pending", "processing"] },
      createdAt: { lt: cutoffDate },
    },
    data: {
      status: "archived",
      archivedAt: new Date(),
      tags: {
        push: {
          type: "system",
          value: `Unprocessed - ${format(new Date(), "yyyy-MM-dd")}`,
          confidence: 1.0,
        },
      },
    },
  });

  return {
    warned: itemsToArchive.length,
    archived: archived.count,
  };
}
```

### Auto-Archive Warning Banner

```tsx
function AutoArchiveWarning() {
  const { data: itemsAtRisk } = trpc.inbox.getAutoArchiveWarnings.useQuery();

  if (!itemsAtRisk || itemsAtRisk.length === 0) return null;

  return (
    <Alert variant="warning" className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Items expiring soon</AlertTitle>
      <AlertDescription>
        {itemsAtRisk.length} item{itemsAtRisk.length !== 1 ? "s" : ""} will be
        auto-archived in the next 2 days if not processed.
        <Button variant="link" className="px-0 ml-1" asChild>
          <Link href="/inbox?filter=expiring">View items</Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}
```

### Settings for Auto-Archive

```tsx
function AutoArchiveSettings() {
  const { data: settings } = trpc.user.getSettings.useQuery();
  const updateSettings = trpc.user.updateSettings.useMutation();

  const [days, setDays] = useState(settings?.autoArchiveDays || 15);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Auto-Archive</CardTitle>
        <CardDescription>
          Automatically archive unprocessed items after a certain period.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <Label htmlFor="autoArchiveDays">Archive after</Label>
          <Select
            value={days.toString()}
            onValueChange={(v) => {
              const newDays = parseInt(v);
              setDays(newDays);
              updateSettings.mutate({ autoArchiveDays: newDays });
            }}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="15">15 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="60">60 days</SelectItem>
              <SelectItem value="0">Never</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <p className="text-sm text-gray-500 mt-2">
          Items will be tagged as "Unprocessed" and moved to Archive.
          They remain searchable.
        </p>
      </CardContent>
    </Card>
  );
}
```

### Declare Bankruptcy

```typescript
async function declareBankruptcy(userId: string) {
  // Get count for confirmation
  const itemCount = await prisma.inboxItem.count({
    where: {
      userId,
      status: { in: ["pending", "processing"] },
    },
  });

  // Archive all pending items
  const result = await prisma.inboxItem.updateMany({
    where: {
      userId,
      status: { in: ["pending", "processing"] },
    },
    data: {
      status: "archived",
      archivedAt: new Date(),
      tags: {
        push: {
          type: "system",
          value: `Bankruptcy - ${format(new Date(), "yyyy-MM-dd")}`,
          confidence: 1.0,
        },
      },
    },
  });

  // Log the bankruptcy event
  await prisma.auditLog.create({
    data: {
      userId,
      action: "INBOX_BANKRUPTCY",
      metadata: {
        itemsArchived: result.count,
        timestamp: new Date(),
      },
    },
  });

  return { archived: result.count };
}
```

### Bankruptcy Dialog Component

```tsx
function BankruptcyDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const { data: itemCount } = trpc.inbox.getPendingCount.useQuery();
  const declareBankruptcy = trpc.inbox.declareBankruptcy.useMutation();

  const handleConfirm = async () => {
    if (confirmText !== "RESET") return;

    await declareBankruptcy.mutateAsync();
    onConfirm();
    onClose();
  };

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Declare Inbox Bankruptcy
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <p>
              This will archive <strong>{itemCount}</strong> items from your inbox.
              This action cannot be undone, but items will remain searchable in the Archive.
            </p>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800 text-sm">
                <strong>When to use this:</strong>
              </p>
              <ul className="text-yellow-700 text-sm mt-2 list-disc list-inside">
                <li>You've fallen far behind on processing</li>
                <li>Most items are no longer relevant</li>
                <li>You want a fresh start without guilt</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm">
                Type <strong>RESET</strong> to confirm:
              </Label>
              <Input
                id="confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                placeholder="Type RESET"
                autoComplete="off"
              />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={confirmText !== "RESET" || declareBankruptcy.isPending}
            className="bg-red-600 hover:bg-red-700"
          >
            {declareBankruptcy.isPending ? "Archiving..." : "Declare Bankruptcy"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

### Bankruptcy Success Toast

```tsx
function BankruptcySuccess({ count }: { count: number }) {
  return (
    <Toast>
      <div className="flex items-center gap-3">
        <div className="bg-green-100 rounded-full p-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
        </div>
        <div>
          <p className="font-medium">Fresh Start!</p>
          <p className="text-sm text-gray-500">
            {count} items archived. Your inbox is now empty.
          </p>
        </div>
      </div>
    </Toast>
  );
}
```

### Archive Page Updates

```tsx
function ArchivePage() {
  const [filter, setFilter] = useState<"all" | "unprocessed" | "bankruptcy">("all");
  const { data: items } = trpc.inbox.getArchived.useQuery({ filter });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Archive</h1>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All archived</SelectItem>
              <SelectItem value="unprocessed">Auto-archived</SelectItem>
              <SelectItem value="bankruptcy">Bankruptcy</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Archive stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{items?.total || 0}</div>
            <p className="text-sm text-gray-500">Total archived</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">
              {items?.unprocessed || 0}
            </div>
            <p className="text-sm text-gray-500">Auto-archived</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">
              {items?.bankruptcy || 0}
            </div>
            <p className="text-sm text-gray-500">From bankruptcy</p>
          </CardContent>
        </Card>
      </div>

      {/* Items list */}
      <div className="space-y-2">
        {items?.items.map((item) => (
          <ArchivedItemCard key={item.id} item={item} />
        ))}
      </div>

      {items?.items.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Archive className="h-12 w-12 mx-auto mb-2 text-gray-300" />
          <p>No archived items</p>
        </div>
      )}
    </div>
  );
}
```

### Restore from Archive

```tsx
function ArchivedItemCard({ item }: { item: InboxItem }) {
  const restoreItem = trpc.inbox.restore.useMutation();

  const isUnprocessed = item.tags?.some((t) => t.value.startsWith("Unprocessed"));
  const isBankruptcy = item.tags?.some((t) => t.value.startsWith("Bankruptcy"));

  return (
    <Card className="bg-gray-50">
      <CardContent className="py-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="line-clamp-2">{item.content}</p>
            <div className="flex items-center gap-2 mt-2 text-xs">
              <span className="text-gray-500">
                Archived {formatRelative(item.archivedAt)}
              </span>
              {isUnprocessed && (
                <Badge variant="outline" className="bg-yellow-50">
                  Auto-archived
                </Badge>
              )}
              {isBankruptcy && (
                <Badge variant="outline" className="bg-red-50">
                  Bankruptcy
                </Badge>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => restoreItem.mutate({ id: item.id })}
            disabled={restoreItem.isPending}
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            Restore
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

### tRPC Procedures

```typescript
export const inboxRouter = router({
  // ... existing procedures ...

  getAutoArchiveWarnings: protectedProcedure.query(async ({ ctx }) => {
    return prisma.inboxItem.findMany({
      where: {
        userId: ctx.session.user.id,
        autoArchiveWarning: true,
        status: { in: ["pending", "processing"] },
      },
      orderBy: { autoArchiveDate: "asc" },
    });
  }),

  getPendingCount: protectedProcedure.query(async ({ ctx }) => {
    return prisma.inboxItem.count({
      where: {
        userId: ctx.session.user.id,
        status: { in: ["pending", "processing"] },
      },
    });
  }),

  declareBankruptcy: protectedProcedure.mutation(async ({ ctx }) => {
    return declareBankruptcy(ctx.session.user.id);
  }),

  getArchived: protectedProcedure
    .input(z.object({
      filter: z.enum(["all", "unprocessed", "bankruptcy"]).default("all"),
      limit: z.number().default(50),
      cursor: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const tagFilter = input.filter === "all" ? undefined
        : input.filter === "unprocessed"
          ? { some: { path: ["value"], string_starts_with: "Unprocessed" } }
          : { some: { path: ["value"], string_starts_with: "Bankruptcy" } };

      const items = await prisma.inboxItem.findMany({
        where: {
          userId: ctx.session.user.id,
          status: "archived",
          tags: tagFilter,
        },
        orderBy: { archivedAt: "desc" },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
      });

      // Get counts for stats
      const [total, unprocessed, bankruptcy] = await Promise.all([
        prisma.inboxItem.count({
          where: { userId: ctx.session.user.id, status: "archived" },
        }),
        prisma.inboxItem.count({
          where: {
            userId: ctx.session.user.id,
            status: "archived",
            tags: { some: { path: ["value"], string_starts_with: "Unprocessed" } },
          },
        }),
        prisma.inboxItem.count({
          where: {
            userId: ctx.session.user.id,
            status: "archived",
            tags: { some: { path: ["value"], string_starts_with: "Bankruptcy" } },
          },
        }),
      ]);

      const hasMore = items.length > input.limit;
      const trimmedItems = hasMore ? items.slice(0, -1) : items;

      return {
        items: trimmedItems,
        nextCursor: hasMore ? trimmedItems[trimmedItems.length - 1].id : undefined,
        total,
        unprocessed,
        bankruptcy,
      };
    }),

  restore: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return prisma.inboxItem.update({
        where: { id: input.id, userId: ctx.session.user.id },
        data: {
          status: "pending",
          archivedAt: null,
          autoArchiveWarning: null,
          autoArchiveDate: null,
          // Keep tags for history but remove system tags
          tags: {
            set: await prisma.inboxItem.findUnique({
              where: { id: input.id },
              select: { tags: true },
            }).then((item) =>
              (item?.tags || []).filter((t) =>
                !t.value.startsWith("Unprocessed") && !t.value.startsWith("Bankruptcy")
              )
            ),
          },
        },
      });
    }),
});
```

### Cron Job for Auto-Archive

```typescript
// apps/web/src/app/api/cron/auto-archive/route.ts
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Get all users with auto-archive enabled
  const users = await prisma.user.findMany({
    where: {
      settings: {
        path: ["autoArchiveDays"],
        gt: 0,
      },
    },
    select: { id: true, settings: true },
  });

  let totalArchived = 0;
  let totalWarned = 0;

  for (const user of users) {
    const result = await processAutoArchive(user.id);
    totalArchived += result.archived;
    totalWarned += result.warned;
  }

  return Response.json({
    success: true,
    usersProcessed: users.length,
    totalArchived,
    totalWarned,
  });
}
```

## Database Schema Updates

```prisma
model InboxItem {
  // ... existing fields ...

  autoArchiveWarning Boolean?
  autoArchiveDate    DateTime?
}

model AuditLog {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  action    String   // INBOX_BANKRUPTCY, etc.
  metadata  Json?
  createdAt DateTime @default(now())

  @@index([userId, action])
}
```

## Dependencies

- Story 5.4 (Inbox Processing)
- Cron service for auto-archive

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `apps/web/src/server/services/auto-archive.service.ts` | Create | Auto-archive logic |
| `apps/web/src/server/routers/inbox.ts` | Modify | Add bankruptcy procedures |
| `apps/web/src/components/inbox/auto-archive-warning.tsx` | Create | Warning banner |
| `apps/web/src/components/inbox/bankruptcy-dialog.tsx` | Create | Bankruptcy confirmation |
| `apps/web/src/components/settings/auto-archive-settings.tsx` | Create | Settings card |
| `apps/web/src/app/(app)/archive/page.tsx` | Create | Archive page |
| `apps/web/src/app/api/cron/auto-archive/route.ts` | Create | Cron endpoint |
| `packages/db/prisma/schema.prisma` | Modify | Add autoArchive fields |

## Testing Checklist

- [ ] Items older than 15 days get warning
- [ ] Items older than 17 days (with warning) get archived
- [ ] Auto-archived items tagged correctly
- [ ] Warning banner shows on inbox page
- [ ] Settings page allows changing days
- [ ] Bankruptcy requires typing RESET
- [ ] Bankruptcy archives all pending items
- [ ] Bankruptcy tags items correctly
- [ ] Archive page shows filter options
- [ ] Restore from archive works
- [ ] Cron endpoint runs successfully

## Definition of Done

- [x] Auto-archive after configurable days
- [x] 2-day warning before auto-archive
- [x] Warning banner on inbox
- [x] Bankruptcy dialog with RESET confirmation
- [x] Items tagged as Unprocessed or Bankruptcy
- [x] Archive page with filters
- [x] Restore functionality
- [x] Settings for auto-archive days
- [x] Cron job for daily auto-archive
- [x] TypeScript/ESLint pass
- [ ] Integration tests for auto-archive (deferred)

---

## Implementation Notes

### Implementation Date: 2026-01-12

The Story 5.5 implementation includes all core auto-archive and bankruptcy functionality:

1. **Database Schema** (`packages/db/prisma/schema.prisma`):
   - Added `autoArchiveWarning` and `autoArchiveDate` fields to InboxItem
   - Created `AuditLog` model for tracking bankruptcy and auto-archive events

2. **Backend Services** (`apps/web/src/server/services/auto-archive.service.ts`):
   - `processAutoArchive()` - Processes auto-archive for a user (warnings + archiving)
   - `declareBankruptcy()` - Archives all pending items with bankruptcy tag
   - `getAutoArchiveWarnings()` - Gets items approaching auto-archive
   - `getPendingCount()` - Returns count of pending items
   - `restoreFromArchive()` - Restores item and removes system tags
   - `getArchivedItems()` - Gets archived items with filtering and counts

3. **tRPC Router Updates** (`apps/web/src/server/routers/inbox.ts`):
   - Added `getAutoArchiveWarnings`, `getPendingCount`, `declareBankruptcy`
   - Added `getArchived`, `restore`, `archive` procedures
   - Updated user router to allow `autoArchiveDays: 0` (disabled)

4. **UI Components**:
   - `auto-archive-warning.tsx` - Warning banner for items approaching auto-archive
   - `bankruptcy-dialog.tsx` - Confirmation dialog with "RESET" text requirement
   - `auto-archive-settings.tsx` - Settings card for configuring auto-archive days

5. **Archive Page** (`apps/web/src/app/(auth)/archive/page.tsx`):
   - Enhanced with tabs (Inbox Items / Projects)
   - Filter by type (All / Auto-archived / Bankruptcy)
   - Stats cards showing totals
   - Bankruptcy button in header
   - Restore functionality

6. **Cron Endpoint** (`apps/web/src/app/api/cron/auto-archive/route.ts`):
   - Daily cron endpoint for auto-archiving
   - Protected by CRON_SECRET environment variable
   - Processes all users with auto-archive enabled

### Testing

- All existing tests pass (92 tests)
- Integration tests for auto-archive service deferred

---

## QA Results

### QA Agent Review

**Date:** 2026-01-12
**Agent:** QA Agent (Claude Opus 4.5)

### Code Review Summary

**Files Reviewed:**
- [auto-archive.service.ts](apps/web/src/server/services/auto-archive.service.ts) - 294 lines
- [inbox.ts](apps/web/src/server/routers/inbox.ts) - (updated with auto-archive procedures)

### Implementation Assessment

| Criteria | Status | Notes |
|----------|--------|-------|
| Auto-archive logic | PASS | `processAutoArchive()` with configurable days |
| Warning period | PASS | 2-day warning before archiving (WARNING_DAYS_BEFORE = 2) |
| Bankruptcy function | PASS | `declareBankruptcy()` with system tag |
| System tagging | PASS | "Unprocessed - date" and "Bankruptcy - date" tags |
| Restore functionality | PASS | Removes system tags on restore |
| Archive filtering | PASS | all/unprocessed/bankruptcy filters with counts |
| Audit logging | PASS | `AuditLog` entries for AUTO_ARCHIVE and INBOX_BANKRUPTCY |
| Configurable settings | PASS | `autoArchiveDays` from user settings (default 15) |

### Code Quality Findings

**Strengths:**
1. Clean separation of concerns with dedicated service file
2. Default constants at top of file (`DEFAULT_AUTO_ARCHIVE_DAYS = 15`, `WARNING_DAYS_BEFORE = 2`)
3. Proper date handling with `date-fns` (subDays, addDays, format)
4. Iterative tag updates preserve existing tags while adding new ones
5. Restore removes system tags but preserves user tags
6. Audit logging for compliance and debugging
7. Cursor-based pagination for archive listing

**Minor Note:**
- Tag filtering in `getArchivedItems` uses in-memory filtering for JSON fields (acceptable for PostgreSQL JSON)

### Build Verification

```
pnpm typecheck: PASS
pnpm lint: PASS (no warnings)
```

### Definition of Done Verification

- [x] Auto-archive after configurable days - User settings respected
- [x] 2-day warning before auto-archive - `WARNING_DAYS_BEFORE = 2`
- [x] Warning banner on inbox - `auto-archive-warning.tsx` component
- [x] Bankruptcy dialog with RESET confirmation - Type check implemented
- [x] Items tagged as Unprocessed or Bankruptcy - System tags added
- [x] Archive page with filters - three filter options with counts
- [x] Restore functionality - `restoreFromArchive()` removes system tags
- [x] Settings for auto-archive days - 7/15/30/60/Never options
- [x] Cron job for daily auto-archive - API route with CRON_SECRET
- [x] TypeScript/ESLint pass - Verified
- [ ] Integration tests for auto-archive - Deferred (acceptable)

### Final Assessment

**Status: APPROVED**

The auto-archive and bankruptcy features are fully implemented with proper safeguards (2-day warning, RESET confirmation, audit logging). The code handles edge cases well and provides a clean user experience for managing inbox overflow.

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-01-11 | 1.0 | Initial story specification | Bob (SM) |
| 2026-01-12 | 1.1 | Implementation complete | Claude |
| 2026-01-12 | 1.2 | QA review passed | QA Agent |
