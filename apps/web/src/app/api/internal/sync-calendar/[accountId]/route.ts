import { NextResponse } from "next/server";
import { prisma } from "@packages/db";
import { calendarService } from "@/server/services/calendar";

const MAX_CONSECUTIVE_FAILURES = 5;

/**
 * Sync calendar events for a specific account
 * Called by n8n for each account that needs syncing
 *
 * POST /api/internal/sync-calendar/:accountId
 * Headers: X-Internal-Secret: <secret>
 *
 * Syncs events for the next 30 days and upserts to database.
 * Tracks consecutive failures and disables sync after 5 failures.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ accountId: string }> }
) {
  // Validate internal request
  const secret = request.headers.get("X-Internal-Secret");
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { accountId } = await params;
  const startTime = Date.now();

  try {
    // Get account with credentials
    const account = await prisma.calendarAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Check if sync is enabled
    if (!account.syncEnabled) {
      return NextResponse.json(
        { error: "Sync is disabled for this account" },
        { status: 400 }
      );
    }

    // Check if token is expired
    if (account.tokenExpired) {
      return NextResponse.json(
        { error: "Token expired", requiresReauth: true },
        { status: 401 }
      );
    }

    // Check consecutive failures
    if (account.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      return NextResponse.json(
        {
          error: "Account disabled due to too many consecutive failures",
          consecutiveFailures: account.consecutiveFailures,
        },
        { status: 400 }
      );
    }

    // Perform sync using the calendar service
    const result = await calendarService.syncCalendar(accountId);

    // Reset consecutive failures on success
    await prisma.calendarAccount.update({
      where: { id: accountId },
      data: {
        consecutiveFailures: 0,
        lastSyncAt: new Date(),
        syncStatus: "idle",
        lastSyncError: null,
      },
    });

    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      synced: result.synced,
      accountId,
      provider: account.provider,
      lastSyncAt: new Date().toISOString(),
      durationMs,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[SyncCalendar] Sync failed for ${accountId}:`, error);

    // Check if this is a token expiration error
    const isTokenError =
      errorMessage.toLowerCase().includes("token") ||
      errorMessage.toLowerCase().includes("unauthorized") ||
      errorMessage.toLowerCase().includes("authentication") ||
      errorMessage.toLowerCase().includes("401");

    if (isTokenError) {
      // Flag as expired token
      await prisma.calendarAccount.update({
        where: { id: accountId },
        data: {
          tokenExpired: true,
          syncStatus: "error",
          lastSyncError: errorMessage,
        },
      });

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          requiresReauth: true,
          accountId,
        },
        { status: 401 }
      );
    }

    // Increment consecutive failures for other errors
    const account = await prisma.calendarAccount.findUnique({
      where: { id: accountId },
      select: { consecutiveFailures: true },
    });

    const newFailureCount = (account?.consecutiveFailures || 0) + 1;
    const shouldDisable = newFailureCount >= MAX_CONSECUTIVE_FAILURES;

    await prisma.calendarAccount.update({
      where: { id: accountId },
      data: {
        consecutiveFailures: newFailureCount,
        syncStatus: "error",
        lastSyncError: errorMessage,
        ...(shouldDisable && { syncEnabled: false }),
      },
    });

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        accountId,
        consecutiveFailures: newFailureCount,
        syncDisabled: shouldDisable,
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check sync status for an account
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ accountId: string }> }
) {
  // Validate internal request
  const secret = request.headers.get("X-Internal-Secret");
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { accountId } = await params;

  try {
    const account = await prisma.calendarAccount.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        name: true,
        provider: true,
        syncEnabled: true,
        tokenExpired: true,
        consecutiveFailures: true,
        lastSyncAt: true,
        lastSyncError: true,
        syncStatus: true,
      },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Count events for this account
    const eventCount = await prisma.calendarEvent.count({
      where: { calendarAccountId: accountId },
    });

    return NextResponse.json({
      ...account,
      eventCount,
    });
  } catch (error) {
    console.error(`[SyncCalendar] Status check failed for ${accountId}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
