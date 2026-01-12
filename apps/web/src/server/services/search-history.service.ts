import { prisma, Prisma } from "@packages/db";
import { subHours } from "date-fns";
import type { SearchFilters } from "./search.service";

const MAX_HISTORY_ITEMS = 50;

export interface SearchHistoryItem {
  id: string;
  query: string;
  filters?: SearchFilters;
  searchedAt: Date;
}

export interface SavedSearchItem {
  id: string;
  name: string;
  query: string;
  filters?: SearchFilters;
  createdAt: Date;
  updatedAt: Date;
}

export interface SavedSearchInput {
  name: string;
  query: string;
  filters?: SearchFilters;
}

// Helper to safely parse JSON filters
function parseFilters(filters: Prisma.JsonValue | null): SearchFilters | undefined {
  if (!filters) return undefined;
  try {
    if (typeof filters === "string") {
      return JSON.parse(filters) as SearchFilters;
    }
    return filters as SearchFilters;
  } catch {
    return undefined;
  }
}

/**
 * Save a search to history
 * Deduplicates searches within 1 hour by updating the timestamp
 */
export async function saveSearchHistory(
  userId: string,
  query: string,
  filters?: SearchFilters
): Promise<void> {
  // Check if same search exists recently (within 1 hour)
  const recentSame = await prisma.searchHistory.findFirst({
    where: {
      userId,
      query,
      searchedAt: { gte: subHours(new Date(), 1) },
    },
  });

  if (recentSame) {
    // Update timestamp instead of creating new
    await prisma.searchHistory.update({
      where: { id: recentSame.id },
      data: { searchedAt: new Date() },
    });
    return;
  }

  // Create new history entry
  await prisma.searchHistory.create({
    data: {
      userId,
      query,
      filters: filters && Object.keys(filters).length > 0 ? (filters as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });

  // Prune old entries if over limit
  const count = await prisma.searchHistory.count({ where: { userId } });
  if (count > MAX_HISTORY_ITEMS) {
    const oldestToKeep = await prisma.searchHistory.findMany({
      where: { userId },
      orderBy: { searchedAt: "desc" },
      take: MAX_HISTORY_ITEMS,
      select: { id: true },
    });

    await prisma.searchHistory.deleteMany({
      where: {
        userId,
        id: { notIn: oldestToKeep.map((h) => h.id) },
      },
    });
  }
}

/**
 * Get recent search history for a user
 */
export async function getRecentSearches(
  userId: string,
  limit: number = 10
): Promise<SearchHistoryItem[]> {
  const history = await prisma.searchHistory.findMany({
    where: { userId },
    orderBy: { searchedAt: "desc" },
    take: limit,
  });

  return history.map((h) => ({
    id: h.id,
    query: h.query,
    filters: parseFilters(h.filters),
    searchedAt: h.searchedAt,
  }));
}

/**
 * Clear all search history for a user
 */
export async function clearSearchHistory(userId: string): Promise<void> {
  await prisma.searchHistory.deleteMany({ where: { userId } });
}

/**
 * Create a saved search
 */
export async function createSavedSearch(
  userId: string,
  input: SavedSearchInput
): Promise<SavedSearchItem> {
  const saved = await prisma.savedSearch.create({
    data: {
      userId,
      name: input.name,
      query: input.query,
      filters: input.filters && Object.keys(input.filters).length > 0
        ? (input.filters as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    },
  });

  return {
    id: saved.id,
    name: saved.name,
    query: saved.query,
    filters: parseFilters(saved.filters),
    createdAt: saved.createdAt,
    updatedAt: saved.updatedAt,
  };
}

/**
 * Get all saved searches for a user
 */
export async function getSavedSearches(userId: string): Promise<SavedSearchItem[]> {
  const saved = await prisma.savedSearch.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return saved.map((s) => ({
    id: s.id,
    name: s.name,
    query: s.query,
    filters: parseFilters(s.filters),
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }));
}

/**
 * Delete a saved search
 */
export async function deleteSavedSearch(
  userId: string,
  searchId: string
): Promise<void> {
  await prisma.savedSearch.delete({
    where: { id: searchId, userId },
  });
}

/**
 * Update a saved search
 */
export async function updateSavedSearch(
  userId: string,
  searchId: string,
  input: Partial<SavedSearchInput>
): Promise<SavedSearchItem> {
  const updated = await prisma.savedSearch.update({
    where: { id: searchId, userId },
    data: {
      ...(input.name && { name: input.name }),
      ...(input.query && { query: input.query }),
      ...(input.filters !== undefined && {
        filters: input.filters && Object.keys(input.filters).length > 0
          ? (input.filters as Prisma.InputJsonValue)
          : Prisma.JsonNull
      }),
    },
  });

  return {
    id: updated.id,
    name: updated.name,
    query: updated.query,
    filters: parseFilters(updated.filters),
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  };
}
