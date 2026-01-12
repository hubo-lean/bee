import { NextResponse } from "next/server";
import { prisma } from "@packages/db";

const MAX_CONSECUTIVE_FAILURES = 5;

/**
 * Get calendar accounts that need syncing
 * Called by n8n every 15 minutes to get accounts for calendar sync
 *
 * GET /api/internal/calendar-accounts
 * Headers: X-Internal-Secret: <secret>
 *
 * Returns accounts where:
 * - syncEnabled = true
 * - tokenExpired = false
 * - consecutiveFailures < 5
 */
export async function GET(request: Request) {
  // Validate internal request
  const secret = request.headers.get("X-Internal-Secret");
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get accounts that need syncing
    const accounts = await prisma.calendarAccount.findMany({
      where: {
        syncEnabled: true,
        tokenExpired: false,
        consecutiveFailures: { lt: MAX_CONSECUTIVE_FAILURES },
      },
      select: {
        id: true,
        userId: true,
        provider: true,
        name: true,
        lastSyncAt: true,
        consecutiveFailures: true,
      },
      orderBy: {
        lastSyncAt: "asc", // Prioritize accounts that haven't synced recently
      },
    });

    return NextResponse.json({
      accounts,
      count: accounts.length,
    });
  } catch (error) {
    console.error("[CalendarAccounts] Failed to fetch accounts:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
