import { prisma, SearchSourceType, Prisma } from "@packages/db";
import { generateEmbedding, formatEmbeddingForPgVector } from "./embedding.service";

export interface SearchFilters {
  types?: SearchSourceType[];
  projectId?: string;
  areaId?: string;
  tags?: string[];
  dateFrom?: Date;
  dateTo?: Date;
}

export interface SearchResult {
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

interface RawSearchResult {
  id: string;
  sourceType: SearchSourceType;
  sourceId: string;
  title: string | null;
  content: string;
  projectId: string | null;
  areaId: string | null;
  tags: string[];
  createdAt: Date;
  similarity: number;
}

export async function semanticSearch(
  userId: string,
  query: string,
  filters: SearchFilters = {},
  limit: number = 20
): Promise<SearchResult[]> {
  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query);
  const queryVector = formatEmbeddingForPgVector(queryEmbedding);

  // Build filter conditions
  const conditions: Prisma.Sql[] = [Prisma.sql`"userId" = ${userId}`];

  if (filters.types && filters.types.length > 0) {
    const typesArray = filters.types.map((t) => `'${t}'`).join(",");
    conditions.push(Prisma.sql`"sourceType" IN (${Prisma.raw(typesArray)})`);
  }

  if (filters.projectId) {
    conditions.push(Prisma.sql`"projectId" = ${filters.projectId}`);
  }

  if (filters.areaId) {
    conditions.push(Prisma.sql`"areaId" = ${filters.areaId}`);
  }

  if (filters.tags && filters.tags.length > 0) {
    conditions.push(Prisma.sql`"tags" && ${filters.tags}::text[]`);
  }

  if (filters.dateFrom) {
    conditions.push(Prisma.sql`"createdAt" >= ${filters.dateFrom}`);
  }

  if (filters.dateTo) {
    conditions.push(Prisma.sql`"createdAt" <= ${filters.dateTo}`);
  }

  const whereClause = Prisma.join(conditions, " AND ");

  // Perform vector similarity search
  const results = await prisma.$queryRaw<RawSearchResult[]>`
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
      1 - ("embedding" <=> ${queryVector}::vector) as similarity
    FROM "SearchIndex"
    WHERE ${whereClause}
    ORDER BY "embedding" <=> ${queryVector}::vector
    LIMIT ${limit}
  `;

  // Generate snippets and return results
  return results.map((result) => ({
    ...result,
    snippet: generateSnippet(result.content, query),
  }));
}

function generateSnippet(content: string, query: string, maxLength: number = 200): string {
  if (!content || content.length <= maxLength) {
    return content;
  }

  // Find the best matching section
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const contentLower = content.toLowerCase();

  if (words.length === 0) {
    return content.slice(0, maxLength) + "...";
  }

  let bestStart = 0;
  let bestScore = 0;

  // Sliding window to find highest density of query words
  const windowSize = maxLength;
  const step = 50;

  for (let i = 0; i < Math.max(1, content.length - windowSize); i += step) {
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

// Quick text search fallback (no embedding required)
export async function quickTextSearch(
  userId: string,
  query: string,
  limit: number = 20
): Promise<SearchResult[]> {
  const results = await prisma.searchIndex.findMany({
    where: {
      userId,
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { content: { contains: query, mode: "insensitive" } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return results.map((result) => ({
    id: result.id,
    sourceType: result.sourceType,
    sourceId: result.sourceId,
    title: result.title,
    content: result.content,
    snippet: generateSnippet(result.content, query),
    similarity: 0.5, // Default similarity for text search
    projectId: result.projectId,
    areaId: result.areaId,
    tags: result.tags,
    createdAt: result.createdAt,
  }));
}
