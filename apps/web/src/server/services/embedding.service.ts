import OpenAI, { APIError } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const EMBEDDING_MODEL = "text-embedding-3-small";
const MAX_TEXT_LENGTH = 30000; // ~8k tokens
const BATCH_SIZE = 2048; // OpenAI batch limit

// Rate limiting configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 60000;

// Cost tracking (approximate - text-embedding-3-small is $0.00002 per 1K tokens)
const TOKENS_PER_1K_COST_USD = 0.00002;
let embeddingCallCount = 0;
let estimatedTokensUsed = 0;

/**
 * Get current embedding usage stats
 */
export function getEmbeddingUsageStats() {
  return {
    callCount: embeddingCallCount,
    estimatedTokensUsed,
    estimatedCostUSD: (estimatedTokensUsed / 1000) * TOKENS_PER_1K_COST_USD,
  };
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute an OpenAI API call with retry logic for rate limiting
 */
async function executeWithRetry<T>(
  fn: () => Promise<T>,
  retryCount: number = 0
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof APIError) {
      // Rate limited (429) or server error (5xx)
      if (error.status === 429 || (error.status && error.status >= 500)) {
        if (retryCount < MAX_RETRIES) {
          // Get retry-after header or use exponential backoff
          const retryAfter = error.headers?.["retry-after"];
          let delayMs: number;

          if (retryAfter) {
            // retry-after can be seconds or a date
            const parsed = parseInt(retryAfter, 10);
            delayMs = isNaN(parsed) ? INITIAL_RETRY_DELAY_MS : parsed * 1000;
          } else {
            // Exponential backoff with jitter
            const baseDelay = INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount);
            const jitter = Math.random() * 0.3 * baseDelay;
            delayMs = Math.min(baseDelay + jitter, MAX_RETRY_DELAY_MS);
          }

          console.warn(
            `OpenAI rate limited (${error.status}), retrying in ${delayMs}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`
          );
          await sleep(delayMs);
          return executeWithRetry(fn, retryCount + 1);
        }
      }
    }
    throw error;
  }
}

/**
 * Estimate token count for text (rough approximation: 1 token ≈ 4 characters)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export async function generateEmbedding(text: string): Promise<number[]> {
  // Truncate to model's context limit
  const truncatedText = text.slice(0, MAX_TEXT_LENGTH);

  const response = await executeWithRetry(async () =>
    openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: truncatedText,
    })
  );

  // Track usage
  embeddingCallCount++;
  estimatedTokensUsed += estimateTokens(truncatedText);

  return response.data[0].embedding;
}

export async function generateBatchEmbeddings(
  texts: string[]
): Promise<number[][]> {
  // Split into batches
  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    batches.push(texts.slice(i, i + BATCH_SIZE));
  }

  const results: number[][] = [];

  for (const batch of batches) {
    const truncatedBatch = batch.map((t) => t.slice(0, MAX_TEXT_LENGTH));

    const response = await executeWithRetry(async () =>
      openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: truncatedBatch,
      })
    );

    // Track usage
    embeddingCallCount++;
    estimatedTokensUsed += truncatedBatch.reduce(
      (sum, t) => sum + estimateTokens(t),
      0
    );

    results.push(...response.data.map((d) => d.embedding));

    // Add a small delay between batches to avoid rate limiting
    if (batches.length > 1) {
      await sleep(100);
    }
  }

  return results;
}

// Helper to format embedding array for pgvector
export function formatEmbeddingForPgVector(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
