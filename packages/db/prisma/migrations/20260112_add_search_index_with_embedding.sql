-- Migration: Add SearchIndex table with pgvector embedding support
-- This migration creates the SearchIndex table and its vector index for semantic search

-- Enable pgvector extension (should already exist from other embedding tables)
CREATE EXTENSION IF NOT EXISTS vector;

-- Create SearchSourceType enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE "SearchSourceType" AS ENUM ('INBOX_ITEM', 'NOTE', 'ACTION', 'RESOURCE', 'CONVERSATION');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create SearchIndex table
CREATE TABLE IF NOT EXISTS "SearchIndex" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceType" "SearchSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "projectId" TEXT,
    "areaId" TEXT,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchIndex_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on sourceType + sourceId
ALTER TABLE "SearchIndex"
ADD CONSTRAINT "SearchIndex_sourceType_sourceId_key"
UNIQUE ("sourceType", "sourceId");

-- Create foreign key to User
ALTER TABLE "SearchIndex"
ADD CONSTRAINT "SearchIndex_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create basic indexes
CREATE INDEX IF NOT EXISTS "SearchIndex_userId_idx" ON "SearchIndex"("userId");
CREATE INDEX IF NOT EXISTS "SearchIndex_sourceType_idx" ON "SearchIndex"("sourceType");

-- Create HNSW index for fast vector similarity search
-- HNSW provides better query performance than IVFFlat for most use cases
-- Using cosine distance operator (vector_cosine_ops) for similarity search
-- m=16: Maximum connections per layer (higher = more accurate, more memory)
-- ef_construction=64: Size of candidate list during construction (higher = more accurate, slower build)
CREATE INDEX IF NOT EXISTS "SearchIndex_embedding_hnsw_idx"
ON "SearchIndex"
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Create SearchHistory table
CREATE TABLE IF NOT EXISTS "SearchHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "filters" JSONB,
    "searchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchHistory_pkey" PRIMARY KEY ("id")
);

-- Create foreign key to User for SearchHistory
ALTER TABLE "SearchHistory"
ADD CONSTRAINT "SearchHistory_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create index for SearchHistory lookups
CREATE INDEX IF NOT EXISTS "SearchHistory_userId_searchedAt_idx"
ON "SearchHistory"("userId", "searchedAt" DESC);

-- Create SavedSearch table
CREATE TABLE IF NOT EXISTS "SavedSearch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "filters" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);

-- Create foreign key to User for SavedSearch
ALTER TABLE "SavedSearch"
ADD CONSTRAINT "SavedSearch_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create index for SavedSearch lookups
CREATE INDEX IF NOT EXISTS "SavedSearch_userId_idx" ON "SavedSearch"("userId");
