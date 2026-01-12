# Epic 8: Navigation Redesign & PARA Folder System

## Goal

Redesign the application navigation to expose the PARA organizational system (Projects, Areas, Resources, Archive) in the sidebar, add missing quick access routes (Today, Objectives), and create a unified mobile/desktop navigation experience.

## Overview

**Problem Statement:**

The current Bee navigation has critical UX problems that prevent users from effectively using the PARA organizational system:

| Issue | Current State | Impact |
|-------|---------------|--------|
| PARA invisible in sidebar | Sidebar shows only: Home, Inbox, Review, Search, Calendar, Settings | Users cannot access Projects, Areas, Resources, or Archive from main navigation |
| PARANav component unused | A full PARA navigation component exists but is not integrated | Wasted development effort; users miss the feature |
| Objectives hidden | `/objectives` page exists but has no navigation link | Users cannot discover or access their goals |
| No Today view | No quick access to today's actions | Users must navigate through multiple pages |
| Flat navigation | All nav items at same visual level | No information hierarchy communicated |

**Solution:**

Create a unified sidebar with:
1. **Quick Access** section: Inbox, Today, Objectives, Review, Search, Calendar
2. **PARA** section: Collapsible Projects, Areas, Resources, Archive with inline creation
3. **Mobile-first** approach: Bottom nav + drawer that mirrors desktop sidebar

## Dependencies

- **Epic 1-6**: Core UI infrastructure (COMPLETE)
- **Epic 7**: Performance optimizations (RECOMMENDED before this)
- **PRD FR24**: PARA organizational system requirement

## Stories

| Story | Title | Priority | Complexity | Dependencies |
|-------|-------|----------|------------|--------------|
| 8.1 | UnifiedSidebar Component | P0 | High | None |
| 8.2 | Mobile Navigation & Drawer | P0 | Medium | Story 8.1 |
| 8.3 | Quick Access Section & Routes | P0 | Medium | Story 8.1 |
| 8.4 | PARA Sections with Expand/Collapse | P0 | High | Story 8.1, 8.3 |
| 8.5 | Today Page & Badge System | P1 | Medium | Story 8.3 |

**Note:** Folder hierarchy (nested folders within Projects/Areas) is deferred to a future epic (Phase 2).

---

## Architecture

### Navigation Structure

```
┌─────────────────────────────────────┐
│ 🐝 Bee                              │  ← Logo/Home link
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │  + Quick Capture                │ │  ← Primary action button
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ QUICK ACCESS                        │  ← Section header
│   📥 Inbox                    (12)  │  ← Badge shows unprocessed count
│   📅 Today                     (5)  │  ← Badge shows today's actions
│   🎯 Objectives                     │  ← Link to /objectives
│   ▶️  Review                        │  ← Link to /review
│   🔍 Search                         │  ← Link to /search
│   📆 Calendar                       │  ← Link to /calendar
├─────────────────────────────────────┤
│ PARA                                │  ← Section header
│ ▼ Projects                     [+]  │  ← Collapsible, + creates new
│   ├─ 🔵 Website Redesign      (3)  │  ← Color dot, action count badge
│   └─ 🟢 Mobile App            (1)  │
│ ▼ Areas                        [+]  │  ← Collapsible, + creates new
│   ├─ 💼 Work                  (5)  │  ← Emoji icon, action count
│   └─ 🏠 Home                  (2)  │
│ ▶ Resources                         │  ← Collapsed by default
│ ▶ Archive                           │  ← Collapsed by default
├─────────────────────────────────────┤
│ ⚙️ Settings                         │
├─────────────────────────────────────┤
│ 👤 User Profile                     │
└─────────────────────────────────────┘
```

### Mobile Navigation

**Bottom Navigation Bar** (5 items):
```
┌───────────────────────────────────────────────────────┐
│  🏠 Home  │  📥 Inbox  │  ▶️ Review  │  🔍 Search  │  ☰ Menu  │
└───────────────────────────────────────────────────────┘
```

**Menu (☰)** opens slide-out drawer with full sidebar content.

---

## Component Architecture

### New Components

| Component | File Path | Purpose |
|-----------|-----------|---------|
| `UnifiedSidebar` | `components/navigation/unified-sidebar.tsx` | Replace current sidebar with PARA-aware version |
| `MobileDrawer` | `components/navigation/mobile-drawer.tsx` | Slide-out menu for mobile |
| `NavSection` | `components/navigation/nav-section.tsx` | Collapsible section with header |
| `NavItem` | `components/navigation/nav-item.tsx` | Individual navigation link |

### Components to Modify

| Component | Modification |
|-----------|--------------|
| `BottomNav` | Add 5th "Menu" item |
| `AuthLayout` | Use `UnifiedSidebar` instead of current `Sidebar` |

### Components to Deprecate

| Component | Reason |
|-----------|--------|
| `Sidebar` (current) | Replaced by `UnifiedSidebar` |
| `PARANav` | Functionality merged into `UnifiedSidebar` |

---

## Technical Specifications

### Data Requirements

| Data | Source | tRPC Query |
|------|--------|------------|
| Inbox count | `inboxItem` table | `trpc.inbox.getUnprocessedCount` |
| Today's actions | `action` table | `trpc.actions.getTodayCount` |
| Projects list | `project` table | `trpc.para.listProjects({ status: "active" })` |
| Areas list | `area` table | `trpc.para.listAreas()` |
| Action counts per project | `action` table | Included in `listProjects` via `_count` |
| Action counts per area | `action` table | Included in `listAreas` via `_count` |

### State Management

```typescript
// Sidebar expand/collapse state
const [expandedSections, setExpandedSections] = useState({
  projects: true,   // Default expanded
  areas: true,      // Default expanded
  resources: false, // Default collapsed
  archive: false,   // Default collapsed
});

// Persist to localStorage
useEffect(() => {
  localStorage.setItem('bee-sidebar-state', JSON.stringify(expandedSections));
}, [expandedSections]);
```

### Responsive Breakpoints

| Breakpoint | Min Width | Behavior |
|------------|-----------|----------|
| Mobile | 0px | Bottom nav + drawer, no visible sidebar |
| Tablet | 768px | Collapsible sidebar, bottom nav hidden |
| Desktop | 1024px | Fixed sidebar always visible |

---

## Visual Design Specifications

### Dimensions

| Element | Value |
|---------|-------|
| Sidebar width | 264px (desktop) |
| Sidebar width mobile drawer | 85vw, max 320px |
| Nav item height | 40px |
| Nav item icon size | 20px |
| Nested item indent | 24px per level |
| Bottom nav height | 56px |
| Minimum tap target | 44x44px |

### Colors (Light Mode)

| Element | Color |
|---------|-------|
| Sidebar background | `#FFFFFF` |
| Section header text | `#6B7280` (gray-500) |
| Nav item text (default) | `#374151` (gray-700) |
| Nav item text (active) | `#2563EB` (blue-600) |
| Nav item background (active) | `#EFF6FF` (blue-50) |
| Badge background | `#E5E7EB` (gray-200) |

### Animation Specifications

| Animation | Duration | Easing |
|-----------|----------|--------|
| Section expand/collapse | 200ms | ease-out |
| Drawer slide in | 300ms | ease-out |
| Drawer slide out | 200ms | ease-in |
| Nav item hover | 150ms | ease |

---

## Accessibility Requirements

**Standard:** WCAG 2.1 AA

| Requirement | Implementation |
|-------------|----------------|
| Color contrast | Minimum 4.5:1 for text |
| Focus indicators | 2px blue outline on all interactive elements |
| Keyboard navigation | Tab through all items, Enter/Space to activate |
| Screen reader | `aria-expanded`, `aria-current="page"`, semantic landmarks |
| Touch targets | Minimum 44x44px |

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Clicks to reach any Project | 3+ (must type URL) | ≤2 |
| % users who access Objectives | ~0% (hidden) | >50% |
| Time to find PARA structure | N/A (not visible) | <3 seconds |

---

## Sprint Execution Order

```
Week 1 (Core Navigation):
├── Story 8.1: UnifiedSidebar Component (3 days)
│   ├── Create base component structure
│   ├── Integrate with AuthLayout
│   └── Replace current Sidebar
├── Story 8.2: Mobile Navigation & Drawer (2 days)
│   ├── Create MobileDrawer component
│   └── Update BottomNav with Menu item

Week 2 (Features):
├── Story 8.3: Quick Access Section (2 days)
│   ├── Add all Quick Access items
│   └── Wire up routes including Objectives
├── Story 8.4: PARA Sections (2 days)
│   ├── Collapsible sections
│   ├── Project/Area lists with badges
│   └── Inline create buttons
└── Story 8.5: Today Page & Badges (1 day)
    ├── Create /today route (or dashboard filter)
    └── Implement badge count system
```

---

## Out of Scope (Phase 2 - Future Epic)

- Folder hierarchy within Projects/Areas/Resources
- Drag and drop reordering
- Right-click context menus
- New database models for folders

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing navigation | High | Keep old Sidebar as fallback during development |
| Mobile drawer conflicts with gestures | Medium | Test thoroughly on iOS/Android browsers |
| Performance with many projects/areas | Medium | Implement virtualization if >50 items |

---

## Definition of Done

- [ ] UnifiedSidebar renders Quick Access and PARA sections
- [ ] Mobile drawer opens with full navigation
- [ ] Objectives link visible and working
- [ ] Projects/Areas sections expand/collapse with persistence
- [ ] Badge counts display correctly
- [ ] Navigation works on mobile, tablet, and desktop
- [ ] Accessibility audit passed (keyboard nav, screen reader)
- [ ] Old Sidebar and PARANav components deprecated
- [ ] Performance: no visible lag when expanding sections

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-01-12 | 1.0 | Initial epic based on UX spec | John (PM) |

