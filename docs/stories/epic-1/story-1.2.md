# Story 1.2: Database Setup & Core Schema

## Story Overview

| Field | Value |
|-------|-------|
| **Story ID** | 1.2 |
| **Epic** | [Epic 1: Foundation & Infrastructure](epic-1.md) |
| **Priority** | P0 - Critical Path |
| **Estimated Effort** | Medium (2-3 days) |
| **Dependencies** | Story 1.1 (Project Setup) |
| **Blocks** | Stories 1.3, 1.5, all Epic 2+ stories |

## User Story

**As a** developer,
**I want** the database configured with the core data model,
**So that** I can persist and query user data.

## Detailed Description

This story sets up Supabase as the PostgreSQL database with Prisma ORM. It creates the complete data model for Bee including all core entities: User, InboxItem, Note, Action, Project, Area, Resource, Objective, Conversation, ReviewSession, and ClassificationAudit.

The database will include:
- **pgvector extension** for semantic search capabilities
- **Proper indexes** for query performance
- **Seed script** for development data

## Acceptance Criteria

### AC1: Supabase Project Configured
- [ ] Supabase project created (or use existing)
- [ ] Connection string available and working
- [ ] pgvector extension enabled in Supabase dashboard
- [ ] Database accessible from development machine

### AC2: Prisma ORM Configured
- [ ] Prisma installed in `packages/db`
- [ ] `prisma/schema.prisma` created with datasource config
- [ ] Prisma client generates without errors
- [ ] Client exportable from `packages/db`
- [ ] Client importable in `apps/web`

### AC3: Core Entities Defined
All entities from architecture document implemented:
- [ ] `User` - Authentication and settings
- [ ] `InboxItem` - Captured items with AI classification
- [ ] `ClassificationAudit` - AI decision audit trail
- [ ] `Note` - Processed notes in PARA structure
- [ ] `Action` - To-do items with status and priority
- [ ] `Project` - PARA Projects
- [ ] `Area` - PARA Areas
- [ ] `Resource` - PARA Resources
- [ ] `Objective` - Goal hierarchy (yearly/monthly/weekly)
- [ ] `Conversation` - AI chat sessions
- [ ] `ReviewSession` - Daily/weekly review tracking
- [ ] `FailedWebhook` - Webhook retry queue

### AC4: Relationships Defined
- [ ] User has many: InboxItem, Note, Action, Project, Area, Resource, Objective, Conversation, ReviewSession
- [ ] InboxItem has many: ClassificationAudit, Action (spawned)
- [ ] InboxItem has one: Note (when converted)
- [ ] Project/Area/Resource have many: Note, Action
- [ ] Objective has: parent/children hierarchy, linked Actions and Projects
- [ ] All foreign keys properly defined

### AC5: Vector Search Support
- [ ] `embedding` field on InboxItem (vector(1536))
- [ ] `embedding` field on Note (vector(1536))
- [ ] `embedding` field on Conversation (vector(1536))
- [ ] SQL function for similarity search created in Supabase

### AC6: Indexes for Performance
- [ ] Index on `InboxItem(userId, status)`
- [ ] Index on `InboxItem(userId, createdAt)`
- [ ] Index on `ClassificationAudit(inboxItemId)`
- [ ] Index on `Action(userId, status)`
- [ ] Index on `Action(dueDate)`
- [ ] Index on `FailedWebhook(status, nextRetry)`

### AC7: Migrations & Seed Data
- [ ] Initial migration created and applied
- [ ] `pnpm db:push` works without errors
- [ ] `pnpm db:generate` generates client
- [ ] Seed script creates test user and sample data
- [ ] `pnpm db:seed` populates development database

## Technical Implementation Notes

### File: `packages/db/prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

model User {
  id                    String    @id @default(uuid())
  email                 String    @unique
  name                  String
  avatarUrl             String?
  microsoftAccessToken  String?   // Encrypted
  microsoftRefreshToken String?   // Encrypted
  settings              Json      @default("{}")
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  inboxItems            InboxItem[]
  notes                 Note[]
  actions               Action[]
  projects              Project[]
  areas                 Area[]
  resources             Resource[]
  objectives            Objective[]
  conversations         Conversation[]
  reviewSessions        ReviewSession[]
  classificationAudits  ClassificationAudit[]
}

model InboxItem {
  id               String    @id @default(uuid())
  userId           String
  user             User      @relation(fields: [userId], references: [id], onDelete: Cascade)
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
  inboxItem      InboxItem @relation(fields: [inboxItemId], references: [id], onDelete: Cascade)
  userId         String
  user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)

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
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)
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
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)
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
  id               String    @id @default(uuid())
  userId           String
  user             User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  name             String
  description      String?
  status           String    @default("active") // active, completed, on_hold, archived
  oneDriveFolderId String?
  objectiveId      String?
  objective        Objective? @relation(fields: [objectiveId], references: [id])
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  notes            Note[]
  actions          Action[]

  @@index([userId, status])
}

model Area {
  id               String    @id @default(uuid())
  userId           String
  user             User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  name             String
  description      String?
  oneDriveFolderId String?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  notes            Note[]
  actions          Action[]

  @@index([userId])
}

model Resource {
  id               String    @id @default(uuid())
  userId           String
  user             User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  name             String
  description      String?
  oneDriveFolderId String?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  notes            Note[]

  @@index([userId])
}

model Objective {
  id          String    @id @default(uuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
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
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)
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
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
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
  targetUrl   String
  payload     Json
  error       String
  statusCode  Int?
  retryCount  Int       @default(0)
  maxRetries  Int       @default(3)
  nextRetry   DateTime?
  status      String    @default("pending") // pending, retrying, failed, succeeded
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  resolvedAt  DateTime?

  @@index([status, nextRetry])
  @@index([type])
}
```

### File: `packages/db/src/index.ts`
```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export * from '@prisma/client';
```

### File: `packages/db/prisma/seed.ts`
```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create test user
  const user = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      name: 'Test User',
      settings: {
        confidenceThreshold: 0.6,
        autoArchiveDays: 15,
        defaultModel: 'claude',
        weeklyReviewDay: 0,
      },
    },
  });

  // Create sample project
  const project = await prisma.project.create({
    data: {
      userId: user.id,
      name: 'Sample Project',
      description: 'A sample project for testing',
      status: 'active',
    },
  });

  // Create sample area
  const area = await prisma.area.create({
    data: {
      userId: user.id,
      name: 'Health & Fitness',
      description: 'Personal health and fitness activities',
    },
  });

  // Create sample inbox items
  await prisma.inboxItem.createMany({
    data: [
      {
        userId: user.id,
        type: 'manual',
        content: 'Call dentist to schedule appointment',
        source: 'capture',
        status: 'pending',
      },
      {
        userId: user.id,
        type: 'manual',
        content: 'Review quarterly report and prepare summary for team meeting',
        source: 'capture',
        status: 'pending',
      },
      {
        userId: user.id,
        type: 'email',
        content: 'Re: Project Deadline - Please confirm the new deadline for the marketing campaign',
        source: 'email-forward',
        status: 'pending',
      },
    ],
  });

  // Create sample action
  await prisma.action.create({
    data: {
      userId: user.id,
      description: 'Email Sarah about budget proposal',
      status: 'pending',
      priority: 'high',
      projectId: project.id,
    },
  });

  console.log('Seed data created successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### SQL for Vector Search Function (run in Supabase SQL editor)
```sql
-- Enable pgvector extension
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
    AND (p_user_id IS NULL OR items."userId" = p_user_id::text)
    AND 1 - (items.embedding <=> query_embedding) > match_threshold

  UNION ALL

  SELECT
    notes.id,
    notes.content,
    1 - (notes.embedding <=> query_embedding) as similarity,
    'note' as source_type
  FROM "Note" notes
  WHERE notes.embedding IS NOT NULL
    AND (p_user_id IS NULL OR notes."userId" = p_user_id::text)
    AND 1 - (notes.embedding <=> query_embedding) > match_threshold

  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
```

### File: `packages/db/package.json`
```json
{
  "name": "@packages/db",
  "version": "0.0.1",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio",
    "db:seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@prisma/client": "^5.10.0"
  },
  "devDependencies": {
    "prisma": "^5.10.0",
    "tsx": "^4.7.0"
  }
}
```

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/db/package.json` | Create | Package config with Prisma |
| `packages/db/prisma/schema.prisma` | Create | Complete database schema |
| `packages/db/src/index.ts` | Create | Export Prisma client |
| `packages/db/prisma/seed.ts` | Create | Development seed data |
| `.env.local` | Update | Add DATABASE_URL, DIRECT_URL |
| `.env.example` | Update | Document database env vars |
| Root `package.json` | Update | Add db:* scripts |

## Environment Variables Required

```bash
# Supabase PostgreSQL
DATABASE_URL="postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres"
```

## Testing Requirements

### Manual Testing
1. Run `pnpm db:generate` - should generate Prisma client without errors
2. Run `pnpm db:push` - should push schema to Supabase
3. Open Supabase dashboard - verify all tables created
4. Run `pnpm db:seed` - should populate test data
5. Run `pnpm db:studio` - should open Prisma Studio with data visible
6. Verify vector extension: Run SQL query `SELECT * FROM pg_extension WHERE extname = 'vector';`

### Verification Queries (in Prisma Studio or Supabase)
```sql
-- Verify tables created
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';

-- Verify indexes
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public';

-- Verify seed data
SELECT COUNT(*) FROM "User";
SELECT COUNT(*) FROM "InboxItem";
```

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Prisma schema matches architecture document
- [ ] All 12 entities created with proper relationships
- [ ] Indexes created for performance
- [ ] pgvector extension enabled and working
- [ ] Seed script runs successfully
- [ ] Prisma client importable from `apps/web`
- [ ] No migration errors
- [ ] Environment variables documented

## Notes & Decisions

- **Supabase over self-hosted PostgreSQL**: Managed service, built-in pgvector, backups included
- **Prisma over Supabase JS client**: Better type safety, cleaner queries for complex relationships
- **vector(1536)**: OpenAI embedding dimension - can adjust for other providers
- **Cascade deletes on User**: When user deleted, all their data deleted (GDPR compliance)

## Related Documentation

- [Architecture Document](../../architecture.md) - Data model definitions
- [Supabase Dashboard](https://supabase.com/dashboard) - Database management
