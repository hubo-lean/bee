# Story 6.4: Semantic Search Implementation

## Story

**As a** user,
**I want** to search my captured content by meaning,
**So that** I can find relevant information even without exact keywords.

## Priority

**P0** - Core functionality for retrieval

## Acceptance Criteria

1. Global search bar accessible from any screen (Cmd+K)
2. Search returns results ranked by semantic similarity
3. Results include snippets showing matching context
4. Supports searching across all content types (inbox items, notes, actions, resources)
5. Search latency < 1 second for typical queries (NFR2)
6. New content indexed within 30 seconds of creation

## Technical Design

### Embedding Architecture

```
[Content Creation/Update]
    ↓
[Generate Embedding]
    ├── OpenAI text-embedding-3-small (1536 dimensions)
    └── Batch processing for bulk operations
    ↓
[Store in pgvector]
    └── SearchIndex table with embedding column
    ↓
[Search Query]
    ├── Generate query embedding
    ├── Cosine similarity search (1 - (a <=> b))
    └── Return top N results
```

### Database Schema

> **Migration File**: `packages/db/prisma/migrations/20260112_add_search_index_with_embedding.sql`
> This migration enables pgvector, creates the SearchIndex table with HNSW vector index for fast similarity search.

```prisma
model SearchIndex {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Source reference
  sourceType  SearchSourceType
  sourceId    String

  // Searchable content
  title       String?
  content     String
  // pgvector embedding column - requires CREATE EXTENSION vector; first
  embedding   Unsupported("vector(1536)")?

  // Metadata for filtering
  projectId   String?
  areaId      String?
  tags        String[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([sourceType, sourceId])
  @@index([userId])
  @@index([sourceType])
}

enum SearchSourceType {
  INBOX_ITEM
  NOTE
  ACTION
  RESOURCE
  CONVERSATION
}
```

### Vector Index (Critical for NFR - Search < 1 second)

The migration creates an HNSW index for efficient vector similarity search:

```sql
-- HNSW index provides O(log n) search vs O(n) full scan
CREATE INDEX IF NOT EXISTS "SearchIndex_embedding_hnsw_idx"
ON "SearchIndex"
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

### Embedding Service

```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

export async function generateEmbedding(text: string): Promise<number[]> {
  // Truncate to model's context limit (~8k tokens)
  const truncatedText = text.slice(0, 30000);

  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: truncatedText,
  });

  return response.data[0].embedding;
}

export async function generateBatchEmbeddings(
  texts: string[]
): Promise<number[][]> {
  // OpenAI batch limit is 2048 inputs
  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += 2048) {
    batches.push(texts.slice(i, i + 2048));
  }

  const results: number[][] = [];

  for (const batch of batches) {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch.map((t) => t.slice(0, 30000)),
    });

    results.push(...response.data.map((d) => d.embedding));
  }

  return results;
}
```

### Search Index Service

```typescript
interface IndexableContent {
  sourceType: SearchSourceType;
  sourceId: string;
  userId: string;
  title?: string;
  content: string;
  projectId?: string;
  areaId?: string;
  tags?: string[];
}

export async function indexContent(item: IndexableContent): Promise<void> {
  // Generate searchable text
  const searchableText = [item.title, item.content].filter(Boolean).join("\n\n");

  // Generate embedding
  const embedding = await generateEmbedding(searchableText);

  // Upsert into search index
  await prisma.$executeRaw`
    INSERT INTO "SearchIndex" (
      "id", "userId", "sourceType", "sourceId",
      "title", "content", "embedding",
      "projectId", "areaId", "tags",
      "createdAt", "updatedAt"
    ) VALUES (
      ${cuid()}, ${item.userId}, ${item.sourceType}::"SearchSourceType", ${item.sourceId},
      ${item.title}, ${item.content}, ${embedding}::vector,
      ${item.projectId}, ${item.areaId}, ${item.tags || []},
      NOW(), NOW()
    )
    ON CONFLICT ("sourceType", "sourceId")
    DO UPDATE SET
      "title" = ${item.title},
      "content" = ${item.content},
      "embedding" = ${embedding}::vector,
      "projectId" = ${item.projectId},
      "areaId" = ${item.areaId},
      "tags" = ${item.tags || []},
      "updatedAt" = NOW()
  `;
}

export async function removeFromIndex(
  sourceType: SearchSourceType,
  sourceId: string
): Promise<void> {
  await prisma.searchIndex.deleteMany({
    where: { sourceType, sourceId },
  });
}

export async function reindexUserContent(userId: string): Promise<number> {
  let indexed = 0;

  // Index inbox items
  const inboxItems = await prisma.inboxItem.findMany({
    where: { userId },
    select: {
      id: true,
      rawContent: true,
      processedContent: true,
      projectId: true,
      areaId: true,
      tags: { select: { tag: { select: { name: true } } } },
    },
  });

  for (const item of inboxItems) {
    await indexContent({
      sourceType: "INBOX_ITEM",
      sourceId: item.id,
      userId,
      content: item.processedContent || item.rawContent,
      projectId: item.projectId ?? undefined,
      areaId: item.areaId ?? undefined,
      tags: item.tags.map((t) => t.tag.name),
    });
    indexed++;
  }

  // Index notes
  const notes = await prisma.note.findMany({
    where: { userId },
    select: {
      id: true,
      title: true,
      content: true,
      projectId: true,
      areaId: true,
      tags: { select: { tag: { select: { name: true } } } },
    },
  });

  for (const note of notes) {
    await indexContent({
      sourceType: "NOTE",
      sourceId: note.id,
      userId,
      title: note.title,
      content: note.content,
      projectId: note.projectId ?? undefined,
      areaId: note.areaId ?? undefined,
      tags: note.tags.map((t) => t.tag.name),
    });
    indexed++;
  }

  // Index actions
  const actions = await prisma.action.findMany({
    where: { userId },
    select: {
      id: true,
      description: true,
      projectId: true,
    },
  });

  for (const action of actions) {
    await indexContent({
      sourceType: "ACTION",
      sourceId: action.id,
      userId,
      title: action.description, // Action model uses description as primary text
      content: action.description || "",
      projectId: action.projectId ?? undefined,
    });
    indexed++;
  }

  // Index resources
  const resources = await prisma.resource.findMany({
    where: { userId },
    select: {
      id: true,
      title: true,
      description: true,
      url: true,
      areaId: true,
      tags: { select: { tag: { select: { name: true } } } },
    },
  });

  for (const resource of resources) {
    await indexContent({
      sourceType: "RESOURCE",
      sourceId: resource.id,
      userId,
      title: resource.title,
      content: [resource.description, resource.url].filter(Boolean).join("\n"),
      areaId: resource.areaId ?? undefined,
      tags: resource.tags.map((t) => t.tag.name),
    });
    indexed++;
  }

  return indexed;
}
```

### Semantic Search Service

```typescript
interface SearchFilters {
  types?: SearchSourceType[];
  projectId?: string;
  areaId?: string;
  tags?: string[];
  dateFrom?: Date;
  dateTo?: Date;
}

interface SearchResult {
  id: string;
  sourceType: SearchSourceType;
  sourceId: string;
  title: string | null;
  content: string;
  snippet: string;
  similarity: number;
  projectId: string | null;
  areaId: string | null;
  tags: string[];
  createdAt: Date;
}

export async function semanticSearch(
  userId: string,
  query: string,
  filters: SearchFilters = {},
  limit: number = 20
): Promise<SearchResult[]> {
  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query);

  // Build filter conditions
  const typeFilter = filters.types?.length
    ? Prisma.sql`AND "sourceType" = ANY(${filters.types}::"SearchSourceType"[])`
    : Prisma.empty;

  const projectFilter = filters.projectId
    ? Prisma.sql`AND "projectId" = ${filters.projectId}`
    : Prisma.empty;

  const areaFilter = filters.areaId
    ? Prisma.sql`AND "areaId" = ${filters.areaId}`
    : Prisma.empty;

  const tagsFilter = filters.tags?.length
    ? Prisma.sql`AND "tags" && ${filters.tags}`
    : Prisma.empty;

  const dateFromFilter = filters.dateFrom
    ? Prisma.sql`AND "createdAt" >= ${filters.dateFrom}`
    : Prisma.empty;

  const dateToFilter = filters.dateTo
    ? Prisma.sql`AND "createdAt" <= ${filters.dateTo}`
    : Prisma.empty;

  // Perform vector similarity search
  const results = await prisma.$queryRaw<SearchResult[]>`
    SELECT
      "id",
      "sourceType",
      "sourceId",
      "title",
      "content",
      "projectId",
      "areaId",
      "tags",
      "createdAt",
      1 - ("embedding" <=> ${queryEmbedding}::vector) as similarity
    FROM "SearchIndex"
    WHERE "userId" = ${userId}
      ${typeFilter}
      ${projectFilter}
      ${areaFilter}
      ${tagsFilter}
      ${dateFromFilter}
      ${dateToFilter}
    ORDER BY "embedding" <=> ${queryEmbedding}::vector
    LIMIT ${limit}
  `;

  // Generate snippets
  return results.map((result) => ({
    ...result,
    snippet: generateSnippet(result.content, query),
  }));
}

function generateSnippet(content: string, query: string, maxLength: number = 200): string {
  // Find the best matching section
  const words = query.toLowerCase().split(/\s+/);
  const contentLower = content.toLowerCase();

  let bestStart = 0;
  let bestScore = 0;

  // Sliding window to find highest density of query words
  const windowSize = maxLength;
  for (let i = 0; i < content.length - windowSize; i += 50) {
    const window = contentLower.slice(i, i + windowSize);
    const score = words.filter((word) => window.includes(word)).length;
    if (score > bestScore) {
      bestScore = score;
      bestStart = i;
    }
  }

  // Extract snippet
  let snippet = content.slice(bestStart, bestStart + maxLength);

  // Clean up boundaries
  if (bestStart > 0) {
    const firstSpace = snippet.indexOf(" ");
    if (firstSpace > 0 && firstSpace < 20) {
      snippet = "..." + snippet.slice(firstSpace + 1);
    } else {
      snippet = "..." + snippet;
    }
  }

  if (bestStart + maxLength < content.length) {
    const lastSpace = snippet.lastIndexOf(" ");
    if (lastSpace > maxLength - 20) {
      snippet = snippet.slice(0, lastSpace) + "...";
    } else {
      snippet = snippet + "...";
    }
  }

  return snippet;
}
```

### Search Command Bar Component (Cmd+K)

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDebounce } from "@/hooks/use-debounce";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Search, FileText, CheckSquare, Inbox, Link2, Loader2 } from "lucide-react";

const SOURCE_TYPE_ICONS = {
  INBOX_ITEM: Inbox,
  NOTE: FileText,
  ACTION: CheckSquare,
  RESOURCE: Link2,
  CONVERSATION: MessageSquare,
};

const SOURCE_TYPE_LABELS = {
  INBOX_ITEM: "Inbox Item",
  NOTE: "Note",
  ACTION: "Action",
  RESOURCE: "Resource",
  CONVERSATION: "Conversation",
};

export function SearchCommandBar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);

  const { data: results, isLoading } = trpc.search.search.useQuery(
    { query: debouncedQuery },
    { enabled: debouncedQuery.length >= 2 }
  );

  // Cmd+K handler
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = useCallback((result: SearchResult) => {
    setOpen(false);

    // Navigate to the source item
    switch (result.sourceType) {
      case "INBOX_ITEM":
        router.push(`/inbox/${result.sourceId}`);
        break;
      case "NOTE":
        router.push(`/notes/${result.sourceId}`);
        break;
      case "ACTION":
        router.push(`/actions/${result.sourceId}`);
        break;
      case "RESOURCE":
        router.push(`/resources/${result.sourceId}`);
        break;
      case "CONVERSATION":
        router.push(`/conversations/${result.sourceId}`);
        break;
    }
  }, [router]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search everything..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        )}

        {!isLoading && query.length >= 2 && results?.length === 0 && (
          <CommandEmpty>No results found.</CommandEmpty>
        )}

        {!isLoading && results && results.length > 0 && (
          <>
            {/* Group results by type */}
            {Object.entries(
              results.reduce((acc, result) => {
                const type = result.sourceType;
                if (!acc[type]) acc[type] = [];
                acc[type].push(result);
                return acc;
              }, {} as Record<string, SearchResult[]>)
            ).map(([type, typeResults]) => {
              const Icon = SOURCE_TYPE_ICONS[type as SearchSourceType];
              return (
                <CommandGroup
                  key={type}
                  heading={SOURCE_TYPE_LABELS[type as SearchSourceType] + "s"}
                >
                  {typeResults.map((result) => (
                    <CommandItem
                      key={result.id}
                      value={result.id}
                      onSelect={() => handleSelect(result)}
                      className="flex flex-col items-start gap-1 py-3"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <Icon className="h-4 w-4 text-gray-400 shrink-0" />
                        <span className="font-medium truncate">
                          {result.title || "Untitled"}
                        </span>
                        <span className="ml-auto text-xs text-gray-400">
                          {Math.round(result.similarity * 100)}%
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 line-clamp-2 pl-6">
                        {result.snippet}
                      </p>
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </>
        )}

        {query.length < 2 && (
          <>
            <CommandGroup heading="Quick Actions">
              <CommandItem onSelect={() => router.push("/capture")}>
                <Plus className="mr-2 h-4 w-4" />
                Capture new item
              </CommandItem>
              <CommandItem onSelect={() => router.push("/review")}>
                <Inbox className="mr-2 h-4 w-4" />
                Start daily review
              </CommandItem>
              <CommandItem onSelect={() => router.push("/search")}>
                <Search className="mr-2 h-4 w-4" />
                Advanced search
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
```

### Search Page

```tsx
// apps/web/src/app/(app)/search/page.tsx
"use client";

import { useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { SearchFilters, SearchResultCard } from "@/components/search";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>({});
  const debouncedQuery = useDebounce(query, 300);

  const { data: results, isLoading } = trpc.search.search.useQuery(
    { query: debouncedQuery, filters },
    { enabled: debouncedQuery.length >= 2 }
  );

  return (
    <div className="container max-w-4xl py-8">
      <h1 className="text-2xl font-bold mb-6">Search</h1>

      {/* Search Input */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <Input
          type="search"
          placeholder="Search by meaning, not just keywords..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 h-12 text-lg"
          autoFocus
        />
      </div>

      <div className="flex gap-6">
        {/* Filters Sidebar */}
        <div className="w-64 shrink-0">
          <SearchFiltersSidebar
            filters={filters}
            onChange={setFilters}
          />
        </div>

        {/* Results */}
        <div className="flex-1 space-y-4">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          )}

          {!isLoading && query.length >= 2 && results?.length === 0 && (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700">No results found</h3>
              <p className="text-gray-500 mt-1">
                Try different keywords or adjust your filters
              </p>
            </div>
          )}

          {!isLoading && results && results.length > 0 && (
            <>
              <p className="text-sm text-gray-500 mb-4">
                {results.length} result{results.length !== 1 ? "s" : ""} found
              </p>
              {results.map((result) => (
                <SearchResultCard key={result.id} result={result} query={query} />
              ))}
            </>
          )}

          {query.length < 2 && (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700">
                Start typing to search
              </h3>
              <p className="text-gray-500 mt-1">
                Search across all your inbox items, notes, actions, and resources
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

### Auto-Indexing on Content Changes

```typescript
// Middleware to auto-index content on create/update

// In inbox item creation
export const inboxRouter = router({
  create: protectedProcedure
    .input(createInboxItemSchema)
    .mutation(async ({ ctx, input }) => {
      const item = await prisma.inboxItem.create({
        data: { ...input, userId: ctx.session.user.id },
      });

      // Index asynchronously (don't block response)
      indexContent({
        sourceType: "INBOX_ITEM",
        sourceId: item.id,
        userId: ctx.session.user.id,
        content: item.rawContent,
      }).catch(console.error);

      return item;
    }),

  update: protectedProcedure
    .input(updateInboxItemSchema)
    .mutation(async ({ ctx, input }) => {
      const item = await prisma.inboxItem.update({
        where: { id: input.id, userId: ctx.session.user.id },
        data: input,
      });

      // Re-index on update
      indexContent({
        sourceType: "INBOX_ITEM",
        sourceId: item.id,
        userId: ctx.session.user.id,
        content: item.processedContent || item.rawContent,
        projectId: item.projectId ?? undefined,
        areaId: item.areaId ?? undefined,
      }).catch(console.error);

      return item;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await prisma.inboxItem.delete({
        where: { id: input.id, userId: ctx.session.user.id },
      });

      // Remove from index
      removeFromIndex("INBOX_ITEM", input.id).catch(console.error);

      return { success: true };
    }),
});
```

### tRPC Procedures

```typescript
export const searchRouter = router({
  search: protectedProcedure
    .input(z.object({
      query: z.string().min(2),
      filters: z.object({
        types: z.array(z.nativeEnum(SearchSourceType)).optional(),
        projectId: z.string().optional(),
        areaId: z.string().optional(),
        tags: z.array(z.string()).optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
      }).optional(),
      limit: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ ctx, input }) => {
      return semanticSearch(
        ctx.session.user.id,
        input.query,
        input.filters,
        input.limit
      );
    }),

  reindex: protectedProcedure
    .mutation(async ({ ctx }) => {
      const count = await reindexUserContent(ctx.session.user.id);
      return { indexed: count };
    }),
});
```

## Dependencies

- Epic 1 (pgvector enabled in database)
- OpenAI API key configured
- @prisma/client with raw query support

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/db/prisma/schema.prisma` | Modify | Add SearchIndex model |
| `apps/web/src/server/services/embedding.service.ts` | Create | OpenAI embedding generation |
| `apps/web/src/server/services/search.service.ts` | Create | Semantic search logic |
| `apps/web/src/server/routers/search.ts` | Create | Search tRPC procedures |
| `apps/web/src/components/search/search-command-bar.tsx` | Create | Cmd+K search dialog |
| `apps/web/src/components/search/search-result-card.tsx` | Create | Individual result display |
| `apps/web/src/app/(app)/search/page.tsx` | Create | Full search page |
| `apps/web/src/app/(app)/layout.tsx` | Modify | Add SearchCommandBar |

## Testing Checklist

- [ ] Embeddings generated correctly for new content
- [ ] Search returns semantically similar results
- [ ] Results ordered by similarity score
- [ ] Snippets show relevant context
- [ ] Cmd+K opens search from anywhere
- [ ] Search latency < 1 second (NFR2)
- [ ] Filters narrow results correctly
- [ ] Content indexed within 30 seconds of creation
- [ ] Deleted content removed from index
- [ ] Reindex command works for all content

## Definition of Done

- [ ] pgvector enabled and SearchIndex table created
- [ ] Embedding service with OpenAI integration
- [ ] Semantic search service with cosine similarity
- [ ] Auto-indexing on content create/update/delete
- [ ] Search command bar (Cmd+K)
- [ ] Search results page
- [ ] Result snippets with context
- [ ] Performance < 1 second for typical queries
- [ ] TypeScript/ESLint pass
- [ ] Unit tests for search service

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-01-11 | 1.0 | Initial story specification | Bob (SM) |
