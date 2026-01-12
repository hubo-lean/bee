# Epic 7: Performance, Local AI Classification & Gmail Sync

## Goal

Optimize application performance and complete AI integration by moving classification to the local backend (direct OpenAI API calls) and implementing Gmail inbox sync using the existing Google OAuth connection.

## Overview

**Key Changes from Previous Scope:**

1. **No n8n for Classification** - Use direct OpenAI API calls in backend (simpler, faster)
2. **Gmail Direct Sync** - User already has Gmail connected; sync directly instead of email forwarding
3. **Performance First** - Fix critical N+1 queries and optimization issues before adding features
4. **n8n for Complex Workflows Only** - Calendar sync and background jobs

## Current State Assessment

### Critical Performance Issues Found

| Issue | Location | Impact |
|-------|----------|--------|
| N+1 query in inbox queues | `inbox-queues.service.ts:8-52` | Loads ALL items, filters in JS |
| O(n²) sorting | `review.ts:41-43` | `.find()` inside `.map()` |
| Query waterfalls | `weekly-review/page.tsx` | 4 sequential queries |
| 5 separate count queries | `inbox.ts:206-226` | Should use `groupBy` |
| Missing indexes | `schema.prisma` | Common queries not indexed |
| Full cache invalidation | `inbox-step.tsx:33-52` | Refetch all on single item change |

### What Exists (Already Implemented)

| Component | Location | Status |
|-----------|----------|--------|
| OpenAI Embedding Service | `embedding.service.ts` | **COMPLETE** - fully functional |
| Classification Service | `classification.service.ts` | **COMPLETE** - business logic ready |
| Search Service | `search.service.ts` | **COMPLETE** - pgvector search working |
| Google OAuth | `auth.ts` | **PARTIAL** - app login only |
| EmailAccount Model | `schema.prisma` | **READY** - supports `google_oauth` |
| n8n Client | `lib/services/n8n.ts` | Working - for complex workflows |

### What's Missing (This Epic)

| Component | Impact | Priority |
|-----------|--------|----------|
| Performance Optimizations | App too slow | P0 |
| Local Classification API | Removes n8n dependency | P0 |
| Gmail Sync Client | Direct inbox access | P1 |
| Indexed Search Pipeline | Search doesn't populate | P1 |
| n8n Calendar Sync | Background calendar sync | P2 |

## Dependencies

- **Epic 1-6**: All UI and database infrastructure (COMPLETE)
- **Story 0.1**: Critical bug fixes (COMPLETE)
- **External**: OpenAI API key
- **External**: Gmail account connected via Google OAuth (READY)

## Stories

| Story | Title | Priority | Complexity | Dependencies |
|-------|-------|----------|------------|--------------|
| 7.1 | Performance Optimizations | P0 | High | None |
| 7.2 | Local AI Classification Service | P0 | Medium | None |
| 7.3 | Gmail Inbox Sync | P1 | Medium | Story 7.1 |
| 7.4 | Search Index Population & Semantic Search | P1 | Medium | Story 7.2 |
| 7.5 | n8n Calendar Sync Workflow | P2 | Medium | None |

**Note:** Story 7.6 (Search Indexing Pipeline) was merged into Story 7.4 to create a unified search implementation.

---

## Architecture

### Simplified Classification Flow (No n8n)

```
User Captures Text/Image/Voice
              │
              ▼
    ┌─────────────────┐
    │  Create         │
    │  InboxItem      │
    │  status:pending │
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │  Local Backend  │
    │  Classification │
    │  Service        │
    │                 │
    │  ┌───────────┐  │
    │  │ OpenAI    │  │
    │  │ GPT-4o    │  │
    │  │ API Call  │  │
    │  └───────────┘  │
    │                 │
    │  Directly call  │
    │  OpenAI, no n8n │
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │  Update         │
    │  InboxItem      │
    │  - aiClassification │
    │  - extractedActions │
    │  - tags         │
    │  status:reviewed│
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │  Route by       │
    │  Confidence     │
    │                 │
    │  ≥0.6: auto-file│
    │  <0.6: review   │
    └─────────────────┘
```

### Gmail Sync Flow (Direct API)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Gmail Sync Architecture                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   User's Gmail Account                                          │
│          │                                                      │
│          │  OAuth (already connected via Google login)          │
│          ▼                                                      │
│   ┌─────────────────┐                                          │
│   │  Gmail API      │                                          │
│   │  (googleapis)   │                                          │
│   └────────┬────────┘                                          │
│            │                                                    │
│            │ 1. List messages (filters by label/date)          │
│            │ 2. Get message details                             │
│            │ 3. Mark as read (optional)                         │
│            ▼                                                    │
│   ┌─────────────────┐                                          │
│   │  Gmail Service  │                                          │
│   │  (new)          │                                          │
│   │                 │                                          │
│   │  - syncInbox()  │                                          │
│   │  - markRead()   │                                          │
│   │  - archiveEmail()│                                         │
│   └────────┬────────┘                                          │
│            │                                                    │
│            ▼                                                    │
│   ┌─────────────────┐                                          │
│   │  Create         │                                          │
│   │  InboxItem      │──▶ Trigger Classification                │
│   │  type: email    │                                          │
│   └─────────────────┘                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technical Specifications

### Story 7.1: Performance Optimizations

**Database Query Fixes:**

1. **Fix N+1 in inbox-queues.service.ts** (CRITICAL)
```typescript
// BEFORE: Loads ALL, filters in JS
const items = await prisma.inboxItem.findMany({
  where: { userId, status: "pending" },
});
return items.filter(item => item.aiClassification?.confidence < threshold);

// AFTER: Filter in database with JSON
const items = await prisma.$queryRaw`
  SELECT * FROM "InboxItem"
  WHERE "userId" = ${userId}
    AND status = 'pending'
    AND (
      "aiClassification" IS NULL
      OR ("aiClassification"->>'confidence')::float < ${threshold}
    )
  ORDER BY "createdAt" ASC
`;
```

2. **Fix O(n²) sorting in review.ts**
```typescript
// BEFORE: O(n²) - find inside map
const orderedItems = session.itemIds
  .map(id => items.find(i => i.id === id));

// AFTER: O(n) - use Map
const itemMap = new Map(items.map(i => [i.id, i]));
const orderedItems = session.itemIds.map(id => itemMap.get(id));
```

3. **Batch count queries in inbox.ts**
```typescript
// BEFORE: 5 separate count queries
const [pending, processing, error, reviewed, total] = await Promise.all([
  prisma.inboxItem.count({ where: { userId, status: "pending" } }),
  prisma.inboxItem.count({ where: { userId, status: "processing" } }),
  // ... 3 more
]);

// AFTER: Single groupBy query
const counts = await prisma.inboxItem.groupBy({
  by: ['status'],
  where: { userId },
  _count: { _all: true },
});
```

4. **Add missing database indexes**
```sql
-- Add composite index for common review queries
CREATE INDEX idx_inbox_item_user_status_created
ON "InboxItem" ("userId", "status", "createdAt");

-- Add index for JSON confidence queries
CREATE INDEX idx_inbox_item_ai_confidence
ON "InboxItem" (("aiClassification"->>'confidence'));
```

5. **Implement optimistic updates**
```typescript
// BEFORE: Full invalidation
onSuccess: () => {
  utils.weeklyReview.getNeedsReview.invalidate();
  utils.weeklyReview.getDisagreements.invalidate();
},

// AFTER: Optimistic update
onMutate: async (newItem) => {
  await utils.weeklyReview.getNeedsReview.cancel();
  const previous = utils.weeklyReview.getNeedsReview.getData();
  utils.weeklyReview.getNeedsReview.setData(undefined, old =>
    old?.filter(item => item.id !== newItem.id)
  );
  return { previous };
},
```

**Client-Side Fixes:**

6. **Parallelize queries in weekly-review**
```typescript
// BEFORE: Sequential waterfall
const { data: needsReview } = trpc.weeklyReview.getNeedsReview.useQuery();
const { data: disagreements } = trpc.weeklyReview.getDisagreements.useQuery();
const { data: projects } = trpc.para.listProjects.useQuery();
const { data: areas } = trpc.para.listAreas.useQuery();

// AFTER: Single combined query or parallel via React Query
const { data } = trpc.weeklyReview.getInboxStepData.useQuery();
// Returns { needsReview, disagreements, projects, areas }
```

7. **Lazy load weekly review steps**
```typescript
// BEFORE: All imported upfront
import { ObjectivesStep } from "@/components/weekly-review/objectives-step";
import { PrioritiesStep } from "@/components/weekly-review/priorities-step";

// AFTER: Dynamic imports
const ObjectivesStep = dynamic(() =>
  import("@/components/weekly-review/objectives-step")
);
```

---

### Story 7.2: Local AI Classification Service

**New Service:** `apps/web/src/server/services/ai-classification.service.ts`

```typescript
import OpenAI from 'openai';
import { prisma } from '@packages/db';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const CLASSIFICATION_PROMPT = `You are an AI assistant that classifies inbox items for a personal productivity app called Bee.

Analyze the content and return a JSON response with:
1. category: "action" | "note" | "reference" | "meeting" | "unknown"
2. confidence: 0.0-1.0
3. reasoning: Brief explanation
4. extractedActions: Array of action items if category is "action"
5. tags: Array of extracted tags (topics, people, dates, locations)

CLASSIFICATION RULES:
- "action": Contains something the user needs to DO (call, buy, schedule, email, fix, etc.)
- "note": Information to remember but no action required
- "reference": Reference material to save (articles, links, documents)
- "meeting": Meeting notes, agenda items, or calendar-related
- "unknown": Cannot determine category (ask for clarification)

Return ONLY valid JSON.`;

interface ClassificationResult {
  category: 'action' | 'note' | 'reference' | 'meeting' | 'unknown';
  confidence: number;
  reasoning: string;
  extractedActions: Array<{
    description: string;
    confidence: number;
    priority?: 'urgent' | 'high' | 'normal' | 'low';
    dueDate?: string;
  }>;
  tags: Array<{
    type: 'topic' | 'person' | 'project' | 'area' | 'date' | 'location';
    value: string;
  }>;
}

export class AIClassificationService {
  private static MODEL = 'gpt-4o-mini'; // Cost-effective for classification

  /**
   * Classify an inbox item using OpenAI
   */
  async classifyItem(
    itemId: string,
    content: string,
    context?: { areas?: string[]; projects?: string[] }
  ): Promise<ClassificationResult> {
    const startTime = Date.now();

    const userMessage = `Content to classify:
"""
${content}
"""

${context?.areas?.length ? `User's areas: ${context.areas.join(', ')}` : ''}
${context?.projects?.length ? `User's projects: ${context.projects.join(', ')}` : ''}`;

    const response = await openai.chat.completions.create({
      model: AIClassificationService.MODEL,
      messages: [
        { role: 'system', content: CLASSIFICATION_PROMPT },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3, // Lower for more consistent classification
      max_tokens: 1000,
    });

    const processingTimeMs = Date.now() - startTime;
    const result = JSON.parse(response.choices[0].message.content!) as ClassificationResult;

    // Update the inbox item
    await prisma.inboxItem.update({
      where: { id: itemId },
      data: {
        aiClassification: {
          ...result,
          modelUsed: AIClassificationService.MODEL,
          processingTimeMs,
          classifiedAt: new Date().toISOString(),
        },
        extractedActions: result.extractedActions,
        tags: result.tags,
        status: result.confidence >= 0.6 ? 'reviewed' : 'pending',
      },
    });

    return result;
  }

  /**
   * Batch classify multiple items (more efficient)
   */
  async classifyBatch(items: Array<{ id: string; content: string }>): Promise<void> {
    // Process in parallel with concurrency limit
    const CONCURRENCY = 5;
    for (let i = 0; i < items.length; i += CONCURRENCY) {
      const batch = items.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(item => this.classifyItem(item.id, item.content)));
    }
  }
}

export const aiClassificationService = new AIClassificationService();
```

**Update Inbox Router:**

```typescript
// apps/web/src/server/routers/inbox.ts

import { aiClassificationService } from '../services/ai-classification.service';

// In create mutation, after item is created:
create: protectedProcedure
  .input(createInboxItemSchema)
  .mutation(async ({ ctx, input }) => {
    const item = await prisma.inboxItem.create({
      data: {
        userId: ctx.userId,
        content: input.content,
        type: input.type,
        source: input.source,
        status: 'processing', // New status while classifying
      },
    });

    // Classify asynchronously (don't block response)
    aiClassificationService.classifyItem(item.id, item.content)
      .catch(error => {
        console.error('Classification failed:', error);
        prisma.inboxItem.update({
          where: { id: item.id },
          data: { status: 'pending' }, // Fall back to manual review
        });
      });

    return item;
  }),
```

---

### Story 7.3: Gmail Inbox Sync

**Install googleapis package:**
```bash
cd apps/web && pnpm add googleapis
```

**New Service:** `apps/web/src/server/services/gmail.service.ts`

```typescript
import { google, gmail_v1 } from 'googleapis';
import { prisma } from '@packages/db';
import { aiClassificationService } from './ai-classification.service';

export class GmailService {
  private gmail: gmail_v1.Gmail;

  constructor(accessToken: string, refreshToken?: string) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    this.gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  }

  /**
   * Sync unread emails to inbox
   */
  async syncUnreadToInbox(
    userId: string,
    options: { maxResults?: number; labelIds?: string[] } = {}
  ): Promise<{ synced: number; errors: number }> {
    const { maxResults = 20, labelIds = ['INBOX', 'UNREAD'] } = options;

    // Get list of unread messages
    const listResponse = await this.gmail.users.messages.list({
      userId: 'me',
      labelIds,
      maxResults,
    });

    const messages = listResponse.data.messages || [];
    let synced = 0;
    let errors = 0;

    for (const msg of messages) {
      try {
        // Get full message details
        const msgResponse = await this.gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'full',
        });

        const email = this.parseEmailMessage(msgResponse.data);

        // Check if already synced (by messageId)
        const existing = await prisma.inboxItem.findFirst({
          where: {
            userId,
            metadata: { path: ['messageId'], equals: email.messageId },
          },
        });

        if (existing) continue;

        // Create inbox item
        const item = await prisma.inboxItem.create({
          data: {
            userId,
            type: 'email',
            source: 'gmail',
            content: this.formatEmailContent(email),
            status: 'processing',
            metadata: {
              messageId: email.messageId,
              from: email.from,
              subject: email.subject,
              date: email.date,
            },
          },
        });

        // Trigger classification
        aiClassificationService.classifyItem(item.id, item.content)
          .catch(console.error);

        synced++;
      } catch (error) {
        console.error(`Failed to sync message ${msg.id}:`, error);
        errors++;
      }
    }

    return { synced, errors };
  }

  /**
   * Parse Gmail message into structured data
   */
  private parseEmailMessage(message: gmail_v1.Schema$Message): {
    messageId: string;
    from: string;
    subject: string;
    body: string;
    date: string;
  } {
    const headers = message.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

    let body = '';
    if (message.payload?.body?.data) {
      body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
    } else if (message.payload?.parts) {
      const textPart = message.payload.parts.find(p => p.mimeType === 'text/plain');
      if (textPart?.body?.data) {
        body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
      }
    }

    return {
      messageId: message.id!,
      from: getHeader('from'),
      subject: getHeader('subject'),
      body,
      date: getHeader('date'),
    };
  }

  private formatEmailContent(email: { from: string; subject: string; body: string }): string {
    return `From: ${email.from}\nSubject: ${email.subject}\n\n${email.body}`;
  }
}
```

**Gmail Sync Router:**

```typescript
// apps/web/src/server/routers/gmail.ts

import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { GmailService } from '../services/gmail.service';

export const gmailRouter = router({
  syncInbox: protectedProcedure
    .input(z.object({
      maxResults: z.number().min(1).max(50).default(20),
    }).optional())
    .mutation(async ({ ctx, input }) => {
      // Get user's Google OAuth tokens from session
      const account = await prisma.account.findFirst({
        where: {
          userId: ctx.userId,
          provider: 'google',
        },
      });

      if (!account?.access_token) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Google account not connected',
        });
      }

      const gmailService = new GmailService(
        account.access_token,
        account.refresh_token ?? undefined
      );

      return gmailService.syncUnreadToInbox(ctx.userId, input);
    }),

  getSyncStatus: protectedProcedure
    .query(async ({ ctx }) => {
      const account = await prisma.account.findFirst({
        where: { userId: ctx.userId, provider: 'google' },
        select: { access_token: true },
      });

      const lastSync = await prisma.inboxItem.findFirst({
        where: { userId: ctx.userId, source: 'gmail' },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });

      return {
        connected: !!account?.access_token,
        lastSyncAt: lastSync?.createdAt,
      };
    }),
});
```

**Update Google OAuth scopes in auth.ts:**

```typescript
// Add Gmail read scope
Google({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  authorization: {
    params: {
      scope: 'openid email profile https://www.googleapis.com/auth/gmail.readonly',
      access_type: 'offline',
      prompt: 'consent',
    },
  },
})
```

---

### Story 7.4: Search Index Population

**Hook into classification lifecycle:**

```typescript
// In ai-classification.service.ts, after classification:

import { embeddingService } from './embedding.service';
import { searchIndexService } from './search-index.service';

// After updating inbox item with classification:
await searchIndexService.indexContent({
  sourceType: 'INBOX_ITEM',
  sourceId: itemId,
  userId: item.userId,
  content: content,
  title: result.extractedActions[0]?.description,
  tags: result.tags.map(t => t.value),
});
```

---

### Story 7.5: n8n Calendar Sync Workflow

**Keep n8n for complex background tasks:**

- Calendar sync every 15 minutes
- Daily reindex job
- Any future complex multi-step workflows

See `story-7.5.story.md` for full n8n workflow configuration (unchanged).

---

## Environment Variables (Simplified)

```env
# OpenAI (for local classification + embeddings)
OPENAI_API_KEY=sk-...

# Google OAuth (for login + Gmail sync)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# n8n (only for complex workflows like calendar sync)
N8N_WEBHOOK_URL=https://n8n.yourdomain.com/webhook
N8N_WEBHOOK_SECRET=your-shared-secret
INTERNAL_API_SECRET=your-internal-secret

# Database
DATABASE_URL=postgresql://...
```

---

## Sprint Execution Order

```
Week 1 (P0 - Performance & Core):
├── Story 7.1: Performance Optimizations (3 days)
│   ├── Fix N+1 queries in inbox-queues
│   ├── Fix O(n²) sorting
│   ├── Add database indexes
│   └── Implement optimistic updates
└── Story 7.2: Local AI Classification (2 days)
    ├── Create ai-classification.service.ts
    ├── Update inbox router to use local service
    └── Remove n8n dependency for classification

Week 2 (P1 - Features):
├── Story 7.3: Gmail Inbox Sync (2 days)
│   ├── Add googleapis package
│   ├── Create gmail.service.ts
│   ├── Update OAuth scopes
│   └── Add sync UI button
├── Story 7.4: Search Index Population (1 day)
│   └── Hook embedding into classification
└── Story 7.5: n8n Calendar Sync (2 days)
    └── Existing workflow configuration
```

## Success Criteria

- [ ] Page load times under 500ms (currently several seconds)
- [ ] Classification completes in < 3 seconds (direct API, no n8n hop)
- [ ] Gmail emails sync to inbox with one click
- [ ] Semantic search returns results (embeddings populated)
- [ ] Weekly review loads in under 1 second
- [ ] No visible loading spinners for cached data

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| OpenAI rate limits | Classification delays | Implement queue with backoff |
| Gmail token expiry | Sync fails | Token refresh in OAuth flow |
| Index migration | Downtime | Run index creation concurrently |

## Out of Scope

- n8n for simple classification (moved to local)
- Email forwarding system (replaced by Gmail sync)
- Custom LLM fine-tuning
- Real-time push notifications

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-01-12 | 1.0 | Initial brownfield epic creation | John (PM) |
| 2026-01-12 | 2.0 | Major revision: local classification, Gmail sync, performance focus | John (PM) |
