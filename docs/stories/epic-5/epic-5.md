# Epic 5: Weekly Review & Organization

## Goal

Enable top-down weekly planning starting with objectives, provide PARA organization structure, and ensure all items are processed to inbox zero.

## Overview

Epic 5 delivers the deeper organizational layer of Bee. While Epic 4's daily swipe review handles quick triage, the weekly review is where users align their work with their goals and ensure nothing falls through the cracks. This epic implements:

1. **Objectives Management** - Cascading goals from yearly to weekly
2. **Weekly Review Wizard** - Guided step-by-step review flow
3. **PARA Organization** - Projects, Areas, Resources, Archive structure
4. **Inbox Processing** - Process all queues to achieve inbox zero
5. **Auto-Archive & Bankruptcy** - Safety valves for falling behind

Key principles:
- **Top-down planning** - Start with objectives, then prioritize work
- **Forced completion** - Mandatory queues must reach zero
- **Desktop-optimized** - Weekly review is a deep work session
- **Forgiving** - Auto-archive and bankruptcy prevent guilt spiral

## Dependencies

- **Epic 4**: Daily Swipe Review (ClassificationAudit with userAgreed, correction data)
- **Epic 3**: AI Triage & Classification (Needs Review queue, receipts)
- **Epic 2**: Unified Inbox & Capture (InboxItem model)
- **Epic 1**: Foundation infrastructure (authentication, database, tRPC)

## Stories

| Story | Title | Priority | Complexity | Dependencies |
|-------|-------|----------|------------|--------------|
| 5.1 | Objectives Management | P1 | Medium | Epic 1 |
| 5.2 | Weekly Review Wizard | P0 | High | Story 5.1, Epic 3/4 |
| 5.3 | PARA Structure Setup | P0 | Medium | Epic 1 |
| 5.4 | Inbox Processing in Weekly Review | P0 | High | Story 5.2, 5.3 |
| 5.5 | Auto-Archive & Bankruptcy | P1 | Low | Story 5.4 |

## Architecture

### Data Flow

```
[Weekly Review Start]
    ↓
[Step 1: Objectives]
    → Review/confirm weekly objectives
    → Link to monthly/yearly goals
    ↓
[Step 2: Priorities]
    → Select priority projects/areas for the week
    → Surface relevant actions
    ↓
[Step 3: Actions]
    → Review and organize actions for priorities
    → Schedule time blocks (Epic 6)
    ↓
[Step 4: Inbox Processing]
    → Process mandatory queues (Needs Review, Disagreements)
    → Spot-check Receipts (optional)
    → File items to PARA
    ↓
[Review Complete]
    → All mandatory queues at zero
    → Summary of week's plan
```

### PARA Structure

```typescript
interface Project {
  id: string;
  userId: string;
  name: string;
  description?: string;
  status: "active" | "on_hold" | "completed" | "archived";
  areaId?: string;          // Parent area
  objectiveId?: string;     // Linked objective
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface Area {
  id: string;
  userId: string;
  name: string;
  description?: string;
  icon?: string;            // Emoji or icon name
  createdAt: Date;
  updatedAt: Date;
}

interface Resource {
  id: string;
  userId: string;
  name: string;
  description?: string;
  areaId?: string;          // Related area
  type: "note" | "link" | "file" | "collection";
  content?: string;
  url?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Objectives Hierarchy

```typescript
interface Objective {
  id: string;
  userId: string;
  title: string;
  description?: string;
  timeframe: "yearly" | "monthly" | "weekly";
  parentId?: string;        // Parent objective (yearly → monthly → weekly)
  status: "active" | "completed" | "deferred";
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### Weekly Review State

```typescript
interface WeeklyReviewSession {
  id: string;
  userId: string;
  weekStart: Date;          // Monday of the week
  currentStep: ReviewStep;
  steps: {
    objectives: { completed: boolean; data?: ObjectivesStepData };
    priorities: { completed: boolean; data?: PrioritiesStepData };
    actions: { completed: boolean; data?: ActionsStepData };
    inbox: { completed: boolean; data?: InboxStepData };
  };
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

type ReviewStep = "objectives" | "priorities" | "actions" | "inbox" | "complete";
```

### Review Queues

| Queue | Source | Mandatory | Purpose |
|-------|--------|-----------|---------|
| Needs Review | Items with confidence < threshold | Yes | Validate uncertain AI decisions |
| Disagreements | Items user swiped left on | Yes | Correct AI mistakes |
| Receipts | Items auto-filed with high confidence | No | Spot-check AI accuracy |

## Technical Components

### Frontend Components

1. **ObjectivesPage** (`apps/web/src/app/(app)/objectives/page.tsx`)
   - Yearly/monthly/weekly tabs
   - Create/edit objective modal
   - Progress tracking

2. **WeeklyReviewWizard** (`apps/web/src/app/(app)/review/weekly/page.tsx`)
   - Step-by-step wizard flow
   - Progress sidebar
   - Step completion tracking

3. **PARANavigation** (`apps/web/src/components/para/para-nav.tsx`)
   - Collapsible sidebar sections
   - Create project/area/resource
   - Drag-and-drop organization

4. **InboxProcessor** (`apps/web/src/components/review/inbox-processor.tsx`)
   - Queue tabs (Needs Review, Disagreements, Receipts)
   - Bulk actions
   - File to PARA modal

5. **BankruptcyDialog** (`apps/web/src/components/review/bankruptcy-dialog.tsx`)
   - Confirmation with RESET typing
   - Summary of items to archive

### Backend Services

1. **ObjectivesService** (`apps/web/src/server/services/objectives.service.ts`)
   - CRUD for objectives
   - Hierarchy management
   - Weekly rollover

2. **PARAService** (`apps/web/src/server/services/para.service.ts`)
   - Project/Area/Resource management
   - Item filing
   - Archive operations

3. **WeeklyReviewService** (`apps/web/src/server/services/weekly-review.service.ts`)
   - Session management
   - Queue queries
   - Completion tracking

### tRPC Procedures

```typescript
export const objectivesRouter = router({
  list: protectedProcedure.query(...),
  create: protectedProcedure.mutation(...),
  update: protectedProcedure.mutation(...),
  archive: protectedProcedure.mutation(...),
  getCurrentWeek: protectedProcedure.query(...),
});

export const paraRouter = router({
  // Projects
  listProjects: protectedProcedure.query(...),
  createProject: protectedProcedure.mutation(...),
  updateProject: protectedProcedure.mutation(...),
  archiveProject: protectedProcedure.mutation(...),

  // Areas
  listAreas: protectedProcedure.query(...),
  createArea: protectedProcedure.mutation(...),
  updateArea: protectedProcedure.mutation(...),

  // Resources
  listResources: protectedProcedure.query(...),
  createResource: protectedProcedure.mutation(...),

  // Filing
  fileItem: protectedProcedure.mutation(...),
  moveItem: protectedProcedure.mutation(...),
});

export const weeklyReviewRouter = router({
  getSession: protectedProcedure.query(...),
  startSession: protectedProcedure.mutation(...),
  completeStep: protectedProcedure.mutation(...),

  // Queues
  getNeedsReview: protectedProcedure.query(...),
  getDisagreements: protectedProcedure.query(...),
  getReceipts: protectedProcedure.query(...),

  // Bulk actions
  archiveAll: protectedProcedure.mutation(...),
  fileAllTo: protectedProcedure.mutation(...),

  // Bankruptcy
  declareBankruptcy: protectedProcedure.mutation(...),
});
```

## Sprint Execution Order

1. **Story 5.3** (PARA Structure Setup) - Foundation for organization
2. **Story 5.1** (Objectives Management) - Goal hierarchy
3. **Story 5.2** (Weekly Review Wizard) - Guided review flow
4. **Story 5.4** (Inbox Processing) - Queue processing in review
5. **Story 5.5** (Auto-Archive & Bankruptcy) - Safety valves

## Success Criteria

- [ ] Objectives cascade from yearly to weekly
- [ ] Weekly review wizard guides user through all steps
- [ ] PARA structure allows organizing all content
- [ ] All queues can be processed to zero
- [ ] Items older than 15 days auto-archive
- [ ] Bankruptcy function clears entire inbox
- [ ] Review completion clearly indicated
- [ ] Desktop-optimized experience

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Review too long/tedious | User abandonment | Progress indicator, allow partial completion |
| Too many queued items | Overwhelming | Bankruptcy option, auto-archive |
| PARA complexity | Cognitive overhead | Simple defaults, optional structure |
| Lost objectives context | Misaligned work | Always show current week objectives |

## Out of Scope

- OneDrive folder mirroring (deferred - manual file organization)
- Drag-and-drop between PARA categories (click-to-file simpler)
- Real-time collaboration on objectives
- Advanced project management (Gantt charts, dependencies)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-01-11 | 1.0 | Initial epic creation for sprint planning | Bob (SM) |
