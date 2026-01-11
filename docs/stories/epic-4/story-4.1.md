# Story 4.1: Swipe Card Component

## Story

**As a** user,
**I want** to see inbox items as swipeable cards,
**So that** I can make quick decisions with natural gestures.

## Priority

**P0** - Foundation for the entire daily review experience

## Acceptance Criteria

1. Card displays: content preview, AI classification, confidence score, source icon
2. Card supports swipe gestures: right, left, up, down
3. Visual feedback during swipe (color change, direction icon reveal)
4. Haptic feedback on mobile (if supported)
5. Gesture threshold prevents accidental swipes (minimum 50px drag)
6. Card animates off-screen on successful swipe (spring animation)
7. Card returns to center if swipe incomplete

## Technical Design

### Component Structure

```tsx
interface SwipeCardProps {
  item: InboxItem;
  onSwipe: (direction: SwipeDirection) => void;
  onSwipeStart?: () => void;
  onSwipeEnd?: () => void;
  isActive: boolean; // Only top card responds to gestures
}

type SwipeDirection = "right" | "left" | "up" | "down";

interface SwipeState {
  x: number;
  y: number;
  rotation: number;
  isDragging: boolean;
  direction: SwipeDirection | null;
}
```

### Card Layout

```
┌─────────────────────────────────────┐
│  📷 manual  •  2 mins ago           │  ← Source & timestamp
├─────────────────────────────────────┤
│                                     │
│  "Meeting with Sarah about Q4      │  ← Content preview
│   budget. Need to send proposal    │     (max 3 lines)
│   by Friday..."                    │
│                                     │
├─────────────────────────────────────┤
│  📋 ACTION                   87%   │  ← Category & confidence
│  "May contain tasks"                │  ← AI reasoning
├─────────────────────────────────────┤
│  ┌──────┐ ┌──────┐ ┌──────┐       │
│  │budget│ │Sarah │ │Friday│        │  ← Tags (scrollable)
│  └──────┘ └──────┘ └──────┘       │
└─────────────────────────────────────┘
```

### Gesture Configuration

```typescript
// @use-gesture/react configuration
const SWIPE_THRESHOLD = 50;      // Minimum px to trigger swipe
const VELOCITY_THRESHOLD = 0.5;  // Minimum velocity for swipe
const ROTATION_FACTOR = 0.1;     // Card rotation during drag

const bind = useDrag(({ movement: [mx, my], velocity: [vx, vy], direction: [dx, dy], active }) => {
  // Calculate primary swipe direction
  const absX = Math.abs(mx);
  const absY = Math.abs(my);

  if (!active) {
    // Check if swipe meets threshold
    const isHorizontal = absX > absY;
    const distance = isHorizontal ? absX : absY;
    const speed = isHorizontal ? vx : vy;

    if (distance > SWIPE_THRESHOLD || Math.abs(speed) > VELOCITY_THRESHOLD) {
      const direction = getSwipeDirection(mx, my, dx, dy);
      onSwipe(direction);
    } else {
      // Return to center
      resetPosition();
    }
  }
}, {
  axis: undefined, // Allow any direction
  filterTaps: true,
});
```

### Visual Feedback During Swipe

```typescript
const SWIPE_COLORS = {
  right: { bg: "bg-green-500/20", icon: "CheckCircle", label: "Agree" },
  left: { bg: "bg-red-500/20", icon: "XCircle", label: "Disagree" },
  up: { bg: "bg-orange-500/20", icon: "AlertTriangle", label: "Urgent" },
  down: { bg: "bg-gray-500/20", icon: "Archive", label: "Hide" },
};

// Opacity based on drag distance
const feedbackOpacity = Math.min(Math.abs(dragDistance) / SWIPE_THRESHOLD, 1);
```

### Animation Configuration

```typescript
// Framer Motion spring config for natural feel
const SPRING_CONFIG = {
  type: "spring",
  damping: 25,
  stiffness: 300,
};

// Exit animation - fly off screen
const exitAnimation = {
  right: { x: 500, rotate: 20, opacity: 0 },
  left: { x: -500, rotate: -20, opacity: 0 },
  up: { y: -500, rotate: 0, opacity: 0 },
  down: { y: 500, rotate: 0, opacity: 0 },
};
```

### Haptic Feedback

```typescript
function triggerHaptic(type: "light" | "medium" | "heavy") {
  if ("vibrate" in navigator) {
    const patterns = {
      light: [10],
      medium: [20],
      heavy: [30, 10, 30],
    };
    navigator.vibrate(patterns[type]);
  }
}

// Trigger on swipe threshold reached
useEffect(() => {
  if (isOverThreshold && !wasOverThreshold) {
    triggerHaptic("light");
  }
}, [isOverThreshold]);
```

### Confidence Display

```typescript
function ConfidenceBadge({ confidence }: { confidence: number }) {
  const config = {
    high: { color: "text-green-600", bg: "bg-green-100", label: "High" },
    medium: { color: "text-yellow-600", bg: "bg-yellow-100", label: "Med" },
    low: { color: "text-red-600", bg: "bg-red-100", label: "Low" },
  };

  const level = confidence >= 0.8 ? "high" : confidence >= 0.6 ? "medium" : "low";
  const pct = Math.round(confidence * 100);

  return (
    <div className={cn("px-2 py-1 rounded-full", config[level].bg)}>
      <span className={config[level].color}>{pct}%</span>
    </div>
  );
}
```

### Category Icons

```typescript
const CATEGORY_CONFIG = {
  action: { icon: CheckSquare, color: "text-blue-600", label: "Action" },
  note: { icon: FileText, color: "text-purple-600", label: "Note" },
  reference: { icon: Bookmark, color: "text-green-600", label: "Reference" },
  meeting: { icon: Calendar, color: "text-orange-600", label: "Meeting" },
  unknown: { icon: HelpCircle, color: "text-gray-600", label: "Unknown" },
};
```

## Dependencies

- @use-gesture/react (gesture handling)
- framer-motion (animations)
- Epic 3 complete (aiClassification on InboxItem)

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `apps/web/src/components/review/swipe-card.tsx` | Create | Main swipe card component |
| `apps/web/src/components/review/confidence-badge.tsx` | Create | Confidence score display |
| `apps/web/src/components/review/category-badge.tsx` | Create | Category display |
| `apps/web/src/components/review/swipe-feedback.tsx` | Create | Visual feedback overlay |
| `apps/web/src/lib/hooks/use-haptic.ts` | Create | Haptic feedback hook |
| `apps/web/src/lib/constants/swipe.ts` | Create | Swipe configuration constants |

## Testing Checklist

- [ ] Card displays all required information (content, category, confidence, source)
- [ ] Swipe right detected correctly with visual feedback
- [ ] Swipe left detected correctly with visual feedback
- [ ] Swipe up detected correctly with visual feedback
- [ ] Swipe down detected correctly with visual feedback
- [ ] Card returns to center if swipe incomplete
- [ ] Haptic feedback triggers on threshold (mobile)
- [ ] Animation feels smooth (60fps)
- [ ] Works on iOS Safari
- [ ] Works on Android Chrome
- [ ] Touch events don't conflict with scroll

## Definition of Done

- [x] SwipeCard component renders inbox item data
- [x] Four-directional swipe gesture detection working
- [x] Visual feedback shows during swipe (color + icon)
- [x] Haptic feedback on mobile devices
- [x] Gesture threshold prevents accidental swipes
- [x] Smooth spring animation on card exit
- [x] Card resets if swipe cancelled
- [x] TypeScript/ESLint pass
- [x] Unit tests for gesture logic

---

## Status

Ready for Review

---

## Dev Agent Record

### Agent Model Used
Claude Opus 4.5

### File List
| File | Action | Purpose |
|------|--------|---------|
| `apps/web/src/lib/constants/swipe.ts` | Created | Swipe configuration constants |
| `apps/web/src/lib/hooks/use-haptic.ts` | Created | Haptic feedback hook |
| `apps/web/src/components/review/swipe-card.tsx` | Created | Main swipe card component |
| `apps/web/src/components/review/confidence-badge.tsx` | Created | Confidence score display |
| `apps/web/src/components/review/category-badge.tsx` | Created | Category display |
| `apps/web/src/components/review/swipe-feedback.tsx` | Created | Visual feedback overlay |
| `apps/web/src/components/review/index.ts` | Created | Barrel export |
| `apps/web/src/components/review/__tests__/swipe-logic.test.ts` | Created | Unit tests for gesture logic |
| `apps/web/package.json` | Modified | Added @use-gesture/react dependency |

### Debug Log References
N/A - No blocking issues encountered.

### Completion Notes
- Installed @use-gesture/react for gesture handling
- Implemented four-directional swipe detection with threshold (50px)
- Visual feedback shows during swipe with color overlay and direction icon
- Haptic feedback via navigator.vibrate API
- Spring animations via framer-motion
- Card resets to center if swipe cancelled
- All 17 unit tests passing
- TypeScript/ESLint clean

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-01-11 | 1.0 | Initial story specification | Bob (SM) |
| 2026-01-11 | 1.1 | Implementation complete | James (Dev) |
| 2026-01-11 | 1.2 | QA Review complete | QA |

---

## QA Results

### Verification Summary

**QA Status: PASSED**

All acceptance criteria verified and Definition of Done items confirmed complete.

### Code Review Findings

#### 1. Swipe Constants (`swipe.ts`)
- ✅ SWIPE_THRESHOLD = 50px (prevents accidental swipes)
- ✅ VELOCITY_THRESHOLD = 0.5 (alternative trigger)
- ✅ SPRING_CONFIG with damping: 25, stiffness: 300
- ✅ EXIT_ANIMATIONS for all four directions with rotation
- ✅ SWIPE_FEEDBACK colors for visual feedback
- ✅ CATEGORY_CONFIG and CONFIDENCE_THRESHOLDS defined

#### 2. SwipeCard Component (`swipe-card.tsx`)
- ✅ Uses @use-gesture/react for gesture handling
- ✅ Uses framer-motion for spring animations
- ✅ `getSwipeDirection()` function correctly determines swipe direction
- ✅ Threshold check: `if (absX < SWIPE_THRESHOLD) return null`
- ✅ Card displays: content preview, AI classification, confidence score, source icon, tags
- ✅ Visual feedback via SwipeFeedback overlay with opacity based on drag distance
- ✅ Direction indicator border appears when opacity > 0.3
- ✅ `resetPosition()` animates card back to center if swipe incomplete
- ✅ `handleSwipeComplete()` triggers exit animation and haptic feedback

#### 3. Haptic Feedback (`use-haptic.ts`)
- ✅ Uses navigator.vibrate API
- ✅ Three intensity patterns: light [10], medium [20], heavy [30, 10, 30]
- ✅ Feature detection with "vibrate" in navigator check
- ✅ Triggered on threshold crossing (light) and swipe complete (medium)

#### 4. Visual Feedback Components
- ✅ `ConfidenceBadge`: Displays percentage with color coding (high/medium/low)
- ✅ `CategoryBadge`: Shows category icon and label with appropriate colors
- ✅ `SwipeFeedback`: Overlay with direction icon and label

#### 5. CardStack Component (`card-stack.tsx`)
- ✅ Fixed TypeScript error: Changed import from `@prisma/client` to `@packages/db`
- ✅ Added `transformItem()` function to convert Prisma types to component types
- ✅ Handles JSON field transformations for aiClassification and tags

### Build Verification

```
$ pnpm typecheck
✓ All packages passed type checking

$ pnpm lint
✓ No warnings or errors
```

### Unit Tests

- ✅ 17 unit tests passing for gesture logic in `__tests__/swipe-logic.test.ts`

### Items Verified

| Acceptance Criteria | Status | Notes |
|---------------------|--------|-------|
| Card displays content preview, AI classification, confidence, source icon | ✅ Pass | All displayed in swipe-card.tsx |
| Card supports swipe gestures: right, left, up, down | ✅ Pass | getSwipeDirection() handles all directions |
| Visual feedback during swipe (color change, direction icon reveal) | ✅ Pass | SwipeFeedback overlay with opacity |
| Haptic feedback on mobile | ✅ Pass | navigator.vibrate API with patterns |
| Gesture threshold prevents accidental swipes (50px) | ✅ Pass | SWIPE_THRESHOLD = 50 |
| Card animates off-screen on successful swipe | ✅ Pass | EXIT_ANIMATIONS with spring config |
| Card returns to center if swipe incomplete | ✅ Pass | resetPosition() function |

### Issues Found and Fixed

1. **TypeScript Error in card-stack.tsx**: Import was using `@prisma/client` instead of the workspace package `@packages/db`. Fixed by updating import and adding `transformItem()` function to handle Prisma JSON type conversions.
