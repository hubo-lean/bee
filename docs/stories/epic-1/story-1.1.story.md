# Story 1.1: Project Setup & Development Environment

## Status

**Ready for Review**

---

## Story

**As a** developer,
**I want** a properly configured project with all tooling in place,
**so that** I can develop efficiently with type safety and fast feedback.

---

## Acceptance Criteria

1. Next.js project initialized with TypeScript, ESLint, and Prettier configured
2. Tailwind CSS and shadcn/ui installed and configured
3. Git repository initialized with .gitignore and initial commit
4. Development server runs successfully with hot reload
5. Basic folder structure established following project conventions (monorepo with pnpm workspaces)
6. Shared packages (`packages/shared`, `packages/db`) created and importable from `apps/web`

---

## Tasks / Subtasks

- [x] **Task 1: Initialize Monorepo Structure** (AC: 3, 5)
  - [x] Create root directory structure: `apps/`, `packages/`, `infrastructure/`, `docs/`
  - [x] Create `pnpm-workspace.yaml` defining workspace packages
  - [x] Create root `package.json` with workspace scripts (dev, build, lint, format, typecheck)
  - [x] Create `.gitignore` (node_modules, .next, .env\*, .DS_Store, dist, coverage)
  - [x] Initialize git repository with initial commit

- [x] **Task 2: Create Next.js Application** (AC: 1, 4)
  - [x] Initialize Next.js 14 with App Router in `apps/web/`
  - [x] Enable TypeScript with strict mode
  - [x] Configure `tsconfig.json` with path aliases (`@/*`, `@packages/shared`, `@packages/db`)
  - [x] Create App Router structure in `apps/web/src/app/`
  - [x] Create basic `page.tsx` with "Bee" placeholder text
  - [x] Verify `pnpm dev` starts server on port 3000 with hot reload

- [x] **Task 3: Configure Styling & UI Foundation** (AC: 2)
  - [x] Install and configure Tailwind CSS with monorepo content paths
  - [x] Create `tailwind.config.js` with proper content array for workspace
  - [x] Initialize shadcn/ui with default theme
  - [x] Add at least one shadcn component (Button) to verify setup
  - [x] Create `globals.css` with Tailwind directives and base styles

- [x] **Task 4: Setup Code Quality Tools** (AC: 1)
  - [x] Configure ESLint with Next.js recommended rules at root
  - [x] Configure Prettier with consistent formatting rules
  - [x] Create `.eslintrc.js` at root level
  - [x] Create `.prettierrc` at root level
  - [x] Verify `pnpm lint` runs without errors
  - [x] Verify `pnpm format` formats all files correctly

- [x] **Task 5: Create Shared Packages** (AC: 5, 6)
  - [x] Create `packages/shared/` with `package.json` and TypeScript config
  - [x] Create `packages/shared/src/index.ts` as export entry point
  - [x] Create `packages/shared/src/types/index.ts` with example shared type
  - [x] Create `packages/db/` with `package.json` (Prisma setup deferred to Story 1.2)
  - [x] Create `packages/db/src/index.ts` as placeholder export
  - [x] Verify packages are importable from `apps/web` using path aliases

- [x] **Task 6: Create Project Documentation** (AC: 3)
  - [x] Create `README.md` with setup instructions
  - [x] Create `.env.example` with placeholder environment variables
  - [x] Document all workspace scripts in README

- [x] **Task 7: Verification & Final Testing** (AC: 1, 2, 3, 4, 5, 6)
  - [x] Run `pnpm install` from root - verify no errors
  - [x] Run `pnpm dev` - verify server starts on localhost:3000
  - [x] Open browser to localhost:3000 - verify placeholder page renders
  - [x] Edit `apps/web/src/app/page.tsx` - verify hot reload works
  - [x] Run `pnpm lint` - verify passes
  - [x] Run `pnpm typecheck` - verify passes
  - [x] Verify shared package import works in apps/web

---

## Dev Notes

### Project Structure (Source: architecture.md#unified-project-structure)

The project follows a monorepo structure using pnpm workspaces:

```
bee/
├── apps/
│   └── web/                        # Next.js application
│       ├── src/
│       │   ├── app/               # App Router pages
│       │   ├── components/        # React components
│       │   ├── hooks/             # Custom hooks
│       │   ├── lib/               # Utilities
│       │   ├── server/            # tRPC routers & services
│       │   ├── stores/            # Zustand stores
│       │   └── styles/            # Global CSS
│       ├── public/                # Static assets
│       ├── tests/                 # Frontend tests
│       ├── next.config.js
│       ├── tailwind.config.js
│       ├── tsconfig.json
│       └── package.json
├── packages/
│   ├── db/                        # Prisma schema & client
│   │   ├── prisma/
│   │   ├── src/
│   │   └── package.json
│   └── shared/                    # Shared types & utils
│       ├── src/
│       │   ├── types/            # TypeScript interfaces
│       │   ├── constants/        # Shared constants
│       │   └── utils/            # Shared utilities
│       └── package.json
├── infrastructure/
│   ├── docker/
│   ├── nginx/
│   └── scripts/
├── docs/
├── .env.example
├── package.json                   # Root workspace config
├── pnpm-workspace.yaml
└── README.md
```

### Tech Stack for This Story (Source: architecture.md#tech-stack)

| Technology   | Version           | Purpose                         |
| ------------ | ----------------- | ------------------------------- |
| Node.js      | >= 20.0.0         | Runtime                         |
| pnpm         | >= 8.0.0          | Package manager with workspaces |
| Next.js      | 14.x (App Router) | React framework with SSR        |
| TypeScript   | 5.x               | Type-safe JavaScript            |
| Tailwind CSS | 3.x               | Utility-first styling           |
| shadcn/ui    | latest            | Accessible component primitives |
| ESLint       | latest            | Code linting                    |
| Prettier     | ^3.2.0            | Code formatting                 |

### Key Configuration Files

#### pnpm-workspace.yaml

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

#### Root package.json

```json
{
  "name": "bee",
  "private": true,
  "scripts": {
    "dev": "pnpm --filter web dev",
    "build": "pnpm --filter web build",
    "lint": "pnpm -r lint",
    "format": "prettier --write \"**/*.{ts,tsx,md,json}\"",
    "typecheck": "pnpm -r typecheck"
  },
  "devDependencies": {
    "prettier": "^3.2.0",
    "typescript": "^5.4.0"
  }
}
```

#### apps/web/tsconfig.json (key paths)

```json
{
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./src/*"],
      "@packages/shared": ["../../packages/shared/src"],
      "@packages/db": ["../../packages/db/src"]
    }
  }
}
```

### Commands to Execute

```bash
# Create project structure
mkdir -p apps/web packages/db packages/shared infrastructure/docker docs

# Initialize Next.js (in apps/web)
cd apps/web
pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir

# Add shadcn/ui
pnpm dlx shadcn-ui@latest init
pnpm dlx shadcn-ui@latest add button

# Install workspace dependencies (from root)
cd ../..
pnpm install
```

### Coding Standards (Source: architecture.md#coding-standards)

- **Type Sharing:** Define types in `packages/shared` and import from there
- **Environment Variables:** Access only through config objects, never `process.env` directly in components
- **Naming Conventions:**
  - Components: PascalCase (`SwipeCard.tsx`)
  - Hooks: camelCase with 'use' prefix (`useReviewStore.ts`)
  - Files: kebab-case for non-component files

### Previous Story Insights

N/A - This is the first story in the project.

---

## Testing

### Testing Standards (Source: architecture.md#testing-strategy)

- **Test Framework:** Vitest for unit tests
- **Test Location:** `apps/web/tests/`
- **Test Naming:** `*.test.ts` or `*.test.tsx`

### Manual Testing Checklist

1. Run `pnpm install` from root - should complete without errors
2. Run `pnpm dev` - should start server on localhost:3000
3. Open browser to localhost:3000 - should see placeholder page
4. Edit `apps/web/src/app/page.tsx` - should hot reload immediately
5. Run `pnpm lint` - should pass with no errors
6. Run `pnpm typecheck` - should pass with no errors

### Verification Commands

```bash
# Verify workspace structure
pnpm ls --depth 0

# Verify TypeScript compilation
pnpm typecheck

# Verify linting
pnpm lint

# Verify dev server starts
pnpm dev
```

---

## Definition of Done

- [x] All acceptance criteria met
- [x] All tasks and subtasks completed
- [x] Code committed to main branch
- [x] README.md updated with setup instructions
- [x] `pnpm install && pnpm dev` works from fresh clone
- [x] No TypeScript errors
- [x] No ESLint errors
- [x] Development server starts and renders page
- [x] Shared packages importable from apps/web

---

## Change Log

| Date       | Version | Description                                        | Author   |
| ---------- | ------- | -------------------------------------------------- | -------- |
| 2026-01-11 | 1.0     | Initial story creation with full technical context | Bob (SM) |

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

No debug issues encountered.

### Completion Notes List

- Initialized pnpm monorepo with apps/web, packages/shared, packages/db
- Next.js 14 with App Router, TypeScript strict mode, Tailwind CSS, shadcn/ui
- Root ESLint and Prettier configured
- Shared package exports User and ApiResponse types
- All workspace scripts (dev, build, lint, format, typecheck) working
- Dev server verified on localhost:3000

### File List

**Created:**
- package.json (root)
- pnpm-workspace.yaml
- .gitignore
- .eslintrc.js
- .prettierrc
- README.md
- .env.example
- apps/web/ (Next.js app with all configs)
- apps/web/src/app/page.tsx
- apps/web/src/components/ui/button.tsx
- apps/web/src/lib/utils.ts
- packages/shared/package.json
- packages/shared/tsconfig.json
- packages/shared/src/index.ts
- packages/shared/src/types/index.ts
- packages/db/package.json
- packages/db/tsconfig.json
- packages/db/src/index.ts

---

## QA Results

**QA Status: PASSED**

| Verification | Result |
|--------------|--------|
| `pnpm install` | ✅ Completes without errors |
| `pnpm typecheck` | ✅ All 3 packages pass |
| `pnpm lint` | ✅ No ESLint errors |
| Dev server (localhost:3000) | ✅ Starts and renders "Bee" page |
| Shared package import | ✅ `User` type from `@packages/shared` works in `apps/web` |
| README.md | ✅ Contains setup instructions and script docs |
| Git commit | ✅ Initial commit on main branch |

**QA Agent:** Claude Opus 4.5
**Date:** 2026-01-11
