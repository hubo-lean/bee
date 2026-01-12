import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { SearchSourceType } from "@packages/db";
import { semanticSearch, quickTextSearch } from "../services/search.service";
import { reindexUserContent } from "../services/search-index.service";
import {
  saveSearchHistory,
  getRecentSearches,
  clearSearchHistory,
  createSavedSearch,
  getSavedSearches,
  deleteSavedSearch,
} from "../services/search-history.service";

const filtersSchema = z.object({
  types: z.array(z.nativeEnum(SearchSourceType)).optional(),
  projectId: z.string().optional(),
  areaId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
});

export const searchRouter = router({
  search: protectedProcedure
    .input(
      z.object({
        query: z.string().min(2),
        filters: filtersSchema.optional(),
        limit: z.number().min(1).max(100).default(20),
        useSemantic: z.boolean().default(true),
        hydrate: z.boolean().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      // Save to history (async, don't block)
      saveSearchHistory(ctx.userId, input.query, input.filters).catch(
        console.error
      );

      // Use semantic search if OpenAI is configured, otherwise fall back to text search
      if (input.useSemantic && process.env.OPENAI_API_KEY) {
        return semanticSearch(
          ctx.userId,
          input.query,
          input.filters,
          input.limit,
          { hydrate: input.hydrate }
        );
      }

      // Fallback to quick text search (returns same structure as semantic search)
      const results = await quickTextSearch(ctx.userId, input.query, input.limit);
      return {
        results,
        total: results.length,
        latencyMs: 0,
      };
    }),

  reindex: protectedProcedure.mutation(async ({ ctx }) => {
    const count = await reindexUserContent(ctx.userId);
    return { indexed: count };
  }),

  // Search History
  getRecentSearches: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(50).default(10),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return getRecentSearches(ctx.userId, input?.limit);
    }),

  clearHistory: protectedProcedure.mutation(async ({ ctx }) => {
    await clearSearchHistory(ctx.userId);
    return { success: true };
  }),

  // Saved Searches
  getSavedSearches: protectedProcedure.query(async ({ ctx }) => {
    return getSavedSearches(ctx.userId);
  }),

  saveSearch: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        query: z.string().min(1),
        filters: filtersSchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return createSavedSearch(ctx.userId, input);
    }),

  deleteSavedSearch: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await deleteSavedSearch(ctx.userId, input.id);
      return { success: true };
    }),
});
