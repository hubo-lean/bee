# Bee

A dating app with a fresh approach to matching.

## Prerequisites

- Node.js >= 20.0.0
- pnpm >= 8.0.0

## Getting Started

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

The app will be available at http://localhost:3000

## Workspace Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start the Next.js development server |
| `pnpm build` | Build the application for production |
| `pnpm lint` | Run ESLint across all packages |
| `pnpm format` | Format code with Prettier |
| `pnpm typecheck` | Run TypeScript type checking |

## Project Structure

```
bee/
├── apps/
│   └── web/           # Next.js application
├── packages/
│   ├── shared/        # Shared types and utilities
│   └── db/            # Database (Prisma)
├── infrastructure/    # Docker, nginx configs
└── docs/              # Project documentation
```

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Package Manager:** pnpm (workspaces)
