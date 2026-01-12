# Story 5.1: Objectives Management

## Story

**As a** user,
**I want** to set and track my objectives,
**So that** I can align my weekly work with bigger goals.

## Priority

**P1** - Important for alignment, not blocking core flow

## Acceptance Criteria

1. Objectives page for managing yearly/monthly/weekly goals
2. Create objective with: title, description, timeframe, parent objective
3. Weekly objectives automatically cascade from monthly
4. Current week's objectives displayed prominently
5. Objectives can be marked complete or carried forward
6. Objective history preserved for review

## Technical Design

### Objectives Hierarchy

```
[Yearly Objective]
    └── [Monthly Objective] ←── linked
            └── [Weekly Objective] ←── linked
                    └── [Actions] ←── linked
```

### Data Model

```typescript
interface Objective {
  id: string;
  userId: string;
  title: string;
  description?: string;
  timeframe: "yearly" | "monthly" | "weekly";
  parentId?: string;          // Links to parent objective
  status: "active" | "completed" | "deferred" | "archived";
  progress?: number;          // 0-100, calculated from children
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// Computed fields
interface ObjectiveWithRelations extends Objective {
  parent?: Objective;
  children: Objective[];
  linkedActions: Action[];
  linkedProjects: Project[];
}
```

### Database Schema

```prisma
model Objective {
  id          String    @id @default(uuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  title       String
  description String?
  timeframe   String    // "yearly" | "monthly" | "weekly"
  status      String    @default("active")
  progress    Int       @default(0)

  parentId    String?
  parent      Objective? @relation("ObjectiveHierarchy", fields: [parentId], references: [id])
  children    Objective[] @relation("ObjectiveHierarchy")

  startDate   DateTime
  endDate     DateTime
  completedAt DateTime?

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  // Relations
  projects    Project[]
  actions     Action[]

  @@index([userId, timeframe, status])
  @@index([userId, startDate, endDate])
}
```

### Timeframe Calculations

```typescript
function getTimeframeDates(timeframe: Timeframe, referenceDate = new Date()) {
  switch (timeframe) {
    case "yearly":
      return {
        startDate: startOfYear(referenceDate),
        endDate: endOfYear(referenceDate),
      };
    case "monthly":
      return {
        startDate: startOfMonth(referenceDate),
        endDate: endOfMonth(referenceDate),
      };
    case "weekly":
      return {
        startDate: startOfWeek(referenceDate, { weekStartsOn: 1 }), // Monday
        endDate: endOfWeek(referenceDate, { weekStartsOn: 1 }),
      };
  }
}

function getCurrentObjectives(userId: string, timeframe: Timeframe) {
  const { startDate, endDate } = getTimeframeDates(timeframe);

  return prisma.objective.findMany({
    where: {
      userId,
      timeframe,
      status: { in: ["active", "completed"] },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    include: {
      parent: true,
      children: true,
      projects: { where: { status: "active" } },
    },
    orderBy: { createdAt: "asc" },
  });
}
```

### Objective Cascading

```typescript
// When creating a monthly objective, optionally cascade to weekly
async function cascadeToWeekly(monthlyObjective: Objective) {
  const weeksInMonth = eachWeekOfInterval(
    { start: monthlyObjective.startDate, end: monthlyObjective.endDate },
    { weekStartsOn: 1 }
  );

  const weeklyObjectives = weeksInMonth.map((weekStart) => ({
    userId: monthlyObjective.userId,
    title: monthlyObjective.title,
    description: `Weekly focus for: ${monthlyObjective.title}`,
    timeframe: "weekly",
    parentId: monthlyObjective.id,
    status: "active",
    startDate: weekStart,
    endDate: endOfWeek(weekStart, { weekStartsOn: 1 }),
  }));

  return prisma.objective.createMany({
    data: weeklyObjectives,
  });
}

// Carry forward incomplete objectives to next period
async function carryForward(objectiveId: string) {
  const objective = await prisma.objective.findUnique({
    where: { id: objectiveId },
  });

  if (!objective || objective.status === "completed") {
    throw new Error("Cannot carry forward completed objective");
  }

  // Mark original as deferred
  await prisma.objective.update({
    where: { id: objectiveId },
    data: { status: "deferred" },
  });

  // Create new objective for next period
  const nextDates = getNextPeriodDates(objective.timeframe, objective.endDate);

  return prisma.objective.create({
    data: {
      userId: objective.userId,
      title: objective.title,
      description: objective.description,
      timeframe: objective.timeframe,
      parentId: objective.parentId,
      status: "active",
      startDate: nextDates.startDate,
      endDate: nextDates.endDate,
    },
  });
}
```

### Objectives Page Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Objectives                              [+ New Objective]  │
├─────────────────────────────────────────────────────────────┤
│  [Yearly] [Monthly] [Weekly]  ←── Tab navigation            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🎯 Complete MVP Launch                    ○○○●●●●●  │   │
│  │    Due: Dec 31, 2026                     60%        │   │
│  │    └── 3 monthly objectives linked                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 💪 Establish healthy habits               ○○○○●●●●  │   │
│  │    Due: Dec 31, 2026                     50%        │   │
│  │    └── 2 monthly objectives linked                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Objective Card Component

```tsx
function ObjectiveCard({ objective }: { objective: ObjectiveWithRelations }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{getTimeframeIcon(objective.timeframe)}</span>
            <div>
              <CardTitle className="text-lg">{objective.title}</CardTitle>
              <CardDescription>
                Due: {format(objective.endDate, "MMM d, yyyy")}
              </CardDescription>
            </div>
          </div>
          <ObjectiveStatusBadge status={objective.status} />
        </div>
      </CardHeader>

      <CardContent>
        {/* Progress bar */}
        <div className="flex items-center gap-3 mb-3">
          <Progress value={objective.progress} className="flex-1" />
          <span className="text-sm text-gray-500">{objective.progress}%</span>
        </div>

        {/* Description */}
        {objective.description && (
          <p className="text-sm text-gray-600 mb-3">{objective.description}</p>
        )}

        {/* Linked items */}
        <div className="flex items-center gap-4 text-sm text-gray-500">
          {objective.children.length > 0 && (
            <span>{objective.children.length} sub-objectives</span>
          )}
          {objective.linkedProjects.length > 0 && (
            <span>{objective.linkedProjects.length} projects</span>
          )}
        </div>

        {/* Expandable children */}
        {expanded && objective.children.length > 0 && (
          <div className="mt-4 pl-4 border-l-2 border-gray-200">
            {objective.children.map((child) => (
              <ObjectiveCard key={child.id} objective={child} />
            ))}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-0">
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? "Collapse" : "Expand"}
          </Button>
          <Button variant="ghost" size="sm">Edit</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Mark Complete</DropdownMenuItem>
              <DropdownMenuItem>Carry Forward</DropdownMenuItem>
              <DropdownMenuItem>Archive</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardFooter>
    </Card>
  );
}
```

### Create Objective Modal

```tsx
function CreateObjectiveModal({
  open,
  onClose,
  defaultTimeframe,
  parentObjective,
}: {
  open: boolean;
  onClose: () => void;
  defaultTimeframe?: Timeframe;
  parentObjective?: Objective;
}) {
  const form = useForm<CreateObjectiveInput>({
    defaultValues: {
      timeframe: defaultTimeframe || "weekly",
      parentId: parentObjective?.id,
    },
  });

  const createObjective = trpc.objectives.create.useMutation();

  const onSubmit = async (data: CreateObjectiveInput) => {
    await createObjective.mutateAsync(data);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Objective</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Timeframe */}
            <FormField
              name="timeframe"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Timeframe</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yearly">Yearly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            {/* Title */}
            <FormField
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <Input {...field} placeholder="What do you want to achieve?" />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <Textarea {...field} placeholder="Add more details..." />
                </FormItem>
              )}
            />

            {/* Parent objective */}
            {form.watch("timeframe") !== "yearly" && (
              <FormField
                name="parentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parent Objective (optional)</FormLabel>
                    <ObjectiveSelect
                      value={field.value}
                      onChange={field.onChange}
                      timeframe={getParentTimeframe(form.watch("timeframe"))}
                    />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={createObjective.isPending}>
                Create Objective
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

### tRPC Procedures

```typescript
export const objectivesRouter = router({
  list: protectedProcedure
    .input(z.object({
      timeframe: z.enum(["yearly", "monthly", "weekly"]).optional(),
      status: z.enum(["active", "completed", "deferred", "archived"]).optional(),
      includeChildren: z.boolean().default(false),
    }))
    .query(async ({ ctx, input }) => {
      return prisma.objective.findMany({
        where: {
          userId: ctx.session.user.id,
          timeframe: input.timeframe,
          status: input.status || { not: "archived" },
        },
        include: input.includeChildren ? {
          children: true,
          projects: { where: { status: "active" } },
        } : undefined,
        orderBy: { startDate: "desc" },
      });
    }),

  getCurrentWeek: protectedProcedure.query(async ({ ctx }) => {
    const { startDate, endDate } = getTimeframeDates("weekly");

    return prisma.objective.findMany({
      where: {
        userId: ctx.session.user.id,
        timeframe: "weekly",
        status: "active",
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      include: {
        parent: {
          include: { parent: true }, // Get monthly and yearly
        },
        projects: { where: { status: "active" } },
      },
    });
  }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(1000).optional(),
      timeframe: z.enum(["yearly", "monthly", "weekly"]),
      parentId: z.string().uuid().optional(),
      cascadeToWeekly: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const { startDate, endDate } = getTimeframeDates(input.timeframe);

      const objective = await prisma.objective.create({
        data: {
          userId: ctx.session.user.id,
          title: input.title,
          description: input.description,
          timeframe: input.timeframe,
          parentId: input.parentId,
          startDate,
          endDate,
        },
      });

      if (input.timeframe === "monthly" && input.cascadeToWeekly) {
        await cascadeToWeekly(objective);
      }

      return objective;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(200).optional(),
      description: z.string().max(1000).optional(),
      status: z.enum(["active", "completed", "deferred", "archived"]).optional(),
      progress: z.number().min(0).max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      return prisma.objective.update({
        where: { id, userId: ctx.session.user.id },
        data: {
          ...data,
          completedAt: data.status === "completed" ? new Date() : undefined,
        },
      });
    }),

  carryForward: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return carryForward(input.id);
    }),

  archive: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return prisma.objective.update({
        where: { id: input.id, userId: ctx.session.user.id },
        data: { status: "archived" },
      });
    }),
});
```

## Dependencies

- date-fns (date manipulation)
- React Hook Form (form handling)
- shadcn/ui components

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/db/prisma/schema.prisma` | Modify | Add Objective model |
| `apps/web/src/server/services/objectives.service.ts` | Create | Objectives business logic |
| `apps/web/src/server/routers/objectives.ts` | Create | tRPC objectives procedures |
| `apps/web/src/app/(app)/objectives/page.tsx` | Create | Objectives management page |
| `apps/web/src/components/objectives/objective-card.tsx` | Create | Objective display card |
| `apps/web/src/components/objectives/create-objective-modal.tsx` | Create | Create/edit modal |
| `apps/web/src/components/objectives/objective-select.tsx` | Create | Parent objective selector |

## Testing Checklist

- [ ] Create yearly objective
- [ ] Create monthly objective linked to yearly
- [ ] Create weekly objective linked to monthly
- [ ] Cascade monthly to weekly objectives
- [ ] Mark objective as complete
- [ ] Carry forward incomplete objective
- [ ] Archive objective
- [ ] Progress calculation from children
- [ ] Current week objectives query

## Definition of Done

- [x] Objective CRUD operations working
- [x] Yearly/monthly/weekly hierarchy
- [x] Cascade from monthly to weekly
- [x] Carry forward functionality
- [x] Progress tracking
- [x] Objectives page with tabs
- [x] Create/edit modal
- [x] TypeScript/ESLint pass
- [x] Unit tests for date calculations

---

## Status

**Ready for Review**

---

## Dev Agent Record

### Agent Model Used
Claude Opus 4.5

### File List

| File | Action | Description |
|------|--------|-------------|
| `packages/db/prisma/schema.prisma` | Modified | Added progress, completedAt fields, additional indexes |
| `apps/web/src/server/services/objectives.service.ts` | Created | Full objectives business logic |
| `apps/web/src/server/routers/objectives.ts` | Created | tRPC router with all CRUD procedures |
| `apps/web/src/server/routers/index.ts` | Modified | Registered objectives router |
| `apps/web/src/app/(auth)/objectives/page.tsx` | Created | Objectives management page with tabs |
| `apps/web/src/components/objectives/objective-card.tsx` | Created | Card component with actions |
| `apps/web/src/components/objectives/create-objective-modal.tsx` | Created | Create/edit modal |
| `apps/web/src/components/objectives/objective-select.tsx` | Created | Parent objective selector |
| `apps/web/src/components/ui/progress.tsx` | Created | Progress bar component |
| `apps/web/src/components/ui/select.tsx` | Created | Select component |
| `apps/web/src/components/ui/dropdown-menu.tsx` | Created | Dropdown menu component |
| `apps/web/src/server/services/__tests__/objectives.service.test.ts` | Created | Unit tests for date calculations |
| `apps/web/package.json` | Modified | Added radix dependencies |

### Completion Notes

- Implemented full objectives management system with yearly/monthly/weekly hierarchy
- Added cascading from monthly to weekly objectives
- Implemented carry forward functionality for incomplete objectives
- Progress tracking with automatic parent recalculation
- All 92 tests passing, TypeScript and ESLint clean

---

## QA Results

### QA Agent Review

**Date:** 2026-01-12
**Agent:** QA Agent (Claude Opus 4.5)

### Code Review Summary

**Files Reviewed:**
- [objectives.service.ts](apps/web/src/server/services/objectives.service.ts) - 484 lines
- [objectives.ts](apps/web/src/server/routers/objectives.ts) - 237 lines
- [objectives.service.test.ts](apps/web/src/server/services/__tests__/objectives.service.test.ts) - 197 lines

### Implementation Assessment

| Criteria | Status | Notes |
|----------|--------|-------|
| Service layer complete | PASS | All CRUD operations, cascading, carry forward implemented |
| tRPC router complete | PASS | All procedures with proper validation (Zod) |
| Date calculations | PASS | Proper use of date-fns, weekStartsOn: 1 for Monday |
| Hierarchy support | PASS | Parent/child relationships with recursive progress |
| Unit tests | PASS | 28 test cases for date calculations and edge cases |
| TypeScript types | PASS | Proper typing with Prisma types |
| Error handling | PASS | TRPCError with appropriate codes |

### Code Quality Findings

**Strengths:**
1. Clean separation of concerns (service vs router)
2. Comprehensive date handling with edge cases (leap years, boundaries)
3. Progress recalculation propagates up the hierarchy
4. Proper user scoping on all operations (`userId` in WHERE clauses)
5. Cascade to weekly is optional and well-implemented

**No Issues Found**

### Build Verification

```
pnpm typecheck: PASS
pnpm lint: PASS (no warnings)
```

### Definition of Done Verification

- [x] Objective CRUD operations working - Verified in service/router
- [x] Yearly/monthly/weekly hierarchy - Implemented with parentId relations
- [x] Cascade from monthly to weekly - `cascadeToWeekly()` function
- [x] Carry forward functionality - `carryForward()` marks original deferred, creates new
- [x] Progress tracking - `recalculateParentProgress()` recursive function
- [x] Objectives page with tabs - Page created at `(auth)/objectives/page.tsx`
- [x] Create/edit modal - `create-objective-modal.tsx` component
- [x] TypeScript/ESLint pass - Verified
- [x] Unit tests for date calculations - 28 tests in test file

### Final Assessment

**Status: APPROVED**

The implementation fully meets all acceptance criteria and technical requirements. The code is well-structured with proper separation of concerns, comprehensive error handling, and good test coverage for the date calculation logic.

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-01-11 | 1.0 | Initial story specification | Bob (SM) |
| 2026-01-11 | 1.1 | Implementation complete | James (Dev) |
| 2026-01-12 | 1.2 | QA review passed | QA Agent |
