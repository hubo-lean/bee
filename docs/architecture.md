# Bee Fullstack Architecture Document

## Introduction

This document outlines the complete fullstack architecture for **Bee**, including backend systems, frontend implementation, and their integration. It serves as the single source of truth for AI-driven development, ensuring consistency across the entire technology stack.

This unified approach combines what would traditionally be separate backend and frontend architecture documents, streamlining the development process for modern fullstack applications where these concerns are increasingly intertwined.

### Starter Template or Existing Project

**N/A - Greenfield project with existing infrastructure leverage**

While this is a new application, the architecture will integrate with Hugo's existing VPS infrastructure:

- **n8n** - Already running, available for workflow automation and integrations
- **LibreChat** - Already running, available for AI chat functionality (potentially via MCP)

**Decision:** Start with `create-next-app` with TypeScript + App Router, adding Prisma separately. This gives us flexibility without opinionated choices we don't need.

### Change Log

| Date       | Version | Description                                                    | Author              |
| ---------- | ------- | -------------------------------------------------------------- | ------------------- |
| 2026-01-11 | 0.1     | Initial architecture document                                  | Winston (Architect) |
| 2026-01-11 | 0.2     | Added token refresh and webhook failure handling               | Winston (Architect) |
| 2026-01-11 | 0.3     | Hybrid multi-provider email/calendar (IMAP/CalDAV + OAuth)     | Winston (Architect) |

---

## High Level Architecture

### Technical Summary

Bee is a **Next.js fullstack application** self-hosted on Hugo's VPS alongside the existing **n8n** and **LibreChat** instances. The frontend uses React with shadcn/ui for a mobile-first responsive experience optimized for swipe gestures. The backend uses Next.js API routes with Prisma ORM connecting to **Supabase** (PostgreSQL with pgvector built-in) for combined relational data and semantic search.

**Email and Calendar Integration** uses a **hybrid provider-agnostic approach**:
- **Default (IMAP/CalDAV):** Works with any email provider (Gmail, Outlook, Yahoo, corporate accounts) using standard protocols. Users provide app-specific passwords - no OAuth app registration required.
- **Optional OAuth:** Power users who can register OAuth apps get richer API access (Microsoft Graph, Google APIs).

This design removes provider lock-in and works with enterprise accounts where the user lacks admin access. External integrations are orchestrated through n8n workflows. This architecture consolidates everything on existing infrastructure, minimizing costs and operational complexity.

### Platform and Infrastructure Choice

- **Platform:** Hugo's VPS (app, n8n, LibreChat) + Supabase Cloud (database)
- **Key Services:** Docker/PM2 (app hosting), Nginx (reverse proxy), Supabase (Postgres + pgvector + storage), n8n (workflows), LibreChat (AI chat)
- **Deployment Region:** VPS location + Supabase region (choose closest to VPS)

**Rationale:** Full VPS hosting keeps everything consolidated and minimizes costs. Supabase Cloud provides managed Postgres with pgvector without self-hosting complexity. Hugo's experience with Supabase and the built-in pgvector support makes this the pragmatic choice.

### Repository Structure

- **Structure:** Monorepo (single repository)
- **Monorepo Tool:** npm workspaces (lightweight, no extra tooling)
- **Package Organization:**
  - `apps/web` - Next.js application
  - `packages/shared` - Shared types, constants, utilities
  - `packages/db` - Prisma schema and client (connecting to Supabase)

### High Level Architecture Diagram

```mermaid
graph TB
    subgraph "User Devices"
        Mobile[Mobile Browser]
        Desktop[Desktop Browser]
    end

    subgraph "Hugo's VPS"
        Nginx[Nginx<br/>Reverse Proxy + SSL]
        App[Next.js App<br/>Docker/PM2]
        N8N[n8n<br/>Workflow Automation]
        LibreChat[LibreChat<br/>AI Chat via MCP]
    end

    subgraph "Supabase Cloud"
        DB[(PostgreSQL<br/>+ pgvector)]
        Storage[Supabase Storage<br/>Images/Files]
    end

    subgraph "Email/Calendar Providers"
        IMAP[IMAP/SMTP<br/>Any Email Provider]
        CalDAV[CalDAV<br/>Any Calendar Provider]
        MSFT[Microsoft Graph<br/>OAuth - Optional]
        Google[Google APIs<br/>OAuth - Optional]
    end

    subgraph "AI APIs"
        LLM[LLM APIs<br/>Claude/GPT/Gemini]
    end

    Mobile --> Nginx
    Desktop --> Nginx
    Nginx --> App

    App --> DB
    App --> Storage
    App --> N8N
    App --> LibreChat

    N8N --> IMAP
    N8N --> CalDAV
    N8N --> MSFT
    N8N --> Google
    N8N --> LLM
    LibreChat --> LLM
```

### VPS Deployment Architecture

```
Hugo's VPS
├── Nginx (port 80/443)
│   ├── bee.domain.com → Next.js App (port 3000)
│   ├── n8n.domain.com → n8n (existing)
│   └── chat.domain.com → LibreChat (existing)
├── Docker Compose
│   └── bee-app (Next.js)
└── Existing Services
    ├── n8n (already running)
    └── LibreChat (already running)
```

### Architectural Patterns

- **Self-Hosted Monolith:** Single Next.js app handling both SSR and API routes - _Rationale:_ Simple deployment, easy debugging, appropriate for single-user MVP
- **Nginx Reverse Proxy:** SSL termination, routing to app/n8n/LibreChat - _Rationale:_ Industry standard, already likely in use on VPS
- **Repository Pattern:** Prisma ORM with Supabase PostgreSQL - _Rationale:_ Clean data access, Prisma works seamlessly with Supabase
- **Event-Driven Workflows:** n8n handles async operations (email processing, AI classification) via webhooks - _Rationale:_ Offloads complex integrations, visual workflow debugging
- **Component-Based UI:** React components with shadcn/ui primitives - _Rationale:_ Consistent design system, accessible by default
- **Optimistic Updates:** Frontend assumes success, syncs in background - _Rationale:_ Sub-100ms perceived response for swipe actions
- **MCP Protocol for AI:** LibreChat integration via Model Context Protocol - _Rationale:_ Hugo's preference, standardized AI tool-calling

---

## Tech Stack

This is the **definitive technology selection** for Bee. All development must use these exact technologies.

| Category             | Technology              | Version           | Purpose                          | Rationale                               |
| -------------------- | ----------------------- | ----------------- | -------------------------------- | --------------------------------------- |
| Frontend Language    | TypeScript              | 5.x               | Type-safe JavaScript             | Catch errors at compile time, better DX |
| Frontend Framework   | Next.js                 | 14.x (App Router) | React framework with SSR/SSG     | Industry standard, excellent DX         |
| UI Component Library | shadcn/ui               | latest            | Accessible component primitives  | Copy-paste components, full control     |
| State Management     | Zustand                 | 4.x               | Lightweight global state         | Simple API, no boilerplate              |
| CSS Framework        | Tailwind CSS            | 3.x               | Utility-first styling            | Rapid development, consistent design    |
| Backend Language     | TypeScript              | 5.x               | Type-safe Node.js                | Shared types frontend/backend           |
| Backend Framework    | Next.js API Routes      | 14.x              | Serverless-style API endpoints   | Colocated with frontend                 |
| API Style            | REST + tRPC             | tRPC 11.x         | Type-safe API layer              | End-to-end type safety                  |
| Database             | Supabase (PostgreSQL)   | 15.x              | Relational database with vectors | Built-in pgvector, auth, storage        |
| ORM                  | Prisma                  | 5.x               | Type-safe database access        | Excellent DX, migrations                |
| Vector Search        | pgvector (via Supabase) | 0.5.x             | Semantic search embeddings       | Native PostgreSQL extension             |
| File Storage         | Supabase Storage        | -                 | Image/file uploads               | Integrated with Supabase                |
| Authentication       | NextAuth.js             | 5.x (Auth.js)     | OAuth + session management       | Microsoft provider built-in             |
| Frontend Testing     | Vitest                  | 1.x               | Unit/component tests             | Fast, Jest-compatible API               |
| Backend Testing      | Vitest                  | 1.x               | API route tests                  | Same tool for entire codebase           |
| E2E Testing          | Playwright              | 1.x               | Browser automation tests         | Cross-browser, good mobile emulation    |
| Build Tool           | Next.js (Turbopack)     | 14.x              | Development bundling             | Built into Next.js, fast HMR            |
| Process Manager      | PM2                     | 5.x               | Node.js process management       | Auto-restart, clustering, logs          |
| Reverse Proxy        | Nginx                   | 1.24.x            | SSL, routing, load balancing     | Industry standard                       |
| CI/CD                | GitHub Actions          | -                 | Automated testing/deployment     | Free, good integration                  |
| Monitoring           | Sentry                  | 7.x               | Error tracking                   | Free tier, excellent context            |
| Logging              | Pino                    | 8.x               | Structured logging               | Fast, JSON output                       |
| Gestures             | @use-gesture/react      | 10.x              | Touch/swipe handling             | React-native-like gestures              |
| Animations           | Framer Motion           | 11.x              | Card animations                  | Smooth swipe animations                 |
| IMAP Client          | imapflow                | 1.x               | Email reading via IMAP           | Modern, Promise-based, well-maintained  |
| SMTP Client          | nodemailer              | 6.x               | Email sending via SMTP           | Industry standard, battle-tested        |
| CalDAV Client        | tsdav                   | 2.x               | Calendar via CalDAV              | TypeScript-native, supports all CalDAV  |
| Encryption           | @node-rs/argon2 + crypto| -                 | Credential encryption            | Secure storage of passwords/tokens      |

### Key Technology Decisions

**Why tRPC alongside REST?**

- tRPC provides end-to-end type safety for the main app ↔ API communication
- REST endpoints remain for n8n webhook callbacks (n8n speaks REST, not tRPC)

**Why Zustand over Redux/Context?**

- Minimal boilerplate for a solo project
- Works well with React Server Components
- Sufficient for MVP complexity

**Why Prisma with Supabase?**

- Prisma provides type-safe queries and migrations
- Works seamlessly with Supabase's PostgreSQL
- Better DX than Supabase's JavaScript client for complex queries

**Why @use-gesture + Framer Motion?**

- Critical for the swipe card UX (FR11-FR15)
- Provides native-feeling touch interactions on mobile

**Why IMAP/CalDAV as default instead of OAuth APIs?**

- **No app registration required:** Users provide app-specific passwords, not OAuth credentials
- **Works with enterprise accounts:** Even when user lacks Azure AD/Google Workspace admin access
- **Provider-agnostic:** Same code works with Gmail, Outlook, Yahoo, corporate email, etc.
- **Simpler for MVP:** No OAuth flow complexity for basic email/calendar access
- **Fallback to OAuth:** Power users who CAN register OAuth apps get richer features

**Why imapflow over node-imap?**

- Modern Promise-based API (node-imap is callback-based)
- Better TypeScript support
- Active maintenance
- Built-in IDLE support for real-time updates

**Why tsdav for CalDAV?**

- TypeScript-native with full type definitions
- Supports all major providers (Google, iCloud, Outlook, Fastmail)
- Handles CalDAV quirks across providers
- Well-documented and actively maintained

---

## Data Models

These are the core business entities that drive Bee's functionality. TypeScript interfaces are shared between frontend and backend.

### User

**Purpose:** Represents an authenticated user of the system.

```typescript
interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  settings: UserSettings;
  createdAt: Date;
  updatedAt: Date;
}

interface UserSettings {
  confidenceThreshold: number; // Default 0.6
  autoArchiveDays: number; // Default 15
  defaultModel: "claude" | "gpt" | "gemini";
  weeklyReviewDay: number; // 0=Sunday, 6=Saturday
}
```

**Relationships:**

- Has many `InboxItem`, `Note`, `Action`, `Project`, `Area`, `Resource`, `Conversation`, `EmailAccount`, `CalendarAccount`

### EmailAccount

**Purpose:** Stores email provider credentials. Supports both IMAP/SMTP (default) and OAuth (optional) connections.

```typescript
interface EmailAccount {
  id: string;
  userId: string;
  name: string; // User-friendly name, e.g., "Work Gmail"
  email: string;
  provider: "imap" | "microsoft_oauth" | "google_oauth";
  isDefault: boolean;

  // IMAP/SMTP credentials (encrypted)
  imapHost?: string;
  imapPort?: number;
  smtpHost?: string;
  smtpPort?: number;
  username?: string;
  password?: string; // App-specific password, encrypted

  // OAuth credentials (encrypted)
  oauthAccessToken?: string;
  oauthRefreshToken?: string;
  oauthExpiresAt?: Date;

  // Sync state
  lastSyncAt?: Date;
  syncStatus: "idle" | "syncing" | "error";
  syncError?: string;

  createdAt: Date;
  updatedAt: Date;
}
```

**Provider-Specific Configuration:**

| Provider | Auth Method | Required Fields |
|----------|-------------|-----------------|
| IMAP (Gmail) | App Password | imapHost, imapPort, smtpHost, smtpPort, username, password |
| IMAP (Outlook) | App Password | imapHost, imapPort, smtpHost, smtpPort, username, password |
| Microsoft OAuth | OAuth 2.0 | oauthAccessToken, oauthRefreshToken |
| Google OAuth | OAuth 2.0 | oauthAccessToken, oauthRefreshToken |

### CalendarAccount

**Purpose:** Stores calendar provider credentials. Supports CalDAV (default) and OAuth (optional).

```typescript
interface CalendarAccount {
  id: string;
  userId: string;
  name: string; // User-friendly name, e.g., "Personal Calendar"
  provider: "caldav" | "microsoft_oauth" | "google_oauth";
  isDefault: boolean;

  // CalDAV credentials (encrypted)
  caldavUrl?: string;
  username?: string;
  password?: string; // App-specific password, encrypted

  // OAuth credentials (encrypted)
  oauthAccessToken?: string;
  oauthRefreshToken?: string;
  oauthExpiresAt?: Date;

  // Sync state
  lastSyncAt?: Date;
  syncStatus: "idle" | "syncing" | "error";
  syncError?: string;

  createdAt: Date;
  updatedAt: Date;
}
```

**Provider-Specific Configuration:**

| Provider | Auth Method | Required Fields | CalDAV URL Example |
|----------|-------------|-----------------|-------------------|
| Google CalDAV | App Password | caldavUrl, username, password | `https://apidata.googleusercontent.com/caldav/v2/` |
| iCloud CalDAV | App Password | caldavUrl, username, password | `https://caldav.icloud.com/` |
| Microsoft CalDAV | App Password | caldavUrl, username, password | `https://outlook.office365.com/caldav/` |
| Microsoft OAuth | OAuth 2.0 | oauthAccessToken, oauthRefreshToken | N/A (uses Graph API) |
| Google OAuth | OAuth 2.0 | oauthAccessToken, oauthRefreshToken | N/A (uses Calendar API) |

### InboxItem

**Purpose:** The universal entry point. Every captured item starts here before being processed.

```typescript
interface InboxItem {
  id: string;
  userId: string;
  type: "manual" | "image" | "voice" | "email" | "forward";
  content: string;
  mediaUrl?: string;
  source: string;
  status: "pending" | "processing" | "reviewed" | "archived";
  aiClassification?: AIClassification;
  extractedActions: ActionCandidate[];
  tags: Tag[];
  createdAt: Date;
  reviewedAt?: Date;
  archivedAt?: Date;
}

interface AIClassification {
  category: "action" | "note" | "reference" | "meeting" | "unknown";
  confidence: number; // 0.0 - 1.0
  reasoning: string;
  suggestedProject?: string;
  suggestedArea?: string;
  processedAt: Date;
  modelUsed: string;
}

interface ActionCandidate {
  id: string;
  description: string;
  confidence: number;
  dueDate?: Date;
  owner?: string;
  accepted: boolean;
}

interface Tag {
  type: "topic" | "person" | "project" | "date";
  value: string;
  confidence: number;
}
```

### Note

**Purpose:** Processed ideas, meeting notes, and reference material organized in PARA structure.

```typescript
interface Note {
  id: string;
  userId: string;
  title: string;
  content: string;
  projectId?: string;
  areaId?: string;
  resourceId?: string;
  sourceInboxItemId?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

### Action

**Purpose:** Trackable to-do items following "Next Action" format.

```typescript
interface Action {
  id: string;
  userId: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "archived";
  priority: "urgent" | "high" | "normal" | "low";
  dueDate?: Date;
  scheduledFor?: Date;
  calendarEventId?: string;
  projectId?: string;
  areaId?: string;
  objectiveId?: string;
  sourceInboxItemId?: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### Project / Area / Resource (PARA)

**Purpose:** PARA organizational structure for all content.

```typescript
interface Project {
  id: string;
  userId: string;
  name: string;
  description?: string;
  status: "active" | "completed" | "on_hold" | "archived";
  oneDriveFolderId?: string;
  objectiveId?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Area {
  id: string;
  userId: string;
  name: string;
  description?: string;
  oneDriveFolderId?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Resource {
  id: string;
  userId: string;
  name: string;
  description?: string;
  oneDriveFolderId?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Objective

**Purpose:** Cascading goal hierarchy (Yearly → Monthly → Weekly).

```typescript
interface Objective {
  id: string;
  userId: string;
  title: string;
  description?: string;
  timeframe: "yearly" | "monthly" | "weekly";
  parentId?: string;
  status: "active" | "completed" | "abandoned";
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### Conversation

**Purpose:** AI chat sessions that become searchable, first-class objects.

```typescript
interface Conversation {
  id: string;
  userId: string;
  title: string;
  model: "claude" | "gpt" | "gemini";
  messages: ConversationMessage[];
  summary?: string;
  extractedInsights: string[];
  extractedActions: ActionCandidate[];
  projectId?: string;
  areaId?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}
```

### ReviewSession

**Purpose:** Track daily/weekly review state for persistence and gamification.

```typescript
interface ReviewSession {
  id: string;
  userId: string;
  type: "daily" | "weekly";
  status: "in_progress" | "completed" | "abandoned";
  currentStep?: string;
  itemsProcessed: number;
  itemsAgreed: number;
  itemsDisagreed: number;
  itemsUrgent: number;
  itemsHidden: number;
  startedAt: Date;
  completedAt?: Date;
  durationSeconds?: number;
}
```

### ClassificationAudit

**Purpose:** Audit trail for all AI classifications and user corrections. Enables learning and accountability.

```typescript
interface ClassificationAudit {
  id: string;
  inboxItemId: string;
  userId: string;

  // AI's original decision
  aiCategory: "action" | "note" | "reference" | "meeting" | "unknown";
  aiConfidence: number;
  aiReasoning: string;
  aiModel: string;
  aiProcessedAt: Date;

  // User's response
  userAction: "agree" | "disagree" | "urgent" | "hide" | null;
  userCorrection?: {
    correctedCategory?: string;
    correctedProject?: string;
    correctedArea?: string;
    feedback?: string;
  };
  userReviewedAt?: Date;

  // Metadata
  reviewType: "daily_swipe" | "weekly_review" | "manual";
  sessionId?: string;
  createdAt: Date;
}
```

### Entity Relationship Diagram

```mermaid
erDiagram
    User ||--o{ InboxItem : owns
    User ||--o{ Note : owns
    User ||--o{ Action : owns
    User ||--o{ Project : owns
    User ||--o{ Area : owns
    User ||--o{ Resource : owns
    User ||--o{ Objective : owns
    User ||--o{ Conversation : owns
    User ||--o{ ReviewSession : owns

    InboxItem ||--o{ Action : spawns
    InboxItem ||--o| Note : becomes
    InboxItem ||--o{ ClassificationAudit : has

    Project ||--o{ Note : contains
    Project ||--o{ Action : contains
    Area ||--o{ Note : contains
    Area ||--o{ Action : contains
    Resource ||--o{ Note : contains

    Objective ||--o| Objective : parent
    Objective ||--o{ Action : linked
    Objective ||--o{ Project : linked

    Conversation ||--o{ Action : extracts
```

---

## API Specification

Bee uses **tRPC** for type-safe frontend-backend communication and **REST** for n8n webhook callbacks.

### tRPC Router Structure

```typescript
// Main router organization
const appRouter = router({
  inbox: inboxRouter,
  actions: actionsRouter,
  notes: notesRouter,
  projects: projectsRouter,
  areas: areasRouter,
  resources: resourcesRouter,
  objectives: objectivesRouter,
  conversations: conversationsRouter,
  review: reviewRouter,
  search: searchRouter,
  calendar: calendarRouter,
  user: userRouter,
});
```

### Key tRPC Procedures

#### Inbox Router

```typescript
const inboxRouter = router({
  // Queries
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(["pending", "processing", "reviewed", "archived"]).optional(),
        limit: z.number().default(50),
        cursor: z.string().optional(),
      })
    )
    .query(/* returns paginated inbox items */),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(/* returns single inbox item with classification */),

  getReviewQueue: protectedProcedure
    .input(
      z.object({
        queue: z.enum(["needs_review", "disagreements", "receipts"]),
      })
    )
    .query(/* returns items for weekly review */),

  // Mutations
  capture: protectedProcedure
    .input(
      z.object({
        type: z.enum(["manual", "image", "voice"]),
        content: z.string(),
        mediaUrl: z.string().optional(),
      })
    )
    .mutation(/* creates inbox item, triggers AI processing */),

  swipe: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        action: z.enum(["agree", "disagree", "urgent", "hide"]),
        correction: z
          .object({
            category: z.string().optional(),
            projectId: z.string().optional(),
            areaId: z.string().optional(),
            feedback: z.string().optional(),
          })
          .optional(),
      })
    )
    .mutation(/* processes swipe, creates audit record */),

  archive: protectedProcedure.input(z.object({ id: z.string() })).mutation(/* archives item */),

  declareBankruptcy: protectedProcedure.mutation(/* bulk archives all pending items */),
});
```

#### Actions Router

```typescript
const actionsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(["pending", "in_progress", "completed", "archived"]).optional(),
        projectId: z.string().optional(),
        areaId: z.string().optional(),
        priority: z.enum(["urgent", "high", "normal", "low"]).optional(),
      })
    )
    .query(/* returns filtered actions */),

  create: protectedProcedure
    .input(
      z.object({
        description: z.string(),
        priority: z.enum(["urgent", "high", "normal", "low"]).default("normal"),
        dueDate: z.date().optional(),
        projectId: z.string().optional(),
        areaId: z.string().optional(),
        objectiveId: z.string().optional(),
      })
    )
    .mutation(/* creates action */),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        description: z.string().optional(),
        status: z.enum(["pending", "in_progress", "completed", "archived"]).optional(),
        priority: z.enum(["urgent", "high", "normal", "low"]).optional(),
        // ... other fields
      })
    )
    .mutation(/* updates action */),

  scheduleTimeBlock: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        startTime: z.date(),
        duration: z.number(), // minutes
      })
    )
    .mutation(/* creates calendar event via n8n */),
});
```

#### Search Router

```typescript
const searchRouter = router({
  semantic: protectedProcedure
    .input(
      z.object({
        query: z.string(),
        types: z.array(z.enum(["note", "action", "conversation", "inbox"])).optional(),
        projectId: z.string().optional(),
        areaId: z.string().optional(),
        limit: z.number().default(20),
      })
    )
    .query(/* vector similarity search across all content */),

  keyword: protectedProcedure
    .input(
      z.object({
        query: z.string(),
        // ... filters
      })
    )
    .query(/* full-text search */),
});
```

#### Review Router

```typescript
const reviewRouter = router({
  startSession: protectedProcedure
    .input(
      z.object({
        type: z.enum(["daily", "weekly"]),
      })
    )
    .mutation(/* creates review session */),

  getCurrentSession: protectedProcedure.query(/* returns active session if exists */),

  completeSession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(/* marks session complete, calculates stats */),

  getWeeklyStats: protectedProcedure.query(/* returns calendar summary, queue counts */),
});
```

### REST Endpoints (for n8n webhooks)

```yaml
# POST /api/webhooks/email-received
# Called by n8n when email is forwarded to inbox
Request:
  headers:
    x-webhook-secret: string
  body:
    from: string
    subject: string
    body: string
    attachments: Array<{name: string, url: string}>
Response:
  inboxItemId: string

# POST /api/webhooks/classification-complete
# Called by n8n after AI classification
Request:
  headers:
    x-webhook-secret: string
  body:
    inboxItemId: string
    classification:
      category: string
      confidence: number
      reasoning: string
      extractedActions: Array<ActionCandidate>
      tags: Array<Tag>
Response:
  success: boolean

# GET /api/webhooks/calendar-events
# Called by n8n to fetch calendar for display
Request:
  headers:
    x-webhook-secret: string
  query:
    startDate: string (ISO)
    endDate: string (ISO)
Response:
  events: Array<CalendarEvent>
```

---

## Components

### Backend Components

#### InboxService

**Responsibility:** Manages the unified inbox - capture, processing queue, status transitions.

**Key Interfaces:**

- `capture(input: CaptureInput): Promise<InboxItem>` - Create new inbox item
- `triggerClassification(itemId: string): Promise<void>` - Send to n8n for AI processing
- `updateClassification(itemId: string, classification: AIClassification): Promise<void>`
- `processSwipe(itemId: string, swipe: SwipeAction): Promise<void>`

**Dependencies:** Prisma, n8n webhook client, WebhookRetryService

**Technology Stack:** tRPC procedures, Prisma ORM

#### WebhookRetryService

**Responsibility:** Handles failed webhook retries with exponential backoff. Ensures no webhook calls are silently lost.

**Key Interfaces:**

- `callWithRetry(type: string, url: string, payload: object): Promise<Response>` - Call webhook with automatic retry
- `recordFailure(type: string, url: string, payload: object, error: string): Promise<FailedWebhook>` - Record failed webhook
- `retryPending(): Promise<void>` - Process pending retries (called by cron/scheduler)
- `getFailedWebhooks(status?: string): Promise<FailedWebhook[]>` - List failed webhooks for monitoring

**Retry Strategy:**

- Exponential backoff: 1min → 5min → 15min (3 retries max)
- After max retries: status = 'failed', alert sent to monitoring
- Successful retry: status = 'succeeded', resolvedAt set

**Dependencies:** Prisma, fetch/axios

#### ClassificationService

**Responsibility:** Handles AI classification logic, confidence routing, audit trail.

**Key Interfaces:**

- `classify(content: string, context: ClassificationContext): Promise<AIClassification>`
- `extractActions(content: string): Promise<ActionCandidate[]>`
- `recordAudit(audit: ClassificationAudit): Promise<void>`
- `getAuditHistory(itemId: string): Promise<ClassificationAudit[]>`

**Dependencies:** n8n (for LLM calls), Prisma

#### SearchService

**Responsibility:** Semantic and keyword search across all content.

**Key Interfaces:**

- `semanticSearch(query: string, filters: SearchFilters): Promise<SearchResult[]>`
- `generateEmbedding(text: string): Promise<number[]>`
- `indexItem(item: Searchable): Promise<void>`

**Dependencies:** Supabase pgvector, embedding model (via n8n/LLM)

#### EmailService

**Responsibility:** Provider-agnostic email operations. Abstracts IMAP/OAuth differences.

**Key Interfaces:**

- `fetchEmails(accountId: string, options: FetchOptions): Promise<Email[]>`
- `sendEmail(accountId: string, email: EmailDraft): Promise<void>`
- `markAsRead(accountId: string, emailId: string): Promise<void>`
- `getUnreadCount(accountId: string): Promise<number>`

**Provider Strategy:**

```typescript
// Simplified provider abstraction
interface EmailProvider {
  fetchEmails(options: FetchOptions): Promise<Email[]>;
  sendEmail(email: EmailDraft): Promise<void>;
}

class ImapEmailProvider implements EmailProvider {
  constructor(private config: ImapConfig) {}
  // Uses imapflow + nodemailer
}

class MicrosoftOAuthEmailProvider implements EmailProvider {
  constructor(private tokens: OAuthTokens) {}
  // Uses Microsoft Graph API
}

class GoogleOAuthEmailProvider implements EmailProvider {
  constructor(private tokens: OAuthTokens) {}
  // Uses Gmail API
}
```

**Dependencies:** imapflow, nodemailer, n8n (for OAuth providers)

#### CalendarService

**Responsibility:** Provider-agnostic calendar operations. Abstracts CalDAV/OAuth differences.

**Key Interfaces:**

- `getEvents(accountId: string, start: Date, end: Date): Promise<CalendarEvent[]>`
- `createEvent(accountId: string, event: CalendarEventInput): Promise<string>` - Returns event ID
- `updateEvent(accountId: string, eventId: string, updates: Partial<CalendarEventInput>): Promise<void>`
- `deleteEvent(accountId: string, eventId: string): Promise<void>`
- `getWeeklySummary(accountId: string): Promise<CalendarSummary>`

**Provider Strategy:**

```typescript
interface CalendarProvider {
  getEvents(start: Date, end: Date): Promise<CalendarEvent[]>;
  createEvent(event: CalendarEventInput): Promise<string>;
}

class CalDavCalendarProvider implements CalendarProvider {
  constructor(private config: CalDavConfig) {}
  // Uses tsdav library
}

class MicrosoftOAuthCalendarProvider implements CalendarProvider {
  constructor(private tokens: OAuthTokens) {}
  // Uses Microsoft Graph API
}

class GoogleOAuthCalendarProvider implements CalendarProvider {
  constructor(private tokens: OAuthTokens) {}
  // Uses Google Calendar API
}
```

**Dependencies:** tsdav, n8n (for OAuth providers)

#### ReviewService

**Responsibility:** Daily/weekly review session management.

**Key Interfaces:**

- `startSession(type: 'daily' | 'weekly'): Promise<ReviewSession>`
- `getNextItem(sessionId: string): Promise<InboxItem | null>`
- `recordSwipe(sessionId: string, itemId: string, action: SwipeAction): Promise<void>`
- `completeSession(sessionId: string): Promise<ReviewStats>`

**Dependencies:** InboxService, ClassificationService, Prisma

### Frontend Components

#### SwipeCard

**Responsibility:** Swipeable card for daily review with gesture handling.

**Key Interfaces:**

- Props: `item: InboxItem`, `onSwipe: (action: SwipeAction) => void`
- Gestures: right (agree), left (disagree), up (urgent), down (hide)

**Dependencies:** @use-gesture/react, Framer Motion

#### ReviewScreen

**Responsibility:** Daily swipe review experience with card stack.

**Key Interfaces:**

- State: current item, progress, session stats
- Actions: swipe, undo, complete session

**Dependencies:** SwipeCard, ReviewService (via tRPC)

#### CaptureModal

**Responsibility:** Quick capture overlay accessible from any screen.

**Key Interfaces:**

- Props: `onClose: () => void`
- Inputs: text, camera, voice recording

**Dependencies:** Supabase Storage (for media upload)

#### WeeklyReviewWizard

**Responsibility:** Step-by-step weekly review flow.

**Key Interfaces:**

- Steps: Objectives → Priorities → Actions → Inbox
- State: current step, completion status per step

**Dependencies:** ObjectivesPanel, ActionsPanel, InboxQueuePanel, CalendarSummary

### Component Diagram

```mermaid
graph TB
    subgraph "Frontend Components"
        App[App Shell]
        Dashboard[Dashboard]
        Capture[CaptureModal]
        DailyReview[ReviewScreen]
        WeeklyReview[WeeklyReviewWizard]
        Chat[ChatInterface]
        Search[SearchPanel]
        Calendar[CalendarView]
    end

    subgraph "Backend Services"
        InboxSvc[InboxService]
        ClassSvc[ClassificationService]
        SearchSvc[SearchService]
        CalSvc[CalendarService]
        ReviewSvc[ReviewService]
        ConvSvc[ConversationService]
    end

    subgraph "External"
        N8N[n8n Workflows]
        Supabase[(Supabase)]
        LibreChat[LibreChat]
    end

    App --> Dashboard
    App --> Capture
    App --> DailyReview
    App --> WeeklyReview
    App --> Chat
    App --> Search
    App --> Calendar

    Capture --> InboxSvc
    DailyReview --> ReviewSvc
    WeeklyReview --> ReviewSvc
    Chat --> ConvSvc
    Search --> SearchSvc
    Calendar --> CalSvc

    InboxSvc --> N8N
    InboxSvc --> Supabase
    ClassSvc --> N8N
    SearchSvc --> Supabase
    CalSvc --> N8N
    ConvSvc --> LibreChat
```

---

## External APIs

### Email Integration (Multi-Provider)

Bee supports multiple email providers through a unified interface. IMAP/SMTP is the default, with optional OAuth for enhanced features.

#### IMAP/SMTP (Default - Any Provider)

- **Purpose:** Read and send emails from any provider
- **Protocol:** IMAP for reading, SMTP for sending
- **Authentication:** Username + App-specific password

**Common Provider Settings:**

| Provider | IMAP Host | IMAP Port | SMTP Host | SMTP Port |
|----------|-----------|-----------|-----------|-----------|
| Gmail | imap.gmail.com | 993 (SSL) | smtp.gmail.com | 587 (TLS) |
| Outlook/Hotmail | outlook.office365.com | 993 (SSL) | smtp.office365.com | 587 (TLS) |
| Yahoo | imap.mail.yahoo.com | 993 (SSL) | smtp.mail.yahoo.com | 587 (TLS) |
| iCloud | imap.mail.me.com | 993 (SSL) | smtp.mail.me.com | 587 (TLS) |

**App Password Setup (per provider):**

- **Gmail:** Google Account → Security → 2-Step Verification → App passwords
- **Outlook:** Microsoft Account → Security → App passwords (requires 2FA)
- **Yahoo:** Account Security → Generate app password

**Integration via n8n:**

```yaml
# n8n IMAP workflow
Trigger: Webhook from Bee app
Action: IMAP node fetches new emails
Output: Parsed email data returned to Bee
```

#### Microsoft Graph API (Optional OAuth)

- **Purpose:** Enhanced Outlook/Calendar/OneDrive integration
- **Documentation:** https://docs.microsoft.com/en-us/graph/
- **When to use:** User has registered an OAuth app (personal or work account with admin access)
- **Rate Limits:** 10,000 requests per 10 minutes per app

**Key Endpoints:**

- `GET /me/messages` - Fetch emails
- `GET /me/calendar/events` - Calendar events
- `POST /me/calendar/events` - Create time blocks
- `GET /me/drive/root/children` - OneDrive folders

#### Google APIs (Optional OAuth)

- **Purpose:** Enhanced Gmail/Calendar/Drive integration
- **Documentation:** https://developers.google.com/gmail/api
- **When to use:** User has registered an OAuth app in Google Cloud Console

### Calendar Integration (Multi-Provider)

#### CalDAV (Default - Any Provider)

- **Purpose:** Read and create calendar events from any CalDAV-compatible provider
- **Protocol:** CalDAV (WebDAV extension for calendaring)
- **Authentication:** Username + App-specific password

**Common Provider CalDAV URLs:**

| Provider | CalDAV URL |
|----------|------------|
| Google Calendar | `https://apidata.googleusercontent.com/caldav/v2/{email}/events` |
| iCloud | `https://caldav.icloud.com/{user-id}/calendars/` |
| Outlook | `https://outlook.office365.com/caldav/calendar/` |
| Fastmail | `https://caldav.fastmail.com/dav/calendars/user/{email}/` |

**Integration via n8n:**

```yaml
# n8n CalDAV workflow
Trigger: Webhook from Bee app
Action: HTTP Request to CalDAV endpoint
Output: Parsed calendar events returned to Bee
```

#### OAuth Calendar APIs (Optional)

- **Microsoft Graph:** `GET /me/calendar/events`, `POST /me/calendar/events`
- **Google Calendar API:** `GET /calendars/{id}/events`, `POST /calendars/{id}/events`

### LLM APIs (via n8n/LibreChat)

- **Purpose:** AI classification, action extraction, chat
- **Providers:** OpenAI, Anthropic, Google
- **Authentication:** API keys stored in n8n credentials
- **Rate Limits:** Vary by provider and tier

**Key Operations:**

- Classification prompt → returns category, confidence, reasoning
- Action extraction prompt → returns structured action candidates
- Chat completion → streaming responses via LibreChat

**Integration Notes:** n8n handles LLM routing and can switch providers. LibreChat provides the chat UI and manages conversation state with MCP protocol for tool-calling.

### n8n Webhook Interface

- **Purpose:** Workflow orchestration for async operations
- **Base URL:** https://n8n.domain.com/webhook/
- **Authentication:** Webhook secrets in headers

**Key Webhooks:**

- `POST /webhook/classify-inbox-item` - Trigger AI classification
- `POST /webhook/fetch-calendar` - Get calendar events
- `POST /webhook/create-calendar-event` - Create time block
- `POST /webhook/sync-onedrive` - Trigger OneDrive sync

---

## Core Workflows

### Capture to Classification Flow

```mermaid
sequenceDiagram
    participant U as User
    participant App as Next.js App
    participant DB as Supabase
    participant N8N as n8n
    participant LLM as LLM API

    U->>App: Capture (text/image/voice)
    App->>DB: Create InboxItem (status: pending)
    App->>U: Success toast
    App->>N8N: POST /webhook/classify-inbox-item
    N8N->>LLM: Classification prompt
    LLM->>N8N: Category, confidence, actions
    N8N->>App: POST /api/webhooks/classification-complete
    App->>DB: Update InboxItem with classification
    App->>DB: Create ClassificationAudit record
    Note over DB: Item ready for review
```

### Daily Swipe Review Flow

```mermaid
sequenceDiagram
    participant U as User
    participant App as Next.js App
    participant DB as Supabase

    U->>App: Open Daily Review
    App->>DB: Get/Create ReviewSession
    App->>DB: Fetch pending items (sorted by confidence)
    App->>U: Show first card

    loop For each item
        U->>App: Swipe (agree/disagree/urgent/hide)
        App->>DB: Update InboxItem status
        App->>DB: Create ClassificationAudit
        App->>DB: Update ReviewSession stats
        App->>U: Animate card, show next
    end

    App->>DB: Complete ReviewSession
    App->>U: Show summary (items processed, time)
```

### Weekly Review Flow

```mermaid
sequenceDiagram
    participant U as User
    participant App as Next.js App
    participant DB as Supabase
    participant N8N as n8n

    U->>App: Start Weekly Review
    App->>DB: Create ReviewSession (type: weekly)

    Note over App: Step 1: Objectives
    App->>DB: Fetch current objectives
    App->>U: Review/update objectives
    U->>App: Confirm objectives

    Note over App: Step 2: Calendar Check
    App->>N8N: Fetch calendar summary
    N8N->>App: Meeting hours, focus time
    App->>U: Show calendar summary

    Note over App: Step 3: Priority Actions
    App->>DB: Fetch priority actions
    App->>U: Review/reorder priorities

    Note over App: Step 4: Process Queues
    App->>DB: Fetch Needs Review queue
    loop Until queues empty
        U->>App: Process item (file/convert/archive)
        App->>DB: Update item
    end

    App->>DB: Complete ReviewSession
    App->>U: Weekly review complete!
```

---

## Database Schema

### Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id                   String    @id @default(uuid())
  email                String    @unique
  name                 String
  passwordHash         String?   // For email/password login
  avatarUrl            String?
  settings             Json      @default("{}")
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  inboxItems           InboxItem[]
  notes                Note[]
  actions              Action[]
  projects             Project[]
  areas                Area[]
  resources            Resource[]
  objectives           Objective[]
  conversations        Conversation[]
  reviewSessions       ReviewSession[]
  emailAccounts        EmailAccount[]
  calendarAccounts     CalendarAccount[]
}

model EmailAccount {
  id                String    @id @default(uuid())
  userId            String
  user              User      @relation(fields: [userId], references: [id])
  name              String    // User-friendly name
  email             String
  provider          String    // imap, microsoft_oauth, google_oauth
  isDefault         Boolean   @default(false)

  // IMAP/SMTP credentials (encrypted)
  imapHost          String?
  imapPort          Int?
  smtpHost          String?
  smtpPort          Int?
  username          String?
  password          String?   // Encrypted app-specific password

  // OAuth credentials (encrypted)
  oauthAccessToken  String?
  oauthRefreshToken String?
  oauthExpiresAt    DateTime?

  // Sync state
  lastSyncAt        DateTime?
  syncStatus        String    @default("idle") // idle, syncing, error
  syncError         String?

  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@index([userId])
  @@index([userId, isDefault])
}

model CalendarAccount {
  id                String    @id @default(uuid())
  userId            String
  user              User      @relation(fields: [userId], references: [id])
  name              String    // User-friendly name
  provider          String    // caldav, microsoft_oauth, google_oauth
  isDefault         Boolean   @default(false)

  // CalDAV credentials (encrypted)
  caldavUrl         String?
  username          String?
  password          String?   // Encrypted app-specific password

  // OAuth credentials (encrypted)
  oauthAccessToken  String?
  oauthRefreshToken String?
  oauthExpiresAt    DateTime?

  // Sync state
  lastSyncAt        DateTime?
  syncStatus        String    @default("idle") // idle, syncing, error
  syncError         String?

  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@index([userId])
  @@index([userId, isDefault])
}

model InboxItem {
  id               String    @id @default(uuid())
  userId           String
  user             User      @relation(fields: [userId], references: [id])
  type             String    // manual, image, voice, email, forward
  content          String
  mediaUrl         String?
  source           String
  status           String    @default("pending") // pending, processing, reviewed, archived
  aiClassification Json?
  extractedActions Json      @default("[]")
  tags             Json      @default("[]")
  embedding        Unsupported("vector(1536)")?
  createdAt        DateTime  @default(now())
  reviewedAt       DateTime?
  archivedAt       DateTime?

  audits           ClassificationAudit[]
  spawnedActions   Action[]  @relation("InboxToAction")
  note             Note?     @relation("InboxToNote")

  @@index([userId, status])
  @@index([userId, createdAt])
}

model ClassificationAudit {
  id             String    @id @default(uuid())
  inboxItemId    String
  inboxItem      InboxItem @relation(fields: [inboxItemId], references: [id])
  userId         String

  aiCategory     String
  aiConfidence   Float
  aiReasoning    String
  aiModel        String
  aiProcessedAt  DateTime

  userAction     String?   // agree, disagree, urgent, hide
  userCorrection Json?
  userReviewedAt DateTime?

  reviewType     String    // daily_swipe, weekly_review, manual
  sessionId      String?
  createdAt      DateTime  @default(now())

  @@index([inboxItemId])
  @@index([userId, createdAt])
}

model Note {
  id                String    @id @default(uuid())
  userId            String
  user              User      @relation(fields: [userId], references: [id])
  title             String
  content           String
  projectId         String?
  project           Project?  @relation(fields: [projectId], references: [id])
  areaId            String?
  area              Area?     @relation(fields: [areaId], references: [id])
  resourceId        String?
  resource          Resource? @relation(fields: [resourceId], references: [id])
  sourceInboxItemId String?   @unique
  sourceInboxItem   InboxItem? @relation("InboxToNote", fields: [sourceInboxItemId], references: [id])
  tags              String[]
  embedding         Unsupported("vector(1536)")?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@index([userId])
  @@index([projectId])
  @@index([areaId])
}

model Action {
  id                String    @id @default(uuid())
  userId            String
  user              User      @relation(fields: [userId], references: [id])
  description       String
  status            String    @default("pending") // pending, in_progress, completed, archived
  priority          String    @default("normal") // urgent, high, normal, low
  dueDate           DateTime?
  scheduledFor      DateTime?
  calendarEventId   String?
  projectId         String?
  project           Project?  @relation(fields: [projectId], references: [id])
  areaId            String?
  area              Area?     @relation(fields: [areaId], references: [id])
  objectiveId       String?
  objective         Objective? @relation(fields: [objectiveId], references: [id])
  sourceInboxItemId String?
  sourceInboxItem   InboxItem? @relation("InboxToAction", fields: [sourceInboxItemId], references: [id])
  completedAt       DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@index([userId, status])
  @@index([projectId])
  @@index([dueDate])
}

model Project {
  id              String    @id @default(uuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  name            String
  description     String?
  status          String    @default("active") // active, completed, on_hold, archived
  oneDriveFolderId String?
  objectiveId     String?
  objective       Objective? @relation(fields: [objectiveId], references: [id])
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  notes           Note[]
  actions         Action[]

  @@index([userId, status])
}

model Area {
  id              String    @id @default(uuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  name            String
  description     String?
  oneDriveFolderId String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  notes           Note[]
  actions         Action[]

  @@index([userId])
}

model Resource {
  id              String    @id @default(uuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  name            String
  description     String?
  oneDriveFolderId String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  notes           Note[]

  @@index([userId])
}

model Objective {
  id          String    @id @default(uuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id])
  title       String
  description String?
  timeframe   String    // yearly, monthly, weekly
  parentId    String?
  parent      Objective? @relation("ObjectiveHierarchy", fields: [parentId], references: [id])
  children    Objective[] @relation("ObjectiveHierarchy")
  status      String    @default("active") // active, completed, abandoned
  startDate   DateTime
  endDate     DateTime
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  actions     Action[]
  projects    Project[]

  @@index([userId, timeframe])
  @@index([parentId])
}

model Conversation {
  id                String    @id @default(uuid())
  userId            String
  user              User      @relation(fields: [userId], references: [id])
  title             String
  model             String    // claude, gpt, gemini
  messages          Json      @default("[]")
  summary           String?
  extractedInsights String[]
  extractedActions  Json      @default("[]")
  projectId         String?
  areaId            String?
  embedding         Unsupported("vector(1536)")?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@index([userId])
}

model ReviewSession {
  id              String    @id @default(uuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  type            String    // daily, weekly
  status          String    @default("in_progress") // in_progress, completed, abandoned
  currentStep     String?
  itemsProcessed  Int       @default(0)
  itemsAgreed     Int       @default(0)
  itemsDisagreed  Int       @default(0)
  itemsUrgent     Int       @default(0)
  itemsHidden     Int       @default(0)
  startedAt       DateTime  @default(now())
  completedAt     DateTime?
  durationSeconds Int?

  @@index([userId, type])
}

model FailedWebhook {
  id          String    @id @default(uuid())
  type        String    // classify, calendar, sync, etc.
  targetUrl   String    // The webhook URL that failed
  payload     Json      // Original request payload
  error       String    // Error message
  statusCode  Int?      // HTTP status code if applicable
  retryCount  Int       @default(0)
  maxRetries  Int       @default(3)
  nextRetry   DateTime? // When to retry next
  status      String    @default("pending") // pending, retrying, failed, succeeded
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  resolvedAt  DateTime? // When finally succeeded or gave up

  @@index([status, nextRetry])
  @@index([type])
}
```

### Vector Search Setup

```sql
-- Enable pgvector extension (done in Supabase dashboard)
CREATE EXTENSION IF NOT EXISTS vector;

-- Create similarity search function
CREATE OR REPLACE FUNCTION search_similar(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content text,
  similarity float,
  source_type text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    items.id,
    items.content,
    1 - (items.embedding <=> query_embedding) as similarity,
    'inbox' as source_type
  FROM "InboxItem" items
  WHERE items.embedding IS NOT NULL
    AND (p_user_id IS NULL OR items."userId" = p_user_id)
    AND 1 - (items.embedding <=> query_embedding) > match_threshold

  UNION ALL

  SELECT
    notes.id,
    notes.content,
    1 - (notes.embedding <=> query_embedding) as similarity,
    'note' as source_type
  FROM "Note" notes
  WHERE notes.embedding IS NOT NULL
    AND (p_user_id IS NULL OR notes."userId" = p_user_id)
    AND 1 - (notes.embedding <=> query_embedding) > match_threshold

  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
```

---

## Frontend Architecture

### Component Organization

```
apps/web/src/
├── app/                      # Next.js App Router
│   ├── (auth)/              # Auth-required routes
│   │   ├── dashboard/       # Home dashboard
│   │   ├── inbox/           # Inbox list view
│   │   ├── review/          # Daily swipe review
│   │   ├── weekly/          # Weekly review wizard
│   │   ├── chat/            # AI chat interface
│   │   ├── search/          # Search results
│   │   ├── calendar/        # Calendar view
│   │   ├── projects/        # PARA: Projects
│   │   ├── areas/           # PARA: Areas
│   │   ├── resources/       # PARA: Resources
│   │   └── settings/        # User settings
│   ├── api/                 # API routes
│   │   ├── trpc/            # tRPC handler
│   │   └── webhooks/        # n8n webhook endpoints
│   ├── login/               # Login page
│   └── layout.tsx           # Root layout
├── components/
│   ├── ui/                  # shadcn/ui components
│   ├── inbox/               # Inbox-specific components
│   ├── review/              # Review components (SwipeCard, etc.)
│   ├── chat/                # Chat interface components
│   ├── calendar/            # Calendar components
│   └── shared/              # Shared components (Navigation, etc.)
├── hooks/                   # Custom React hooks
├── lib/                     # Utilities, config
├── stores/                  # Zustand stores
└── styles/                  # Global styles
```

### Component Template

```typescript
// Example: SwipeCard component
'use client';

import { motion, useMotionValue, useTransform } from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import type { InboxItem } from '@/packages/shared/types';

interface SwipeCardProps {
  item: InboxItem;
  onSwipe: (action: 'agree' | 'disagree' | 'urgent' | 'hide') => void;
}

export function SwipeCard({ item, onSwipe }: SwipeCardProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const opacity = useTransform(
    [x, y],
    ([latestX, latestY]) => {
      const distance = Math.sqrt(latestX ** 2 + latestY ** 2);
      return Math.max(0, 1 - distance / 500);
    }
  );

  const bind = useDrag(({ down, movement: [mx, my], velocity: [vx, vy] }) => {
    if (!down) {
      const threshold = 100;
      if (mx > threshold) onSwipe('agree');
      else if (mx < -threshold) onSwipe('disagree');
      else if (my < -threshold) onSwipe('urgent');
      else if (my > threshold) onSwipe('hide');

      // Reset position
      x.set(0);
      y.set(0);
    } else {
      x.set(mx);
      y.set(my);
    }
  });

  return (
    <motion.div
      {...bind()}
      style={{ x, y, rotate, opacity }}
      className="absolute w-full max-w-sm bg-white rounded-xl shadow-lg p-6"
    >
      <div className="text-sm text-gray-500 mb-2">
        {item.source} • {item.aiClassification?.category}
      </div>
      <p className="text-gray-900">{item.content}</p>
      <div className="mt-4 flex items-center gap-2">
        <span className="text-xs bg-gray-100 px-2 py-1 rounded">
          {Math.round((item.aiClassification?.confidence || 0) * 100)}% confident
        </span>
      </div>
    </motion.div>
  );
}
```

### State Management

```typescript
// stores/reviewStore.ts
import { create } from "zustand";
import type { InboxItem, ReviewSession } from "@/packages/shared/types";

interface ReviewState {
  session: ReviewSession | null;
  items: InboxItem[];
  currentIndex: number;

  // Actions
  startSession: (type: "daily" | "weekly") => Promise<void>;
  swipe: (action: "agree" | "disagree" | "urgent" | "hide") => Promise<void>;
  undo: () => void;
  completeSession: () => Promise<void>;
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  session: null,
  items: [],
  currentIndex: 0,

  startSession: async (type) => {
    // tRPC call to start session
    const session = await trpc.review.startSession.mutate({ type });
    const items = await trpc.inbox.getReviewQueue.query({
      queue: "needs_review",
    });
    set({ session, items, currentIndex: 0 });
  },

  swipe: async (action) => {
    const { items, currentIndex, session } = get();
    const item = items[currentIndex];

    // Optimistic update
    set({ currentIndex: currentIndex + 1 });

    // tRPC call
    await trpc.inbox.swipe.mutate({
      id: item.id,
      action,
    });
  },

  undo: () => {
    const { currentIndex } = get();
    if (currentIndex > 0) {
      set({ currentIndex: currentIndex - 1 });
      // TODO: Revert last swipe via tRPC
    }
  },

  completeSession: async () => {
    const { session } = get();
    if (session) {
      await trpc.review.completeSession.mutate({ sessionId: session.id });
      set({ session: null, items: [], currentIndex: 0 });
    }
  },
}));
```

### Routing Architecture

```
Route Organization:
├── / (redirect to /dashboard)
├── /login
├── /dashboard              # Home with priorities, inbox count, calendar
├── /inbox                  # Full inbox list
├── /review                 # Daily swipe review
├── /weekly                 # Weekly review wizard
├── /chat                   # AI conversations
├── /chat/[id]              # Specific conversation
├── /search                 # Search results
├── /calendar               # Calendar view
├── /projects               # Projects list
├── /projects/[id]          # Project detail
├── /areas                  # Areas list
├── /areas/[id]             # Area detail
├── /resources              # Resources list
├── /settings               # User settings
```

### Protected Route Pattern

```typescript
// app/(auth)/layout.tsx
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

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
      <Navigation />
      <main className="pb-20 md:pb-0 md:pl-64">
        {children}
      </main>
      <CaptureButton />
    </div>
  );
}
```

### API Client Setup

```typescript
// lib/trpc.ts
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@/server/routers';

export const trpc = createTRPCReact<AppRouter>();

// Provider setup in app/providers.tsx
export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: '/api/trpc',
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
```

---

## Backend Architecture

### Service Architecture

```
apps/web/src/server/
├── routers/                 # tRPC routers
│   ├── index.ts            # Main app router
│   ├── inbox.ts            # Inbox procedures
│   ├── actions.ts          # Actions procedures
│   ├── notes.ts            # Notes procedures
│   ├── projects.ts         # Projects procedures
│   ├── review.ts           # Review procedures
│   ├── search.ts           # Search procedures
│   └── calendar.ts         # Calendar procedures
├── services/               # Business logic
│   ├── inbox.service.ts
│   ├── classification.service.ts
│   ├── search.service.ts
│   ├── calendar.service.ts
│   └── review.service.ts
├── lib/                    # Utilities
│   ├── n8n.ts             # n8n webhook client
│   ├── supabase.ts        # Supabase client
│   └── embedding.ts       # Vector embedding utils
└── trpc.ts                # tRPC context and init
```

### Controller Template

```typescript
// server/routers/inbox.ts
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { inboxService } from "../services/inbox.service";

export const inboxRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(["pending", "processing", "reviewed", "archived"]).optional(),
        limit: z.number().default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return inboxService.list({
        userId: ctx.session.user.id,
        ...input,
      });
    }),

  capture: protectedProcedure
    .input(
      z.object({
        type: z.enum(["manual", "image", "voice"]),
        content: z.string().min(1),
        mediaUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const item = await inboxService.capture({
        userId: ctx.session.user.id,
        ...input,
      });

      // Trigger async classification via n8n
      await inboxService.triggerClassification(item.id);

      return item;
    }),

  swipe: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        action: z.enum(["agree", "disagree", "urgent", "hide"]),
        correction: z
          .object({
            category: z.string().optional(),
            projectId: z.string().optional(),
            feedback: z.string().optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return inboxService.processSwipe({
        userId: ctx.session.user.id,
        ...input,
      });
    }),
});
```

### Data Access Layer

```typescript
// server/services/inbox.service.ts
import { prisma } from "@/packages/db";
import { n8nClient } from "../lib/n8n";

export const inboxService = {
  async list({ userId, status, limit, cursor }: ListParams) {
    return prisma.inboxItem.findMany({
      where: {
        userId,
        ...(status && { status }),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });
  },

  async capture({ userId, type, content, mediaUrl }: CaptureParams) {
    return prisma.inboxItem.create({
      data: {
        userId,
        type,
        content,
        mediaUrl,
        source: "capture",
        status: "pending",
      },
    });
  },

  async triggerClassification(itemId: string) {
    const item = await prisma.inboxItem.findUnique({
      where: { id: itemId },
    });

    await prisma.inboxItem.update({
      where: { id: itemId },
      data: { status: "processing" },
    });

    // Call n8n webhook with retry handling
    await webhookRetryService.callWithRetry("classify", "/webhook/classify-inbox-item", {
      itemId,
      content: item?.content,
      type: item?.type,
    });
  },

  async processSwipe({ userId, id, action, correction }: SwipeParams) {
    const item = await prisma.inboxItem.findFirst({
      where: { id, userId },
    });

    if (!item) throw new Error("Item not found");

    // Create audit record
    await prisma.classificationAudit.create({
      data: {
        inboxItemId: id,
        userId,
        aiCategory: item.aiClassification?.category || "unknown",
        aiConfidence: item.aiClassification?.confidence || 0,
        aiReasoning: item.aiClassification?.reasoning || "",
        aiModel: item.aiClassification?.modelUsed || "unknown",
        aiProcessedAt: item.aiClassification?.processedAt || new Date(),
        userAction: action,
        userCorrection: correction,
        userReviewedAt: new Date(),
        reviewType: "daily_swipe",
      },
    });

    // Update item based on action
    const updates: any = { reviewedAt: new Date() };

    if (action === "agree") {
      updates.status = "reviewed";
    } else if (action === "hide") {
      updates.status = "archived";
      updates.archivedAt = new Date();
    } else if (action === "urgent") {
      updates.status = "reviewed";
      // Create urgent action if applicable
    }

    return prisma.inboxItem.update({
      where: { id },
      data: updates,
    });
  },
};
```

### Webhook Retry Service

```typescript
// server/services/webhook-retry.service.ts
import { prisma } from "@/packages/db";

const N8N_BASE_URL = process.env.N8N_WEBHOOK_URL!;
const RETRY_DELAYS = [60, 300, 900]; // 1min, 5min, 15min in seconds

export const webhookRetryService = {
  async callWithRetry(type: string, path: string, payload: object): Promise<Response> {
    const url = `${N8N_BASE_URL}${path}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Secret": process.env.N8N_WEBHOOK_SECRET!,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      // Record failure for retry
      await this.recordFailure(type, url, payload, (error as Error).message);
      throw error;
    }
  },

  async recordFailure(
    type: string,
    targetUrl: string,
    payload: object,
    error: string,
    statusCode?: number
  ) {
    const nextRetry = new Date(Date.now() + RETRY_DELAYS[0] * 1000);

    return prisma.failedWebhook.create({
      data: {
        type,
        targetUrl,
        payload,
        error,
        statusCode,
        nextRetry,
        status: "pending",
      },
    });
  },

  async retryPending(): Promise<void> {
    const pendingWebhooks = await prisma.failedWebhook.findMany({
      where: {
        status: { in: ["pending", "retrying"] },
        nextRetry: { lte: new Date() },
      },
    });

    for (const webhook of pendingWebhooks) {
      try {
        const response = await fetch(webhook.targetUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Secret": process.env.N8N_WEBHOOK_SECRET!,
          },
          body: JSON.stringify(webhook.payload),
        });

        if (response.ok) {
          // Success!
          await prisma.failedWebhook.update({
            where: { id: webhook.id },
            data: {
              status: "succeeded",
              resolvedAt: new Date(),
            },
          });
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        const newRetryCount = webhook.retryCount + 1;

        if (newRetryCount >= webhook.maxRetries) {
          // Max retries reached - mark as failed
          await prisma.failedWebhook.update({
            where: { id: webhook.id },
            data: {
              status: "failed",
              retryCount: newRetryCount,
              error: (error as Error).message,
              resolvedAt: new Date(),
            },
          });
          // TODO: Send alert to Sentry/monitoring
          console.error(`Webhook permanently failed: ${webhook.type}`, webhook.id);
        } else {
          // Schedule next retry with exponential backoff
          const nextDelay = RETRY_DELAYS[newRetryCount] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
          await prisma.failedWebhook.update({
            where: { id: webhook.id },
            data: {
              status: "retrying",
              retryCount: newRetryCount,
              nextRetry: new Date(Date.now() + nextDelay * 1000),
              error: (error as Error).message,
            },
          });
        }
      }
    }
  },

  async getFailedWebhooks(status?: string) {
    return prisma.failedWebhook.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  },
};
```

### Webhook Retry Cron Job

The `retryPending()` function should be called periodically. Options:

1. **n8n Scheduled Trigger** (Recommended): Create an n8n workflow that calls `/api/webhooks/retry-pending` every minute
2. **Vercel Cron** (if using Vercel): Add to `vercel.json`
3. **node-cron** (if self-hosted): Add to PM2 startup

```typescript
// app/api/webhooks/retry-pending/route.ts
import { webhookRetryService } from "@/server/services/webhook-retry.service";

export async function POST(request: Request) {
  const authHeader = request.headers.get("x-webhook-secret");
  if (authHeader !== process.env.N8N_WEBHOOK_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  await webhookRetryService.retryPending();
  return Response.json({ success: true });
}
```

### Authentication Architecture

Bee separates **app authentication** (logging into Bee) from **service authentication** (connecting email/calendar providers).

#### App Authentication (Logging into Bee)

Users can sign into Bee using credentials stored in the database or via OAuth. For MVP, we use simple email/password with option to add OAuth later.

```mermaid
sequenceDiagram
    participant U as User
    participant App as Next.js
    participant Auth as NextAuth.js
    participant DB as Database

    U->>App: Enter email/password
    App->>Auth: Validate credentials
    Auth->>DB: Check user record
    DB->>Auth: User found, password matches
    Auth->>App: Create session
    App->>U: Redirect to dashboard
```

#### Service Authentication (Email/Calendar Providers)

Email and calendar providers are connected separately via the Settings page. Users add accounts with either:
1. **IMAP/CalDAV credentials** (app-specific passwords)
2. **OAuth tokens** (if they've registered an OAuth app)

```mermaid
sequenceDiagram
    participant U as User
    participant App as Bee App
    participant Settings as Settings Page
    participant DB as Database

    U->>Settings: Add Email Account
    Settings->>U: Choose provider type (IMAP or OAuth)

    alt IMAP Provider
        U->>Settings: Enter IMAP host, port, app password
        Settings->>App: Test connection
        App->>Settings: Connection successful
        Settings->>DB: Save encrypted credentials
    else OAuth Provider
        U->>Settings: Click "Connect with Microsoft/Google"
        Settings->>App: Initiate OAuth flow
        App->>U: Complete OAuth
        Settings->>DB: Save encrypted tokens
    end
```

### Auth Middleware

```typescript
// lib/auth.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/packages/db";
import { verifyPassword } from "./password";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    // Primary: Email/Password login
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        const isValid = await verifyPassword(
          credentials.password as string,
          user.passwordHash
        );

        if (!isValid) {
          return null;
        }

        return { id: user.id, email: user.email, name: user.name };
      },
    }),

    // Optional: Google OAuth for app login (not for Gmail access)
    ...(process.env.GOOGLE_CLIENT_ID
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
});
```

### Email/Calendar Account Management

Credentials for email and calendar providers are managed separately and stored encrypted.

```typescript
// server/services/account.service.ts
import { prisma } from "@/packages/db";
import { encrypt, decrypt } from "@/lib/encryption";

export const accountService = {
  // Add IMAP email account
  async addImapEmailAccount(userId: string, config: ImapConfig) {
    // Test connection first
    const testResult = await testImapConnection(config);
    if (!testResult.success) {
      throw new Error(`Connection failed: ${testResult.error}`);
    }

    return prisma.emailAccount.create({
      data: {
        userId,
        name: config.name,
        email: config.email,
        provider: "imap",
        imapHost: config.imapHost,
        imapPort: config.imapPort,
        smtpHost: config.smtpHost,
        smtpPort: config.smtpPort,
        username: config.username,
        password: encrypt(config.password), // Encrypted!
        isDefault: config.isDefault ?? false,
        syncStatus: "idle",
      },
    });
  },

  // Add OAuth email account (Microsoft or Google)
  async addOAuthEmailAccount(
    userId: string,
    provider: "microsoft_oauth" | "google_oauth",
    tokens: OAuthTokens
  ) {
    return prisma.emailAccount.create({
      data: {
        userId,
        name: `${provider === "microsoft_oauth" ? "Outlook" : "Gmail"} Account`,
        email: tokens.email,
        provider,
        oauthAccessToken: encrypt(tokens.accessToken),
        oauthRefreshToken: encrypt(tokens.refreshToken),
        oauthExpiresAt: tokens.expiresAt,
        isDefault: false,
        syncStatus: "idle",
      },
    });
  },

  // Get decrypted credentials for use
  async getEmailCredentials(accountId: string, userId: string) {
    const account = await prisma.emailAccount.findFirst({
      where: { id: accountId, userId },
    });

    if (!account) throw new Error("Account not found");

    if (account.provider === "imap") {
      return {
        type: "imap" as const,
        host: account.imapHost!,
        port: account.imapPort!,
        username: account.username!,
        password: decrypt(account.password!),
        smtpHost: account.smtpHost!,
        smtpPort: account.smtpPort!,
      };
    } else {
      return {
        type: "oauth" as const,
        provider: account.provider,
        accessToken: decrypt(account.oauthAccessToken!),
        refreshToken: decrypt(account.oauthRefreshToken!),
        expiresAt: account.oauthExpiresAt!,
      };
    }
  },
};
```

### Encryption Utilities

```typescript
// lib/encryption.ts
import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!; // 32 bytes
const ALGORITHM = "aes-256-gcm";

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, "hex"),
    iv
  );

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedText.split(":");

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, "hex"),
    Buffer.from(ivHex, "hex")
  );

  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
```

---

## Unified Project Structure

```
bee/
├── .github/
│   └── workflows/
│       ├── ci.yaml                 # Test on PR
│       └── deploy.yaml             # Deploy on merge to main
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
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── src/
│   │   │   └── index.ts          # Export Prisma client
│   │   └── package.json
│   └── shared/                    # Shared types & utils
│       ├── src/
│       │   ├── types/            # TypeScript interfaces
│       │   ├── constants/        # Shared constants
│       │   └── utils/            # Shared utilities
│       └── package.json
├── infrastructure/
│   ├── docker/
│   │   └── Dockerfile
│   ├── nginx/
│   │   └── bee.conf
│   └── scripts/
│       └── deploy.sh
├── docs/
│   ├── prd.md
│   ├── brief.md
│   └── architecture.md
├── .env.example
├── package.json                   # Root workspace config
├── pnpm-workspace.yaml
├── turbo.json                     # Optional: Turborepo config
└── README.md
```

---

## Development Workflow

### Prerequisites

```bash
# Required software
node >= 20.0.0
pnpm >= 8.0.0
docker >= 24.0.0

# Verify installation
node -v
pnpm -v
docker -v
```

### Initial Setup

```bash
# Clone repository
git clone https://github.com/hugo/bee.git
cd bee

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your values

# Set up database
pnpm db:push      # Push schema to Supabase
pnpm db:generate  # Generate Prisma client

# Start development
pnpm dev
```

### Development Commands

```bash
# Start all services (web app)
pnpm dev

# Start with specific port
PORT=3001 pnpm dev

# Run type checking
pnpm typecheck

# Run linting
pnpm lint

# Run tests
pnpm test              # All tests
pnpm test:unit         # Unit tests only
pnpm test:e2e          # E2E tests (requires running app)

# Database commands
pnpm db:push           # Push schema changes
pnpm db:migrate        # Run migrations
pnpm db:studio         # Open Prisma Studio
pnpm db:seed           # Seed test data

# Build for production
pnpm build
```

### Environment Configuration

```bash
# .env.local (Frontend + Backend)

# Database (Supabase)
DATABASE_URL="postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres"
DIRECT_URL="postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres"

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://[project].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-key"

# App Authentication (NextAuth.js)
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"

# Encryption Key for storing email/calendar credentials
# Generate with: openssl rand -hex 32
ENCRYPTION_KEY="64-character-hex-string"

# OAuth Providers (OPTIONAL - only if user wants OAuth login)
# Google OAuth (for app login, not Gmail access)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Microsoft OAuth (OPTIONAL - for enhanced Outlook/OneDrive)
# Only needed if user registers their own Azure app
MICROSOFT_CLIENT_ID="your-microsoft-client-id"
MICROSOFT_CLIENT_SECRET="your-microsoft-client-secret"

# n8n Integration
N8N_WEBHOOK_URL="https://n8n.yourdomain.com/webhook"
N8N_WEBHOOK_SECRET="shared-secret-for-auth"

# LibreChat / MCP
LIBRECHAT_URL="https://chat.yourdomain.com"
LIBRECHAT_API_KEY="your-api-key"

# Monitoring
SENTRY_DSN="https://xxx@sentry.io/xxx"
```

**Note on OAuth credentials:**
- `GOOGLE_CLIENT_ID/SECRET`: Only needed if you want to offer "Sign in with Google" for app login
- `MICROSOFT_CLIENT_ID/SECRET`: Only needed if a user has registered their own Azure app for enhanced Outlook integration
- For MVP, neither is required - users can sign in with email/password and connect email via IMAP

---

## Deployment Architecture

### Deployment Strategy

**Frontend + Backend Deployment (VPS):**

- **Platform:** Docker container on Hugo's VPS
- **Build Command:** `pnpm build`
- **Output Directory:** `.next/`
- **Process Manager:** PM2 with clustering

**Database:**

- **Platform:** Supabase Cloud
- **Region:** EU (closest to VPS)
- **Backups:** Automatic daily (Supabase managed)

### CI/CD Pipeline

```yaml
# .github/workflows/deploy.yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "pnpm"
      - run: pnpm install
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to VPS
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /opt/bee
            git pull origin main
            pnpm install
            pnpm build
            pm2 restart bee
```

### Environments

| Environment | Frontend URL               | Backend URL                    | Purpose           |
| ----------- | -------------------------- | ------------------------------ | ----------------- |
| Development | http://localhost:3000      | http://localhost:3000/api      | Local development |
| Production  | https://bee.yourdomain.com | https://bee.yourdomain.com/api | Live environment  |

---

## Security and Performance

### Security Requirements

**Frontend Security:**

- CSP Headers: Strict Content-Security-Policy via Next.js config
- XSS Prevention: React's built-in escaping + DOMPurify for user content
- Secure Storage: HttpOnly cookies for session, no localStorage for tokens

**Backend Security:**

- Input Validation: Zod schemas on all tRPC procedures
- Rate Limiting: Upstash Redis rate limiter (100 req/min per user)
- CORS Policy: Restrict to app domain only

**Authentication Security:**

- Token Storage: Encrypted in database, never exposed to client
- Session Management: NextAuth.js with secure session cookies
- Token Refresh: Automatic refresh via NextAuth.js callbacks

### Performance Optimization

**Frontend Performance:**

- Bundle Size Target: < 200KB initial JS
- Loading Strategy: App Router streaming, Suspense boundaries
- Caching Strategy: SWR for API calls, React Query cache

**Backend Performance:**

- Response Time Target: < 200ms for API calls
- Database Optimization: Proper indexes, connection pooling (Supabase)
- Caching Strategy: Redis for session data, API response caching

---

## Testing Strategy

### Testing Pyramid

```
        E2E Tests (Playwright)
       /                      \
      Integration Tests (API)
     /                        \
    Unit Tests (Components + Services)
```

### Test Organization

**Frontend Tests:**

```
apps/web/tests/
├── unit/
│   ├── components/
│   │   └── SwipeCard.test.tsx
│   └── hooks/
│       └── useReviewStore.test.ts
└── e2e/
    ├── capture.spec.ts
    ├── review.spec.ts
    └── weekly-review.spec.ts
```

**Backend Tests:**

```
apps/web/tests/
└── integration/
    ├── inbox.test.ts
    ├── actions.test.ts
    └── search.test.ts
```

### Test Examples

**Frontend Component Test:**

```typescript
// tests/unit/components/SwipeCard.test.tsx
import { render, screen } from '@testing-library/react';
import { SwipeCard } from '@/components/review/SwipeCard';

describe('SwipeCard', () => {
  const mockItem = {
    id: '1',
    content: 'Test item content',
    aiClassification: {
      category: 'action',
      confidence: 0.85,
    },
  };

  it('displays item content', () => {
    render(<SwipeCard item={mockItem} onSwipe={vi.fn()} />);
    expect(screen.getByText('Test item content')).toBeInTheDocument();
  });

  it('shows confidence percentage', () => {
    render(<SwipeCard item={mockItem} onSwipe={vi.fn()} />);
    expect(screen.getByText('85% confident')).toBeInTheDocument();
  });
});
```

**Backend API Test:**

```typescript
// tests/integration/inbox.test.ts
import { createTestContext } from "../helpers";
import { inboxRouter } from "@/server/routers/inbox";

describe("Inbox Router", () => {
  const ctx = createTestContext();

  it("creates inbox item on capture", async () => {
    const result = await inboxRouter.capture({
      ctx,
      input: {
        type: "manual",
        content: "Test capture",
      },
    });

    expect(result.id).toBeDefined();
    expect(result.status).toBe("pending");
  });
});
```

**E2E Test:**

```typescript
// tests/e2e/review.spec.ts
import { test, expect } from "@playwright/test";

test("daily review swipe flow", async ({ page }) => {
  await page.goto("/review");

  // Wait for card to load
  await expect(page.locator('[data-testid="swipe-card"]')).toBeVisible();

  // Swipe right (agree)
  const card = page.locator('[data-testid="swipe-card"]');
  await card.dragTo(page.locator("body"), {
    targetPosition: { x: 300, y: 0 },
  });

  // Verify card dismissed
  await expect(card).not.toBeVisible();

  // Check progress updated
  await expect(page.locator('[data-testid="progress"]')).toContainText("1 of");
});
```

---

## Coding Standards

### Critical Fullstack Rules

- **Type Sharing:** Always define types in `packages/shared` and import from there
- **API Calls:** Never make direct HTTP calls - use the tRPC client or service layer
- **Environment Variables:** Access only through config objects, never `process.env` directly in components
- **Error Handling:** All API routes must use the standard error handler
- **State Updates:** Never mutate state directly - use Zustand actions or React setState
- **Audit Trail:** Every classification action MUST create a ClassificationAudit record

### Naming Conventions

| Element          | Frontend             | Backend    | Example                            |
| ---------------- | -------------------- | ---------- | ---------------------------------- |
| Components       | PascalCase           | -          | `SwipeCard.tsx`                    |
| Hooks            | camelCase with 'use' | -          | `useReviewStore.ts`                |
| API Routes       | -                    | kebab-case | `/api/webhooks/email-received`     |
| tRPC Procedures  | -                    | camelCase  | `inbox.capture`                    |
| Database Tables  | -                    | PascalCase | `InboxItem`, `ClassificationAudit` |
| Database Columns | -                    | camelCase  | `userId`, `createdAt`              |

---

## Error Handling Strategy

### Error Response Format

```typescript
interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    timestamp: string;
    requestId: string;
  };
}
```

### Frontend Error Handling

```typescript
// lib/error-handler.ts
import { toast } from "sonner";

export function handleApiError(error: unknown) {
  if (error instanceof TRPCClientError) {
    const code = error.data?.code;

    switch (code) {
      case "UNAUTHORIZED":
        // Redirect to login
        window.location.href = "/login";
        break;
      case "NOT_FOUND":
        toast.error("Item not found");
        break;
      default:
        toast.error(error.message || "Something went wrong");
    }
  } else {
    toast.error("An unexpected error occurred");
    console.error(error);
  }
}
```

### Backend Error Handling

```typescript
// server/lib/errors.ts
import { TRPCError } from "@trpc/server";

export function handleServiceError(error: unknown): never {
  console.error("Service error:", error);

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new TRPCError({
        code: "CONFLICT",
        message: "A record with this value already exists",
      });
    }
    if (error.code === "P2025") {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Record not found",
      });
    }
  }

  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred",
  });
}
```

---

## Monitoring and Observability

### Monitoring Stack

- **Frontend Monitoring:** Sentry (errors, performance)
- **Backend Monitoring:** Sentry + Pino logs
- **Error Tracking:** Sentry with source maps
- **Performance Monitoring:** Sentry Performance, Core Web Vitals

### Key Metrics

**Frontend Metrics:**

- Core Web Vitals (LCP, FID, CLS)
- JavaScript errors per session
- API response times from client
- Swipe gesture success rate

**Backend Metrics:**

- Request rate per endpoint
- Error rate (4xx, 5xx)
- Response time p50, p95, p99
- Database query performance
- n8n webhook latency

### Logging Configuration

```typescript
// lib/logger.ts
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: process.env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
});

// Usage in services
logger.info({ itemId, action }, "Swipe processed");
logger.error({ error, itemId }, "Classification failed");
```

---

## Checklist Results Report

_To be completed after architecture review and before development begins._

---

## Next Steps

1. **Set up repository** with the defined project structure
2. **Configure Supabase** project with pgvector extension
3. **Implement Story 1.1** - Project setup and development environment
4. **Configure n8n workflows** for email and classification
5. **Begin Epic 1** implementation following the PRD stories
