/**
 * Performance Test Script for Story 7.1
 *
 * This script measures the performance of key operations after optimizations:
 * - getNeedsReviewQueue (raw SQL vs JS filtering)
 * - getDisagreementsQueue (raw SQL vs JS filtering)
 * - queueMetrics (groupBy vs multiple counts)
 * - getInboxStepData (parallelized queries)
 * - Map-based ordering (O(n) vs O(n²))
 *
 * Run with: npx tsx scripts/performance-test.ts
 */

import { performance } from "perf_hooks";
import { prisma } from "../packages/db/src";

interface BenchmarkResult {
  name: string;
  duration: number;
  iterations: number;
  avgDuration: number;
  target?: number;
  passed?: boolean;
}

const results: BenchmarkResult[] = [];

async function benchmark(
  name: string,
  fn: () => Promise<unknown>,
  iterations = 10,
  target?: number
): Promise<BenchmarkResult> {
  const durations: number[] = [];

  // Warm-up run
  await fn();

  // Measured runs
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    const duration = performance.now() - start;
    durations.push(duration);
  }

  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const result: BenchmarkResult = {
    name,
    duration: durations.reduce((a, b) => a + b, 0),
    iterations,
    avgDuration,
    target,
    passed: target ? avgDuration < target : undefined,
  };

  results.push(result);

  const status = result.passed !== undefined
    ? (result.passed ? "✓" : "✗")
    : "-";
  const targetStr = target ? ` (target: <${target}ms)` : "";

  console.log(`${status} ${name}: ${avgDuration.toFixed(2)}ms avg${targetStr}`);

  return result;
}

async function runTests() {
  console.log("=".repeat(60));
  console.log("Performance Benchmark - Story 7.1 Optimizations");
  console.log("=".repeat(60));
  console.log();

  // Get a test user (first user in the database)
  const user = await prisma.user.findFirst();
  if (!user) {
    console.log("No users found. Please seed the database first.");
    return;
  }

  const userId = user.id;
  console.log(`Testing with user: ${user.email}`);
  console.log();

  // Test 1: getNeedsReviewQueue - Raw SQL filtering
  console.log("--- Inbox Queue Performance ---");

  await benchmark(
    "getNeedsReviewQueue (raw SQL)",
    async () => {
      const threshold = 0.6;
      await prisma.$queryRaw`
        SELECT * FROM "InboxItem"
        WHERE "userId" = ${userId}
          AND status = 'pending'
          AND (
            "aiClassification" IS NULL
            OR ("aiClassification"->>'confidence')::float < ${threshold}
          )
        ORDER BY "createdAt" ASC
        LIMIT 100
      `;
    },
    10,
    50 // Target: <50ms
  );

  await benchmark(
    "getDisagreementsQueue (raw SQL)",
    async () => {
      await prisma.$queryRaw`
        SELECT * FROM "InboxItem"
        WHERE "userId" = ${userId}
          AND status = 'pending'
          AND "userFeedback" IS NOT NULL
          AND ("userFeedback"->>'deferredToWeekly')::boolean = true
        ORDER BY "createdAt" ASC
        LIMIT 100
      `;
    },
    10,
    50
  );

  console.log();
  console.log("--- Queue Metrics Performance ---");

  // Test 2: queueMetrics - GroupBy vs multiple counts
  await benchmark(
    "queueMetrics (groupBy)",
    async () => {
      const [counts, total] = await Promise.all([
        prisma.inboxItem.groupBy({
          by: ["status"],
          where: { userId },
          _count: { _all: true },
        }),
        prisma.inboxItem.count({ where: { userId } }),
      ]);
      return { counts, total };
    },
    10,
    100
  );

  console.log();
  console.log("--- Combined Query Performance ---");

  // Test 3: getInboxStepData - Parallelized queries
  await benchmark(
    "getInboxStepData (parallel)",
    async () => {
      const threshold = 0.6;
      await Promise.all([
        // getNeedsReviewQueue
        prisma.$queryRaw`
          SELECT * FROM "InboxItem"
          WHERE "userId" = ${userId}
            AND status = 'pending'
            AND (
              "aiClassification" IS NULL
              OR ("aiClassification"->>'confidence')::float < ${threshold}
            )
          ORDER BY "createdAt" ASC
          LIMIT 100
        `,
        // getDisagreementsQueue
        prisma.$queryRaw`
          SELECT * FROM "InboxItem"
          WHERE "userId" = ${userId}
            AND status = 'pending'
            AND "userFeedback" IS NOT NULL
            AND ("userFeedback"->>'deferredToWeekly')::boolean = true
          ORDER BY "createdAt" ASC
          LIMIT 100
        `,
        // Projects
        prisma.project.findMany({
          where: { userId, status: "active" },
          select: { id: true, name: true, color: true },
          orderBy: { name: "asc" },
        }),
        // Areas
        prisma.area.findMany({
          where: { userId },
          select: { id: true, name: true, icon: true },
          orderBy: { sortOrder: "asc" },
        }),
      ]);
    },
    10,
    200 // Target: <200ms for all queries combined
  );

  console.log();
  console.log("--- Ordering Performance (in-memory) ---");

  // Test 4: Map-based ordering vs find-based ordering
  const testSize = 1000;
  const items = Array.from({ length: testSize }, (_, i) => ({
    id: `item-${i}`,
    content: `Content ${i}`,
  }));
  const ids = items.map((i) => i.id);

  await benchmark(
    `Map-based ordering (O(n), n=${testSize})`,
    async () => {
      const itemMap = new Map(items.map((i) => [i.id, i]));
      ids.map((id) => itemMap.get(id)).filter(Boolean);
    },
    100,
    5 // Should be very fast
  );

  await benchmark(
    `find-based ordering (O(n²), n=${testSize})`,
    async () => {
      ids.map((id) => items.find((i) => i.id === id)).filter(Boolean);
    },
    100
    // No target - this is the slow baseline
  );

  console.log();
  console.log("=".repeat(60));
  console.log("Summary");
  console.log("=".repeat(60));

  const passed = results.filter((r) => r.passed === true).length;
  const failed = results.filter((r) => r.passed === false).length;
  const noTarget = results.filter((r) => r.passed === undefined).length;

  console.log(`Passed: ${passed}/${passed + failed} benchmarks`);
  if (failed > 0) {
    console.log(`Failed: ${failed} benchmarks`);
    results.filter((r) => r.passed === false).forEach((r) => {
      console.log(`  - ${r.name}: ${r.avgDuration.toFixed(2)}ms (target: <${r.target}ms)`);
    });
  }
  if (noTarget > 0) {
    console.log(`No target: ${noTarget} benchmarks`);
  }

  console.log();
  console.log("Targets based on Story 7.1 Acceptance Criteria:");
  console.log("  - Database queries: <50ms");
  console.log("  - Queue metrics: <100ms");
  console.log("  - Page data load: <200ms");
  console.log("  - Swipe response: <200ms (UI tested manually)");

  await prisma.$disconnect();
}

runTests().catch(console.error);
