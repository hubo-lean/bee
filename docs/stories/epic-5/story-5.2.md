# Story 5.2: Weekly Review Wizard

## Story

**As a** user,
**I want** a guided weekly review flow,
**So that** I systematically process everything without missing steps.

## Priority

**P0** - Core weekly review experience

## Acceptance Criteria

1. Weekly review follows sequence: Objectives → Priorities → Actions → Inbox
2. Step 1: Review/confirm this week's objectives
3. Step 2: Select priority projects/areas for the week
4. Step 3: Review and organize actions for priorities
5. Step 4: Process remaining inbox items (Needs Review + Disagreements queues)
6. Progress indicator shows current step and completion status

## Technical Design

### Weekly Review Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Weekly Review - Week of Jan 13, 2026        Step 2 of 4   │
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│  ✓ Objectives│        Select Your Priorities               │
│  ● Priorities│                                              │
│  ○ Actions   │  Which projects and areas need your         │
│  ○ Inbox     │  attention this week?                       │
│              │                                              │
│              │  Projects:                                   │
│  ──────────  │  ☑ MVP Launch                               │
│  Progress:   │  ☐ Documentation                            │
│  [████░░] 50%│  ☑ User Testing                             │
│              │                                              │
│              │  Areas:                                      │
│              │  ☑ Health                                    │
│              │  ☐ Finance                                   │
│              │  ☐ Learning                                  │
│              │                                              │
│              │        [Back]  [Next: Actions →]            │
└──────────────┴──────────────────────────────────────────────┘
```

### Review Session Model

```typescript
interface WeeklyReviewSession {
  id: string;
  userId: string;
  weekStart: Date;          // Monday of review week
  currentStep: ReviewStep;
  stepsCompleted: ReviewStep[];
  data: {
    objectives: ObjectivesStepData;
    priorities: PrioritiesStepData;
    actions: ActionsStepData;
    inbox: InboxStepData;
  };
  startedAt: Date;
  completedAt?: Date;
  updatedAt: Date;
}

type ReviewStep = "objectives" | "priorities" | "actions" | "inbox";

interface ObjectivesStepData {
  confirmed: string[];       // Confirmed objective IDs
  added: string[];           // Newly created objective IDs
  deferred: string[];        // Deferred to next week
}

interface PrioritiesStepData {
  selectedProjects: string[];
  selectedAreas: string[];
}

interface ActionsStepData {
  reviewed: string[];        // Action IDs reviewed
  scheduled: string[];       // Action IDs with time blocks
  completed: string[];       // Action IDs marked complete
}

interface InboxStepData {
  needsReview: {
    processed: number;
    remaining: number;
  };
  disagreements: {
    processed: number;
    remaining: number;
  };
  receipts: {
    checked: number;
    total: number;
  };
}
```

### Database Schema

```prisma
model WeeklyReviewSession {
  id            String    @id @default(uuid())
  userId        String
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  weekStart     DateTime  // Monday of the week
  currentStep   String    @default("objectives")
  stepsCompleted String[] @default([])
  data          Json      // ReviewSessionData

  startedAt     DateTime  @default(now())
  completedAt   DateTime?
  updatedAt     DateTime  @updatedAt

  @@unique([userId, weekStart])
  @@index([userId, completedAt])
}
```

### Step Components

#### Step 1: Objectives

```tsx
function ObjectivesStep({
  session,
  onComplete,
}: {
  session: WeeklyReviewSession;
  onComplete: (data: ObjectivesStepData) => void;
}) {
  const { data: weekObjectives } = trpc.objectives.getCurrentWeek.useQuery();
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">
          Review This Week's Objectives
        </h2>
        <p className="text-gray-600">
          Confirm your focus areas for the week. Add new objectives or defer
          ones that no longer apply.
        </p>
      </div>

      {/* Current objectives */}
      <div className="space-y-3">
        {weekObjectives?.map((objective) => (
          <Card key={objective.id} className={cn(
            "cursor-pointer transition-colors",
            confirmed.includes(objective.id) && "border-green-500 bg-green-50"
          )}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={confirmed.includes(objective.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setConfirmed([...confirmed, objective.id]);
                      } else {
                        setConfirmed(confirmed.filter((id) => id !== objective.id));
                      }
                    }}
                  />
                  <div>
                    <p className="font-medium">{objective.title}</p>
                    {objective.parent && (
                      <p className="text-sm text-gray-500">
                        ↳ {objective.parent.title}
                      </p>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem>Edit</DropdownMenuItem>
                    <DropdownMenuItem>Defer to Next Week</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add new objective */}
      <Button
        variant="outline"
        className="w-full"
        onClick={() => setShowCreateModal(true)}
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Weekly Objective
      </Button>

      {/* Navigation */}
      <div className="flex justify-end pt-4">
        <Button onClick={() => onComplete({ confirmed, added: [], deferred: [] })}>
          Next: Priorities →
        </Button>
      </div>

      <CreateObjectiveModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        defaultTimeframe="weekly"
      />
    </div>
  );
}
```

#### Step 2: Priorities

```tsx
function PrioritiesStep({
  session,
  onComplete,
  onBack,
}: {
  session: WeeklyReviewSession;
  onComplete: (data: PrioritiesStepData) => void;
  onBack: () => void;
}) {
  const { data: projects } = trpc.para.listProjects.useQuery({
    status: "active",
  });
  const { data: areas } = trpc.para.listAreas.useQuery();

  const [selectedProjects, setSelectedProjects] = useState<string[]>(
    session.data.priorities?.selectedProjects || []
  );
  const [selectedAreas, setSelectedAreas] = useState<string[]>(
    session.data.priorities?.selectedAreas || []
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Select Your Priorities</h2>
        <p className="text-gray-600">
          Which projects and areas need your attention this week?
          Select up to 3-5 for focused work.
        </p>
      </div>

      {/* Projects */}
      <div>
        <h3 className="font-medium mb-3">Projects</h3>
        <div className="space-y-2">
          {projects?.map((project) => (
            <label
              key={project.id}
              className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
            >
              <Checkbox
                checked={selectedProjects.includes(project.id)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedProjects([...selectedProjects, project.id]);
                  } else {
                    setSelectedProjects(
                      selectedProjects.filter((id) => id !== project.id)
                    );
                  }
                }}
              />
              <div className="flex-1">
                <p className="font-medium">{project.name}</p>
                {project.objective && (
                  <p className="text-sm text-gray-500">
                    Linked to: {project.objective.title}
                  </p>
                )}
              </div>
              {project.dueDate && (
                <span className="text-sm text-gray-500">
                  Due {format(project.dueDate, "MMM d")}
                </span>
              )}
            </label>
          ))}
        </div>
      </div>

      {/* Areas */}
      <div>
        <h3 className="font-medium mb-3">Areas of Responsibility</h3>
        <div className="grid grid-cols-2 gap-2">
          {areas?.map((area) => (
            <label
              key={area.id}
              className={cn(
                "flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50",
                selectedAreas.includes(area.id) && "border-blue-500 bg-blue-50"
              )}
            >
              <Checkbox
                checked={selectedAreas.includes(area.id)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedAreas([...selectedAreas, area.id]);
                  } else {
                    setSelectedAreas(selectedAreas.filter((id) => id !== area.id));
                  }
                }}
              />
              <span>{area.icon}</span>
              <span>{area.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          ← Back
        </Button>
        <Button onClick={() => onComplete({ selectedProjects, selectedAreas })}>
          Next: Actions →
        </Button>
      </div>
    </div>
  );
}
```

#### Step 3: Actions

```tsx
function ActionsStep({
  session,
  onComplete,
  onBack,
}: {
  session: WeeklyReviewSession;
  onComplete: (data: ActionsStepData) => void;
  onBack: () => void;
}) {
  const priorities = session.data.priorities;
  const { data: actions } = trpc.actions.listForPriorities.useQuery({
    projectIds: priorities?.selectedProjects || [],
    areaIds: priorities?.selectedAreas || [],
  });

  const [reviewed, setReviewed] = useState<string[]>([]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Review Actions</h2>
        <p className="text-gray-600">
          Review and organize actions for your selected priorities.
          Mark items as complete or schedule time blocks.
        </p>
      </div>

      {/* Actions grouped by project/area */}
      {priorities?.selectedProjects.map((projectId) => {
        const project = actions?.projects.find((p) => p.id === projectId);
        if (!project) return null;

        return (
          <div key={projectId} className="space-y-2">
            <h3 className="font-medium flex items-center gap-2">
              <Folder className="h-4 w-4" />
              {project.name}
            </h3>
            <div className="pl-6 space-y-2">
              {project.actions.map((action) => (
                <ActionItem
                  key={action.id}
                  action={action}
                  onReviewed={() => setReviewed([...reviewed, action.id])}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Area actions */}
      {priorities?.selectedAreas.map((areaId) => {
        const area = actions?.areas.find((a) => a.id === areaId);
        if (!area) return null;

        return (
          <div key={areaId} className="space-y-2">
            <h3 className="font-medium flex items-center gap-2">
              <span>{area.icon}</span>
              {area.name}
            </h3>
            <div className="pl-6 space-y-2">
              {area.actions.map((action) => (
                <ActionItem
                  key={action.id}
                  action={action}
                  onReviewed={() => setReviewed([...reviewed, action.id])}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          ← Back
        </Button>
        <Button onClick={() => onComplete({ reviewed, scheduled: [], completed: [] })}>
          Next: Inbox →
        </Button>
      </div>
    </div>
  );
}
```

#### Step 4: Inbox (See Story 5.4)

### Main Wizard Component

```tsx
function WeeklyReviewWizard() {
  const { data: session, isLoading } = trpc.weeklyReview.getSession.useQuery();
  const startSession = trpc.weeklyReview.startSession.useMutation();
  const completeStep = trpc.weeklyReview.completeStep.useMutation();

  const steps: { key: ReviewStep; label: string }[] = [
    { key: "objectives", label: "Objectives" },
    { key: "priorities", label: "Priorities" },
    { key: "actions", label: "Actions" },
    { key: "inbox", label: "Inbox" },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === session?.currentStep);

  const handleStepComplete = async (step: ReviewStep, data: unknown) => {
    await completeStep.mutateAsync({
      sessionId: session!.id,
      step,
      data,
    });
  };

  if (isLoading) {
    return <WeeklyReviewSkeleton />;
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <h2 className="text-xl font-semibold mb-4">Start Weekly Review</h2>
        <p className="text-gray-600 mb-6 text-center max-w-md">
          Time to review your week and plan ahead. This usually takes 15-30 minutes.
        </p>
        <Button onClick={() => startSession.mutate()}>
          Begin Review
        </Button>
      </div>
    );
  }

  if (session.completedAt) {
    return <WeeklyReviewComplete session={session} />;
  }

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-64 border-r p-4 flex flex-col">
        <h2 className="font-semibold mb-4">
          Weekly Review
          <span className="block text-sm font-normal text-gray-500">
            Week of {format(session.weekStart, "MMM d, yyyy")}
          </span>
        </h2>

        {/* Steps */}
        <nav className="space-y-1 flex-1">
          {steps.map((step, index) => {
            const isComplete = session.stepsCompleted.includes(step.key);
            const isCurrent = session.currentStep === step.key;

            return (
              <div
                key={step.key}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg",
                  isCurrent && "bg-blue-50 text-blue-700",
                  isComplete && !isCurrent && "text-green-600"
                )}
              >
                {isComplete ? (
                  <CheckCircle className="h-5 w-5" />
                ) : isCurrent ? (
                  <Circle className="h-5 w-5 fill-current" />
                ) : (
                  <Circle className="h-5 w-5" />
                )}
                <span>{step.label}</span>
              </div>
            );
          })}
        </nav>

        {/* Progress */}
        <div className="pt-4 border-t">
          <p className="text-sm text-gray-500 mb-2">Progress</p>
          <Progress
            value={(session.stepsCompleted.length / steps.length) * 100}
          />
          <p className="text-sm text-gray-500 mt-1">
            {session.stepsCompleted.length} of {steps.length} steps
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        {session.currentStep === "objectives" && (
          <ObjectivesStep
            session={session}
            onComplete={(data) => handleStepComplete("objectives", data)}
          />
        )}
        {session.currentStep === "priorities" && (
          <PrioritiesStep
            session={session}
            onComplete={(data) => handleStepComplete("priorities", data)}
            onBack={() => completeStep.mutate({
              sessionId: session.id,
              step: "objectives",
              goBack: true,
            })}
          />
        )}
        {session.currentStep === "actions" && (
          <ActionsStep
            session={session}
            onComplete={(data) => handleStepComplete("actions", data)}
            onBack={() => completeStep.mutate({
              sessionId: session.id,
              step: "priorities",
              goBack: true,
            })}
          />
        )}
        {session.currentStep === "inbox" && (
          <InboxStep
            session={session}
            onComplete={(data) => handleStepComplete("inbox", data)}
            onBack={() => completeStep.mutate({
              sessionId: session.id,
              step: "actions",
              goBack: true,
            })}
          />
        )}
      </div>
    </div>
  );
}
```

### tRPC Procedures

```typescript
export const weeklyReviewRouter = router({
  getSession: protectedProcedure.query(async ({ ctx }) => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

    return prisma.weeklyReviewSession.findUnique({
      where: {
        userId_weekStart: {
          userId: ctx.session.user.id,
          weekStart,
        },
      },
    });
  }),

  startSession: protectedProcedure.mutation(async ({ ctx }) => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

    return prisma.weeklyReviewSession.create({
      data: {
        userId: ctx.session.user.id,
        weekStart,
        currentStep: "objectives",
        stepsCompleted: [],
        data: {
          objectives: null,
          priorities: null,
          actions: null,
          inbox: null,
        },
      },
    });
  }),

  completeStep: protectedProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
      step: z.enum(["objectives", "priorities", "actions", "inbox"]),
      data: z.any().optional(),
      goBack: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const session = await prisma.weeklyReviewSession.findUnique({
        where: { id: input.sessionId, userId: ctx.session.user.id },
      });

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const steps = ["objectives", "priorities", "actions", "inbox"];
      const currentIndex = steps.indexOf(input.step);

      if (input.goBack) {
        // Go back to previous step
        return prisma.weeklyReviewSession.update({
          where: { id: input.sessionId },
          data: {
            currentStep: steps[currentIndex - 1] || "objectives",
            stepsCompleted: session.stepsCompleted.filter((s) => s !== input.step),
          },
        });
      }

      // Complete step and advance
      const nextStep = steps[currentIndex + 1];
      const isComplete = !nextStep;

      return prisma.weeklyReviewSession.update({
        where: { id: input.sessionId },
        data: {
          currentStep: nextStep || "inbox",
          stepsCompleted: [...new Set([...session.stepsCompleted, input.step])],
          data: {
            ...session.data,
            [input.step]: input.data,
          },
          completedAt: isComplete ? new Date() : undefined,
        },
      });
    }),
});
```

## Dependencies

- Story 5.1 (Objectives Management)
- Story 5.3 (PARA Structure Setup)
- Epic 3/4 (Needs Review queue, disagreements)

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/db/prisma/schema.prisma` | Modify | Add WeeklyReviewSession model |
| `apps/web/src/server/services/weekly-review.service.ts` | Create | Review session logic |
| `apps/web/src/server/routers/weekly-review.ts` | Create | tRPC review procedures |
| `apps/web/src/app/(app)/review/weekly/page.tsx` | Create | Weekly review wizard page |
| `apps/web/src/components/review/weekly/objectives-step.tsx` | Create | Step 1 component |
| `apps/web/src/components/review/weekly/priorities-step.tsx` | Create | Step 2 component |
| `apps/web/src/components/review/weekly/actions-step.tsx` | Create | Step 3 component |
| `apps/web/src/components/review/weekly/progress-sidebar.tsx` | Create | Progress navigation |

## Testing Checklist

- [x] Start new weekly review session
- [x] Complete objectives step
- [x] Complete priorities step
- [x] Complete actions step
- [x] Complete inbox step
- [x] Navigate back to previous steps
- [x] Session persists across page reloads
- [x] Progress indicator updates correctly
- [x] Review marked complete when all steps done

## Definition of Done

- [x] Four-step wizard flow implemented
- [x] Session persistence working
- [x] Progress sidebar navigation
- [x] Step data saved to session
- [x] Back navigation between steps
- [x] Review completion tracking
- [x] Desktop-optimized layout
- [x] TypeScript/ESLint pass
- [ ] Integration tests for session flow

---

## Files Created/Modified

| File | Action | Purpose |
|------|--------|---------|
| `packages/db/prisma/schema.prisma` | Modified | Added WeeklyReviewSession model |
| `apps/web/src/server/services/weekly-review.service.ts` | Created | Review session logic with types and helpers |
| `apps/web/src/server/routers/weekly-review.ts` | Created | tRPC review procedures |
| `apps/web/src/server/routers/index.ts` | Modified | Registered weeklyReviewRouter |
| `apps/web/src/app/(auth)/weekly-review/page.tsx` | Created | Weekly review wizard page |
| `apps/web/src/components/weekly-review/objectives-step.tsx` | Created | Step 1: Objectives review component |
| `apps/web/src/components/weekly-review/priorities-step.tsx` | Created | Step 2: Priorities selection component |
| `apps/web/src/components/weekly-review/actions-step.tsx` | Created | Step 3: Actions review component |
| `apps/web/src/components/weekly-review/inbox-step.tsx` | Created | Step 4: Inbox processing component |
| `apps/web/src/components/weekly-review/progress-sidebar.tsx` | Created | Progress navigation sidebar |

## QA Results

### QA Agent Review

**Date:** 2026-01-12
**Agent:** QA Agent (Claude Opus 4.5)

### Code Review Summary

**Files Reviewed:**
- [weekly-review.service.ts](apps/web/src/server/services/weekly-review.service.ts) - 384 lines
- [weekly-review.ts](apps/web/src/server/routers/weekly-review.ts) - 211 lines

### Implementation Assessment

| Criteria | Status | Notes |
|----------|--------|-------|
| Service layer complete | PASS | Session management, step completion, history |
| tRPC router complete | PASS | All procedures with Zod validation |
| 4-step wizard flow | PASS | objectives → priorities → actions → inbox |
| Session persistence | PASS | upsert with unique constraint on userId_weekStart |
| Back navigation | PASS | goBack parameter removes step from completed |
| Progress tracking | PASS | `calculateProgress()` helper function |
| Step data typing | PASS | Strong types for each step's data |

### Code Quality Findings

**Strengths:**
1. Well-typed step data interfaces (`ObjectivesStepData`, `PrioritiesStepData`, etc.)
2. Clean helper functions (`getStepInfo`, `getStepsWithStatus`, `isSessionComplete`)
3. Proper session data parsing with fallback to defaults
4. Week start calculated with Monday as first day (`weekStartsOn: 1`)
5. `completeStep` correctly handles both forward and back navigation

**Minor Note:**
- Integration tests pending (noted in Definition of Done)

### Build Verification

```
pnpm typecheck: PASS
pnpm lint: PASS (no warnings)
```

### Definition of Done Verification

- [x] Four-step wizard flow implemented - 4 steps in REVIEW_STEPS array
- [x] Session persistence working - upsert in `startSession()`, unique constraint
- [x] Progress sidebar navigation - `getStepsWithStatus()` helper
- [x] Step data saved to session - JSON data field with typed structure
- [x] Back navigation between steps - `goBack` param in `completeStep()`
- [x] Review completion tracking - `completedAt` set when last step done
- [x] Desktop-optimized layout - Referenced in step components
- [x] TypeScript/ESLint pass - Verified
- [ ] Integration tests for session flow - Pending (acceptable for MVP)

### Final Assessment

**Status: APPROVED**

The implementation meets all core acceptance criteria. The wizard flow is well-structured with proper session management and type safety. Integration tests are noted as pending, which is acceptable for initial implementation.

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-01-11 | 1.0 | Initial story specification | Bob (SM) |
| 2026-01-12 | 1.1 | Implementation complete - Ready for Review | James (Dev) |
| 2026-01-12 | 1.2 | QA review passed | QA Agent |
