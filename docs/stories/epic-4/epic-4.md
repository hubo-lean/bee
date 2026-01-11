# Epic 4: Daily Swipe Review

## Goal

Provide a fast, mobile-first swipe review experience that allows users to process inbox items in under 5 minutes through intuitive gestures.

## Overview

Epic 4 delivers the signature user experience of Bee - the "Tinder for tasks" swipe interface. This transforms inbox processing from a dreaded chore into a quick, satisfying interaction. Users swipe through AI-classified items, agreeing or disagreeing with suggestions, marking urgent items, or archiving low-value content.

Key principles:
1. **Mobile-first** - Optimized for one-handed phone use
2. **Gamified** - Progress indicators and celebrations make review feel rewarding
3. **Fast** - 20+ items processed in under 5 minutes (NFR4)
4. **Forgiving** - Undo option and session persistence prevent frustration

## Dependencies

- **Epic 3**: AI Triage & Classification (aiClassification, extractedActions on InboxItem)
- **Epic 2**: Unified Inbox & Capture (InboxItem model, inbox list)
- **Epic 1**: Foundation infrastructure (authentication, database, tRPC)
- **@use-gesture/react**: Touch/swipe gesture handling
- **Framer Motion**: Card animations and transitions

## Stories

| Story | Title | Priority | Complexity | Dependencies |
|-------|-------|----------|------------|--------------|
| 4.1 | Swipe Card Component | P0 | High | Epic 3 |
| 4.2 | Swipe Gesture Actions | P0 | High | Story 4.1 |
| 4.3 | Daily Review Screen | P0 | Medium | Story 4.2 |
| 4.4 | Disagree Flow & Correction | P0 | Medium | Story 4.2 |
| 4.5 | Review Session Persistence | P1 | Medium | Story 4.3 |

## Architecture

### Data Flow

```
[Daily Review Screen]
    → [Load pending items (status: pending OR reviewed with low confidence)]
    → [Display as card stack]
    → [User swipes]
        ├── Right (Agree) → status: "reviewed", userAgreed: true
        ├── Left (Disagree) → Open correction modal
        ├── Up (Urgent) → priority: "urgent", status: "reviewed"
        └── Down (Hide) → status: "archived"
    → [Animate card off-screen]
    → [Update database via tRPC]
    → [Show next card]
    → [Session complete when stack empty]
```

### Swipe Card Structure

```typescript
interface SwipeCardData {
  id: string;
  content: string;
  type: "manual" | "image" | "voice" | "email";
  source: string;
  createdAt: Date;
  aiClassification: {
    category: string;
    confidence: number;
    reasoning: string;
  };
  extractedActions: ActionCandidate[];
  tags: Tag[];
}
```

### Gesture Mapping

| Gesture | Direction | Action | Result |
|---------|-----------|--------|--------|
| Swipe Right | → | Agree | File with AI classification |
| Swipe Left | ← | Disagree | Open correction options |
| Swipe Up | ↑ | Urgent | Mark urgent priority |
| Swipe Down | ↓ | Hide | Archive item |

### Review Session State

```typescript
interface ReviewSession {
  id: string;
  userId: string;
  startedAt: Date;
  itemIds: string[];           // Original queue
  currentIndex: number;        // Progress position
  actions: SessionAction[];    // Actions taken
  completedAt?: Date;
  stats: {
    agreed: number;
    disagreed: number;
    urgent: number;
    hidden: number;
    totalTimeMs: number;
  };
}

interface SessionAction {
  itemId: string;
  action: "agree" | "disagree" | "urgent" | "hide";
  timestamp: Date;
  undone?: boolean;
}
```

## Technical Components

### Frontend Components

1. **SwipeCard** (`apps/web/src/components/review/swipe-card.tsx`)
   - Card display with content, classification, confidence
   - Gesture handlers for swipe detection
   - Visual feedback during swipe (color tint, icons)
   - Animation on dismissal

2. **CardStack** (`apps/web/src/components/review/card-stack.tsx`)
   - Manages stack of SwipeCard components
   - Handles card ordering and z-index
   - Coordinates animations between cards

3. **DailyReviewScreen** (`apps/web/src/app/(app)/review/page.tsx`)
   - Full-screen review experience
   - Progress indicator
   - Session stats and completion celebration

4. **CorrectionModal** (`apps/web/src/components/review/correction-modal.tsx`)
   - Category selection
   - Action editing
   - Voice/text correction input

5. **UndoToast** (`apps/web/src/components/review/undo-toast.tsx`)
   - 5-second undo window after each swipe

### Backend Services

1. **ReviewService** (`apps/web/src/server/services/review.service.ts`)
   - `startSession(userId)` - Create new review session
   - `getSession(sessionId)` - Resume existing session
   - `recordAction(sessionId, action)` - Record swipe action
   - `undoAction(sessionId, actionId)` - Undo last action
   - `completeSession(sessionId)` - Mark session complete

### tRPC Procedures

```typescript
export const reviewRouter = router({
  // Session management
  startSession: protectedProcedure.mutation(...),
  getActiveSession: protectedProcedure.query(...),
  completeSession: protectedProcedure.mutation(...),

  // Actions
  recordSwipe: protectedProcedure.mutation(...),
  undoSwipe: protectedProcedure.mutation(...),

  // Corrections
  submitCorrection: protectedProcedure.mutation(...),

  // Stats
  getSessionStats: protectedProcedure.query(...),
  getReviewHistory: protectedProcedure.query(...),
});
```

## Sprint Execution Order

1. **Story 4.1** (Swipe Card Component) - Core card UI and gesture detection
2. **Story 4.2** (Swipe Gesture Actions) - Action handlers and database updates
3. **Story 4.3** (Daily Review Screen) - Full review experience
4. **Story 4.4** (Disagree Flow & Correction) - Correction modal and feedback
5. **Story 4.5** (Review Session Persistence) - Session save/resume

## Success Criteria

- [ ] Swipe gestures feel natural and responsive (< 100ms feedback) - NFR6
- [ ] 20+ items can be processed in under 5 minutes - NFR4
- [ ] Visual feedback clearly indicates swipe direction and action
- [ ] Haptic feedback on mobile devices enhances experience
- [ ] Undo functionality prevents accidental action mistakes
- [ ] Progress indicator motivates completion
- [ ] Session can be resumed if interrupted
- [ ] Corrections are captured for AI improvement

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Gesture conflicts with browser | Poor UX | Test on multiple mobile browsers, use proper touch handling |
| Animation performance on low-end devices | Janky feel | Progressive enhancement, reduced motion option |
| Accidental swipes | User frustration | Gesture threshold, undo functionality |
| Session lost on app close | Lost progress | Auto-save session state |
| Too many items in queue | Overwhelmed user | Daily limit, bankruptcy option reminder |

## Out of Scope

- Voice commands for swipe actions (future enhancement)
- Custom gesture mappings
- Swipe on desktop with keyboard shortcuts (future enhancement)
- Real-time sync across devices (single device MVP)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-01-11 | 1.0 | Initial epic creation for sprint planning | Bob (SM) |
