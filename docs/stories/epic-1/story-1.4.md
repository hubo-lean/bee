# Story 1.4: Basic UI Shell & Navigation

## Story Overview

| Field                | Value                                                 |
| -------------------- | ----------------------------------------------------- |
| **Story ID**         | 1.4                                                   |
| **Epic**             | [Epic 1: Foundation & Infrastructure](epic-1.md)      |
| **Priority**         | P1 - High                                             |
| **Estimated Effort** | Medium (2-3 days)                                     |
| **Dependencies**     | Story 1.1 (Project Setup), Story 1.3 (Authentication) |
| **Blocks**           | All Epic 2+ stories (UI foundation)                   |

## User Story

**As a** user,
**I want** a basic application shell with navigation,
**So that** I can move between different sections of the app.

## Detailed Description

This story creates the foundational UI shell for Bee - the layout, navigation, and basic screens that will contain all future features. The shell must be:

- **Mobile-first**: Bottom navigation on mobile, sidebar on desktop
- **Responsive**: Smooth transition between breakpoints
- **Accessible**: Keyboard navigation, proper ARIA labels
- **Performant**: Fast navigation with minimal layout shift

Key screens created (as placeholders):

- Dashboard (Home)
- Inbox
- Review
- Search
- Settings

## Acceptance Criteria

### AC1: Responsive Layout Structure

- [ ] Root layout with providers (Session, Theme)
- [ ] Authenticated layout wrapper for protected routes
- [ ] Mobile layout: Full-width content with bottom nav
- [ ] Desktop layout: Fixed sidebar (256px) with main content area
- [ ] Breakpoint at `md` (768px) for mobile/desktop switch
- [ ] No horizontal scrolling at any viewport width

### AC2: Mobile Bottom Navigation

- [ ] Fixed bottom navigation bar (height: 64px)
- [ ] 4 navigation items: Home, Inbox, Review, Search
- [ ] Active state indicator on current route
- [ ] Icons with labels below
- [ ] Touch-friendly tap targets (min 44x44px)
- [ ] Safe area padding for notched devices

### AC3: Desktop Sidebar Navigation

- [ ] Fixed sidebar on left (width: 256px)
- [ ] App logo/name at top
- [ ] Navigation items with icons and labels
- [ ] Active state highlight on current route
- [ ] User profile/avatar at bottom
- [ ] Sign out button accessible

### AC4: Dashboard/Home Screen

- [ ] Route: `/dashboard`
- [ ] Displays: "Welcome, [User Name]"
- [ ] Placeholder sections for:
  - Today's priorities (empty state)
  - Inbox count badge
  - Calendar snapshot (empty state)
- [ ] Quick capture button visible (FAB on mobile)

### AC5: Placeholder Screens

All screens render with title and "Coming soon" message:

- [ ] `/inbox` - Inbox screen placeholder
- [ ] `/review` - Daily review placeholder
- [ ] `/search` - Search screen placeholder
- [ ] `/settings` - Settings screen placeholder
- [ ] `/weekly` - Weekly review placeholder (not in nav, accessible via URL)

### AC6: Loading & Error States

- [ ] Loading spinner component created
- [ ] Loading state shown during navigation
- [ ] Error boundary wraps authenticated routes
- [ ] Error fallback UI with "Try again" option
- [ ] 404 page for unknown routes

### AC7: Accessibility

- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] Focus indicators visible on all interactive elements
- [ ] ARIA labels on navigation items
- [ ] Skip-to-content link for screen readers
- [ ] Color contrast meets WCAG AA standards

## Technical Implementation Notes

### File: `app/(auth)/layout.tsx`

```typescript
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/navigation/sidebar';
import { BottomNav } from '@/components/navigation/bottom-nav';
import { CaptureButton } from '@/components/capture/capture-button';

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <Sidebar user={session.user} className="hidden md:flex" />

      {/* Main Content */}
      <main className="pb-20 md:pb-0 md:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <BottomNav className="md:hidden" />

      {/* Capture FAB (mobile only) */}
      <CaptureButton className="md:hidden" />
    </div>
  );
}
```

### File: `components/navigation/sidebar.tsx`

```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { SignOutButton } from '@/components/auth/sign-out-button';
import {
  Home,
  Inbox,
  PlayCircle,
  Search,
  Settings,
  Calendar,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/review', label: 'Review', icon: PlayCircle },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  className?: string;
}

export function Sidebar({ user, className }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-50 w-64 flex-col border-r bg-white',
        className
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-2xl">🐝</span>
          <span className="text-xl font-bold">Bee</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="border-t p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
            {user.image ? (
              <img
                src={user.image}
                alt={user.name || 'User'}
                className="h-10 w-10 rounded-full"
              />
            ) : (
              <span className="text-sm font-medium text-gray-600">
                {user.name?.charAt(0) || 'U'}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">
              {user.name}
            </p>
            <p className="truncate text-xs text-gray-500">{user.email}</p>
          </div>
        </div>
        <SignOutButton className="mt-3 w-full" />
      </div>
    </aside>
  );
}
```

### File: `components/navigation/bottom-nav.tsx`

```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Home, Inbox, PlayCircle, Search } from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/review', label: 'Review', icon: PlayCircle },
  { href: '/search', label: 'Search', icon: Search },
];

interface BottomNavProps {
  className?: string;
}

export function BottomNav({ className }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 border-t bg-white pb-safe',
        className
      )}
      aria-label="Main navigation"
    >
      <div className="flex h-16 items-center justify-around">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 px-3 py-2 min-w-[64px] min-h-[44px]',
                isActive ? 'text-blue-600' : 'text-gray-500'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <item.icon className="h-6 w-6" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

### File: `components/capture/capture-button.tsx`

```typescript
'use client';

import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CaptureButtonProps {
  className?: string;
}

export function CaptureButton({ className }: CaptureButtonProps) {
  const handleCapture = () => {
    // TODO: Open capture modal (Epic 2)
    console.log('Capture clicked');
  };

  return (
    <button
      onClick={handleCapture}
      className={cn(
        'fixed bottom-20 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
        className
      )}
      aria-label="Capture new item"
    >
      <Plus className="h-6 w-6" />
    </button>
  );
}
```

### File: `app/(auth)/dashboard/page.tsx`

```typescript
import { auth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Inbox, Calendar, CheckCircle } from 'lucide-react';

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {session?.user?.name?.split(' ')[0]}
        </h1>
        <p className="text-gray-600">
          Here's what's on your plate today.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Inbox Items
            </CardTitle>
            <Inbox className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-gray-500">items awaiting review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Today's Actions
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-gray-500">tasks to complete</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Meetings Today
            </CardTitle>
            <Calendar className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-gray-500">scheduled events</p>
          </CardContent>
        </Card>
      </div>

      {/* Today's Priorities */}
      <Card>
        <CardHeader>
          <CardTitle>Today's Priorities</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle className="h-12 w-12 text-gray-300" />
            <p className="mt-4 text-gray-500">
              No priorities set for today.
            </p>
            <p className="text-sm text-gray-400">
              Capture items and review them to set priorities.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

### File: `app/(auth)/inbox/page.tsx` (Placeholder Template)

```typescript
import { Inbox } from 'lucide-react';

export default function InboxPage() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Inbox className="h-16 w-16 text-gray-300" />
      <h1 className="mt-4 text-xl font-semibold text-gray-900">Inbox</h1>
      <p className="mt-2 text-gray-500">Coming soon in Epic 2</p>
    </div>
  );
}
```

### File: `components/ui/loading.tsx`

```typescript
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Loading({ className, size = 'md' }: LoadingProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <div className={cn('flex items-center justify-center', className)}>
      <Loader2 className={cn('animate-spin text-gray-400', sizeClasses[size])} />
    </div>
  );
}
```

### File: `app/(auth)/error.tsx`

```typescript
'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <AlertCircle className="h-16 w-16 text-red-400" />
      <h1 className="mt-4 text-xl font-semibold text-gray-900">
        Something went wrong
      </h1>
      <p className="mt-2 text-gray-500">
        An error occurred while loading this page.
      </p>
      <Button onClick={reset} className="mt-4">
        Try again
      </Button>
    </div>
  );
}
```

### File: `app/not-found.tsx`

```typescript
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center text-center">
      <h1 className="text-6xl font-bold text-gray-900">404</h1>
      <p className="mt-4 text-xl text-gray-600">Page not found</p>
      <p className="mt-2 text-gray-500">
        The page you're looking for doesn't exist.
      </p>
      <Button asChild className="mt-6">
        <Link href="/dashboard">
          <Home className="mr-2 h-4 w-4" />
          Go home
        </Link>
      </Button>
    </div>
  );
}
```

### Tailwind Config Addition (safe area padding)

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      padding: {
        safe: "env(safe-area-inset-bottom)",
      },
    },
  },
};
```

## Files to Create/Modify

| File                                    | Action | Purpose                      |
| --------------------------------------- | ------ | ---------------------------- |
| `app/(auth)/layout.tsx`                 | Create | Authenticated layout wrapper |
| `app/(auth)/dashboard/page.tsx`         | Create | Home dashboard               |
| `app/(auth)/inbox/page.tsx`             | Create | Inbox placeholder            |
| `app/(auth)/review/page.tsx`            | Create | Review placeholder           |
| `app/(auth)/search/page.tsx`            | Create | Search placeholder           |
| `app/(auth)/settings/page.tsx`          | Create | Settings placeholder         |
| `app/(auth)/weekly/page.tsx`            | Create | Weekly review placeholder    |
| `app/(auth)/calendar/page.tsx`          | Create | Calendar placeholder         |
| `app/(auth)/error.tsx`                  | Create | Error boundary               |
| `app/(auth)/loading.tsx`                | Create | Loading state                |
| `app/not-found.tsx`                     | Create | 404 page                     |
| `components/navigation/sidebar.tsx`     | Create | Desktop sidebar              |
| `components/navigation/bottom-nav.tsx`  | Create | Mobile bottom nav            |
| `components/capture/capture-button.tsx` | Create | FAB for capture              |
| `components/ui/loading.tsx`             | Create | Loading spinner              |
| `tailwind.config.js`                    | Modify | Add safe-area padding        |

## Dependencies to Install

```bash
pnpm add lucide-react
pnpm dlx shadcn-ui@latest add card
```

## Testing Requirements

### Manual Testing

1. **Mobile View** (use browser dev tools, 375px width):
   - Bottom nav visible with 4 items
   - FAB visible in bottom right
   - Sidebar hidden
   - Content fills screen width

2. **Desktop View** (>768px):
   - Sidebar visible on left
   - Bottom nav hidden
   - FAB hidden
   - Content has left padding for sidebar

3. **Navigation**:
   - Click each nav item - route changes
   - Active state shows on current route
   - Back/forward browser buttons work

4. **Accessibility**:
   - Tab through all interactive elements
   - Focus ring visible
   - Screen reader announces navigation items

### Viewport Testing Matrix

| Device    | Width  | Expected Layout |
| --------- | ------ | --------------- |
| iPhone SE | 375px  | Bottom nav, FAB |
| iPhone 14 | 390px  | Bottom nav, FAB |
| iPad Mini | 768px  | Sidebar         |
| Desktop   | 1280px | Sidebar         |

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Responsive layout works at all breakpoints
- [ ] Navigation works between all routes
- [ ] Active states display correctly
- [ ] Loading and error states implemented
- [ ] 404 page displays for unknown routes
- [ ] Keyboard navigation works
- [ ] No accessibility errors in Lighthouse
- [ ] No layout shift during navigation
- [ ] Mobile safe areas respected

## Notes & Decisions

- **Route groups `(auth)`**: Clean URL structure, shared layout for protected routes
- **Fixed sidebar over collapsible**: Simpler UX, no hamburger menu needed
- **Bottom nav limited to 4 items**: Prevents crowding, follows iOS/Android patterns
- **FAB for capture**: Always accessible, mobile-first capture pattern

## Related Documentation

- [Architecture Document](../../architecture.md) - UI structure
- [PRD](../../prd.md) - UI/UX requirements (NFR5, NFR6)
- [shadcn/ui](https://ui.shadcn.com/) - Component library
