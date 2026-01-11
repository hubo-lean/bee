# Story 1.1: Project Setup & Development Environment

## Story Overview

| Field                | Value                                            |
| -------------------- | ------------------------------------------------ |
| **Story ID**         | 1.1                                              |
| **Epic**             | [Epic 1: Foundation & Infrastructure](epic-1.md) |
| **Priority**         | P0 - Critical Path                               |
| **Estimated Effort** | Small (1-2 days)                                 |
| **Dependencies**     | None                                             |
| **Blocks**           | All other stories                                |

## User Story

**As a** developer,
**I want** a properly configured project with all tooling in place,
**So that** I can develop efficiently with type safety and fast feedback.

## Detailed Description

This story establishes the foundational project structure for Bee. It creates a monorepo with the Next.js application and shared packages, configures all development tooling, and ensures the development environment runs correctly.

The project will use:

- **pnpm workspaces** for monorepo management
- **Next.js 14** with App Router for the web application
- **TypeScript** for type safety across the entire codebase
- **Tailwind CSS + shadcn/ui** for styling and components
- **ESLint + Prettier** for code quality

## Acceptance Criteria

### AC1: Repository Structure Created

- [ ] Git repository initialized with appropriate `.gitignore`
- [ ] pnpm workspace configured with `pnpm-workspace.yaml`
- [ ] Root `package.json` with workspace scripts
- [ ] Directory structure matches architecture specification:
  ```
  bee/
  ├── apps/
  │   └── web/                # Next.js application
  ├── packages/
  │   ├── db/                 # Prisma schema & client
  │   └── shared/             # Shared types & utilities
  ├── infrastructure/         # Docker, nginx configs
  ├── docs/                   # Documentation
  └── package.json            # Root workspace
  ```

### AC2: Next.js Application Configured

- [ ] Next.js 14 with App Router installed
- [ ] TypeScript configured with strict mode
- [ ] `tsconfig.json` with path aliases (`@/`, `@packages/`)
- [ ] App Router directory structure in `apps/web/src/app/`
- [ ] Basic `page.tsx` renders "Bee" placeholder

### AC3: Styling & UI Foundation

- [ ] Tailwind CSS installed and configured
- [ ] `tailwind.config.js` with content paths for monorepo
- [ ] shadcn/ui initialized with default theme
- [ ] At least one shadcn component added (e.g., Button) to verify setup
- [ ] Global styles in `globals.css`

### AC4: Code Quality Tools

- [ ] ESLint configured with Next.js recommended rules
- [ ] Prettier configured with consistent formatting
- [ ] `.eslintrc.js` and `.prettierrc` at root
- [ ] Pre-commit hook via husky + lint-staged (optional for MVP)
- [ ] `pnpm lint` runs without errors
- [ ] `pnpm format` formats all files

### AC5: Development Server

- [ ] `pnpm dev` starts development server on port 3000
- [ ] Hot reload works for component changes
- [ ] TypeScript errors show in terminal and browser
- [ ] Console shows no errors on initial load

### AC6: Shared Packages Setup

- [ ] `packages/shared` created with TypeScript config
- [ ] `packages/db` created (Prisma setup in Story 1.2)
- [ ] Packages are importable from `apps/web`
- [ ] Example type exported from `packages/shared` and used in `apps/web`

## Technical Implementation Notes

### File: `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### File: Root `package.json`

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

### File: `apps/web/tsconfig.json` (key paths)

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

### Commands to Run

```bash
# Create project structure
mkdir -p apps/web packages/db packages/shared infrastructure/docker docs

# Initialize Next.js
cd apps/web
pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir

# Add shadcn/ui
pnpm dlx shadcn-ui@latest init
pnpm dlx shadcn-ui@latest add button

# Install workspace dependencies
cd ../..
pnpm install
```

## Files to Create/Modify

| File                                 | Action | Purpose                               |
| ------------------------------------ | ------ | ------------------------------------- |
| `pnpm-workspace.yaml`                | Create | Define monorepo packages              |
| `package.json` (root)                | Create | Workspace scripts                     |
| `.gitignore`                         | Create | Ignore node_modules, .next, env files |
| `.prettierrc`                        | Create | Prettier configuration                |
| `.eslintrc.js`                       | Create | ESLint configuration                  |
| `apps/web/*`                         | Create | Next.js application                   |
| `packages/shared/package.json`       | Create | Shared types package                  |
| `packages/shared/src/index.ts`       | Create | Export entry point                    |
| `packages/shared/src/types/index.ts` | Create | Shared TypeScript types               |
| `packages/db/package.json`           | Create | Database package (Prisma)             |
| `README.md`                          | Create | Project documentation                 |

## Testing Requirements

### Manual Testing

1. Run `pnpm install` from root - should complete without errors
2. Run `pnpm dev` - should start server on localhost:3000
3. Open browser to localhost:3000 - should see placeholder page
4. Edit `apps/web/src/app/page.tsx` - should hot reload
5. Run `pnpm lint` - should pass
6. Run `pnpm typecheck` - should pass

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

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Code committed to main branch
- [ ] README.md updated with setup instructions
- [ ] `pnpm install && pnpm dev` works from fresh clone
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] Development server starts and renders page

## Notes & Decisions

- **pnpm over npm/yarn**: Faster installs, better monorepo support, disk space efficient
- **App Router over Pages Router**: Future-proof, better Server Components support
- **src/ directory**: Cleaner separation of source code from config files
- **Strict TypeScript**: Catch errors early, better DX with autocomplete

## Related Documentation

- [Architecture Document](../../architecture.md) - Full tech stack details
- [PRD](../../prd.md) - Product requirements
