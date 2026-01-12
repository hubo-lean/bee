# Epic 6: Calendar & Search

## Goal

Integrate calendar visibility for time management during reviews and provide semantic search across all captured content.

## Overview

Epic 6 brings time awareness and unified retrieval to Bee - two critical capabilities for a complete productivity system. Users can see their calendar to make informed planning decisions, create time blocks for actions, and find any past work instantly through semantic search.

Key capabilities:
1. **Calendar Integration** - View Outlook calendar events within Bee
2. **Time Block Creation** - Schedule time for actions directly from the app
3. **Calendar Summary** - See available time during weekly review
4. **Semantic Search** - Find content by meaning, not just keywords
5. **Search Filters** - Refine results by type, date, PARA category

This epic completes the core MVP functionality of Bee.

## Dependencies

- **Epic 5**: Weekly Review & Organization (PARA structure, review wizard)
- **Epic 3**: AI Triage & Classification (tags for search)
- **Epic 1**: Foundation (pgvector enabled, CalendarAccount model)
- **CalDAV/OAuth**: Calendar provider credentials
- **OpenAI Embeddings**: For vector search

## Stories

| Story | Title | Priority | Complexity | Dependencies |
|-------|-------|----------|------------|--------------|
| 6.1 | Calendar Integration (Read) | P0 | High | Epic 1 (CalendarAccount) |
| 6.2 | Calendar Summary in Weekly Review | P1 | Medium | Story 6.1, Story 5.2 |
| 6.3 | Time Block Creation | P1 | Medium | Story 6.1 |
| 6.4 | Semantic Search Implementation | P0 | High | Epic 1 (pgvector) |
| 6.5 | Search Filters & History | P1 | Medium | Story 6.4 |

## Architecture

### Calendar Data Flow

```
[CalendarAccount] (CalDAV or OAuth credentials)
    ↓
[Calendar Service]
    ├── fetchEvents(dateRange)
    ├── createEvent(event)
    └── syncCalendar()
    ↓
[CalendarEvent Cache] (optional local cache)
    ↓
[UI: Calendar View / Summary]
```

### Search Data Flow

```
[Content Creation/Update]
    ↓
[Generate Embedding] (OpenAI text-embedding-3-small)
    ↓
[Store in pgvector] (embedding column)
    ↓
[Search Query]
    ├── Generate query embedding
    ├── Vector similarity search (cosine distance)
    ├── Filter by type/date/PARA
    └── Rank and return results
```

### Calendar Event Model

```typescript
interface CalendarEvent {
  id: string;
  calendarAccountId: string;
  externalId: string;         // Provider's event ID
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
  location?: string;
  attendees: Attendee[];
  status: "confirmed" | "tentative" | "cancelled";
  recurrence?: string;        // RRULE string
  lastSyncedAt: Date;
}

interface Attendee {
  email: string;
  name?: string;
  status: "accepted" | "declined" | "tentative" | "needs_action";
}
```

### Search Index Model

```typescript
interface SearchableItem {
  id: string;
  userId: string;
  type: "inbox_item" | "note" | "action" | "resource" | "conversation";
  sourceId: string;           // ID of the source record
  title?: string;
  content: string;
  embedding: number[];        // 1536 dimensions for text-embedding-3-small
  metadata: {
    projectId?: string;
    areaId?: string;
    tags?: string[];
    createdAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### Calendar Summary Stats

```typescript
interface CalendarSummary {
  weekStart: Date;
  weekEnd: Date;
  totalMeetingHours: number;
  totalFocusHours: number;    // Available time
  busiestDay: {
    date: Date;
    hours: number;
  };
  eventCount: number;
  averageMeetingDuration: number;
}
```

## Technical Components

### Backend Services

1. **CalendarService** (`apps/web/src/server/services/calendar.service.ts`)
   - `fetchEvents(accountId, dateRange)` - Get events from provider
   - `createEvent(accountId, event)` - Create new event
   - `syncCalendar(accountId)` - Full sync with provider
   - `getCalendarSummary(userId, weekStart)` - Calculate summary stats

2. **SearchService** (`apps/web/src/server/services/search.service.ts`)
   - `search(query, filters)` - Semantic + keyword search
   - `indexItem(item)` - Generate embedding and store
   - `reindexAll(userId)` - Rebuild search index
   - `deleteFromIndex(itemId)` - Remove from index

3. **EmbeddingService** (`apps/web/src/server/services/embedding.service.ts`)
   - `generateEmbedding(text)` - Call OpenAI embeddings API
   - `batchGenerateEmbeddings(texts)` - Batch processing

### Frontend Components

1. **CalendarPage** (`apps/web/src/app/(app)/calendar/page.tsx`)
   - Week/day view toggle
   - Event cards with details
   - Click to create time block

2. **CalendarSummaryCard** (`apps/web/src/components/calendar/calendar-summary.tsx`)
   - For weekly review sidebar
   - Meeting hours, focus time, busiest day

3. **SearchPage** (`apps/web/src/app/(app)/search/page.tsx`)
   - Global search bar
   - Filter sidebar
   - Result cards with snippets

4. **SearchBar** (`apps/web/src/components/search/search-bar.tsx`)
   - Command+K accessible
   - Recent searches
   - Type-ahead suggestions

### tRPC Procedures

```typescript
export const calendarRouter = router({
  getAccounts: protectedProcedure.query(...),
  getEvents: protectedProcedure.query(...),
  createEvent: protectedProcedure.mutation(...),
  syncCalendar: protectedProcedure.mutation(...),
  getSummary: protectedProcedure.query(...),
});

export const searchRouter = router({
  search: protectedProcedure.query(...),
  getRecentSearches: protectedProcedure.query(...),
  saveSearch: protectedProcedure.mutation(...),
  clearHistory: protectedProcedure.mutation(...),
  reindex: protectedProcedure.mutation(...),
});
```

## Sprint Execution Order

1. **Story 6.4** (Semantic Search) - Core search infrastructure
2. **Story 6.1** (Calendar Read) - Calendar provider integration
3. **Story 6.5** (Search Filters) - Enhanced search UX
4. **Story 6.2** (Calendar Summary) - Weekly review integration
5. **Story 6.3** (Time Block Creation) - Calendar write capability

## Success Criteria

- [ ] Calendar events displayed from connected account
- [ ] Week and day views working
- [ ] Time blocks can be created from actions
- [ ] Calendar summary shows in weekly review
- [ ] Semantic search returns relevant results < 1 second (NFR2)
- [ ] Filters narrow results effectively
- [ ] Search history persists across sessions
- [ ] All content types searchable

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Calendar provider API limits | Sync failures | Local caching, intelligent sync |
| CalDAV protocol variations | Incompatibility | Test with major providers, fallback logic |
| Embedding costs | Budget | Batch processing, incremental indexing |
| Search latency | Poor UX | pgvector indexing, result pagination |
| OAuth token expiration | Auth failures | Token refresh logic (implemented in Epic 1) |

## Out of Scope

- Calendar event editing (beyond time blocks)
- Recurring event management
- Multiple calendar support (single primary for MVP)
- Real-time calendar sync (manual refresh)
- Full-text search highlighting (semantic only)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-01-11 | 1.0 | Initial epic creation for sprint planning | Bob (SM) |
