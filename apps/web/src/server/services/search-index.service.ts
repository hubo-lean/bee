import { prisma, SearchSourceType } from "@packages/db";
import { generateEmbedding, formatEmbeddingForPgVector } from "./embedding.service";

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

  if (!searchableText.trim()) {
    console.log(`[SearchIndex] Skipping empty content for ${item.sourceType}:${item.sourceId}`);
    return;
  }

  // Generate embedding
  const embedding = await generateEmbedding(searchableText);
  const embeddingVector = formatEmbeddingForPgVector(embedding);

  // Upsert into search index using raw SQL for pgvector
  await prisma.$executeRaw`
    INSERT INTO "SearchIndex" (
      "id", "userId", "sourceType", "sourceId",
      "title", "content", "embedding",
      "projectId", "areaId", "tags",
      "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid()::text,
      ${item.userId},
      ${item.sourceType}::"SearchSourceType",
      ${item.sourceId},
      ${item.title ?? null},
      ${item.content},
      ${embeddingVector}::vector,
      ${item.projectId ?? null},
      ${item.areaId ?? null},
      ${item.tags ?? []}::text[],
      NOW(),
      NOW()
    )
    ON CONFLICT ("sourceType", "sourceId")
    DO UPDATE SET
      "title" = ${item.title ?? null},
      "content" = ${item.content},
      "embedding" = ${embeddingVector}::vector,
      "projectId" = ${item.projectId ?? null},
      "areaId" = ${item.areaId ?? null},
      "tags" = ${item.tags ?? []}::text[],
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

// Helper to parse tags from Json field
function parseTagsFromJson(tagsJson: unknown): string[] {
  if (!tagsJson) return [];
  if (Array.isArray(tagsJson)) {
    return tagsJson.filter((t): t is string => typeof t === "string");
  }
  return [];
}

export async function reindexUserContent(userId: string): Promise<number> {
  let indexed = 0;

  // Index inbox items
  const inboxItems = await prisma.inboxItem.findMany({
    where: { userId },
    select: {
      id: true,
      content: true,
      tags: true, // Json field
    },
  });

  for (const item of inboxItems) {
    try {
      await indexContent({
        sourceType: "INBOX_ITEM",
        sourceId: item.id,
        userId,
        content: item.content,
        tags: parseTagsFromJson(item.tags),
      });
      indexed++;
    } catch (err) {
      console.error(`[SearchIndex] Failed to index inbox item ${item.id}:`, err);
    }
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
      tags: true, // String[] field
    },
  });

  for (const note of notes) {
    try {
      await indexContent({
        sourceType: "NOTE",
        sourceId: note.id,
        userId,
        title: note.title,
        content: note.content,
        projectId: note.projectId ?? undefined,
        areaId: note.areaId ?? undefined,
        tags: note.tags,
      });
      indexed++;
    } catch (err) {
      console.error(`[SearchIndex] Failed to index note ${note.id}:`, err);
    }
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
    try {
      await indexContent({
        sourceType: "ACTION",
        sourceId: action.id,
        userId,
        content: action.description,
        projectId: action.projectId ?? undefined,
      });
      indexed++;
    } catch (err) {
      console.error(`[SearchIndex] Failed to index action ${action.id}:`, err);
    }
  }

  // Index resources
  const resources = await prisma.resource.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      description: true,
      url: true,
      areaId: true,
    },
  });

  for (const resource of resources) {
    try {
      await indexContent({
        sourceType: "RESOURCE",
        sourceId: resource.id,
        userId,
        title: resource.name,
        content: [resource.description, resource.url].filter(Boolean).join("\n"),
        areaId: resource.areaId ?? undefined,
      });
      indexed++;
    } catch (err) {
      console.error(`[SearchIndex] Failed to index resource ${resource.id}:`, err);
    }
  }

  return indexed;
}

// Helper to index content asynchronously without blocking
export function indexContentAsync(item: IndexableContent): void {
  indexContent(item).catch((err) =>
    console.error(`[SearchIndex] Async indexing failed for ${item.sourceType}:${item.sourceId}:`, err)
  );
}

export function removeFromIndexAsync(sourceType: SearchSourceType, sourceId: string): void {
  removeFromIndex(sourceType, sourceId).catch((err) =>
    console.error(`[SearchIndex] Async removal failed for ${sourceType}:${sourceId}:`, err)
  );
}
