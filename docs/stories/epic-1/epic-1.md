# Epic 1: Foundation & Infrastructure

## Epic Overview

| Field | Value |
|-------|-------|
| **Epic ID** | E1 |
| **Epic Name** | Foundation & Infrastructure |
| **Priority** | P0 - Critical Path |
| **Estimated Stories** | 5 |
| **Dependencies** | None (First Epic) |

## Goal Statement

Establish project setup, authentication, database schema, and verify connections to external services (Microsoft, n8n, LibreChat) so that subsequent epics have a solid foundation to build upon.

## Business Value

- Enables all future development work
- Validates technical architecture decisions early
- Confirms external service integrations work before building features
- Establishes development patterns and conventions for the team

## Success Criteria

1. Development environment runs locally with hot reload
2. Database schema deployed to Supabase with all core entities
3. User can authenticate via Microsoft OAuth and maintain session
4. Basic application shell renders with navigation
5. All external services (Microsoft Graph, n8n, LibreChat) respond successfully

## Stories in This Epic

| Story ID | Title | Priority | Dependencies |
|----------|-------|----------|--------------|
| [1.1](story-1.1.md) | Project Setup & Development Environment | P0 | None |
| [1.2](story-1.2.md) | Database Setup & Core Schema | P0 | 1.1 |
| [1.3](story-1.3.md) | Authentication with Microsoft | P0 | 1.1, 1.2 |
| [1.4](story-1.4.md) | Basic UI Shell & Navigation | P1 | 1.1, 1.3 |
| [1.5](story-1.5.md) | External Service Connection Verification | P1 | 1.1, 1.2, 1.3 |

## Architecture References

- **Tech Stack:** Next.js 14 (App Router), TypeScript, Prisma, Supabase, shadcn/ui
- **Repository Structure:** Monorepo with `apps/web`, `packages/db`, `packages/shared`
- **Deployment:** VPS with Docker/PM2, Nginx reverse proxy
- **Database:** Supabase PostgreSQL with pgvector

See [architecture.md](../../architecture.md) for full technical details.

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Microsoft OAuth scope issues | Medium | High | Test OAuth early in Story 1.3, document required scopes |
| Supabase pgvector compatibility | Low | Medium | Verify extension availability during Story 1.2 |
| n8n webhook auth complexity | Medium | Medium | Use simple shared secret auth initially |

## Definition of Done (Epic Level)

- [ ] All 5 stories completed and verified
- [ ] Development environment documented in README
- [ ] All environment variables documented in `.env.example`
- [ ] CI pipeline (GitHub Actions) runs successfully
- [ ] Health check endpoint returns status for all services
- [ ] No critical or high-severity bugs outstanding
