import { NextResponse } from "next/server";
import { prisma } from "@packages/db";

/**
 * Flag a calendar account as having an expired token
 * Called by n8n when sync fails due to authentication errors
 *
 * POST /api/internal/calendar-accounts/:id/flag-expired
 * Headers: X-Internal-Secret: <secret>
 *
 * Body (optional):
 * - reason: string - Reason for expiration (for logging)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Validate internal request
  const secret = request.headers.get("X-Internal-Secret");
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: accountId } = await params;

  try {
    // Parse optional body
    let reason: string | undefined;
    try {
      const body = await request.json();
      reason = body.reason;
    } catch {
      // Body is optional
    }

    // Check if account exists
    const account = await prisma.calendarAccount.findUnique({
      where: { id: accountId },
      select: { id: true, name: true, provider: true, userId: true },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Flag account as expired
    await prisma.calendarAccount.update({
      where: { id: accountId },
      data: {
        tokenExpired: true,
        syncStatus: "error",
        lastSyncError: reason || "OAuth token expired - re-authentication required",
      },
    });

    console.log(
      `[CalendarAccounts] Flagged account ${accountId} (${account.provider}) as expired. Reason: ${reason || "Token expired"}`
    );

    return NextResponse.json({
      success: true,
      message: "Account flagged as expired",
      accountId,
    });
  } catch (error) {
    console.error(`[CalendarAccounts] Failed to flag account ${accountId}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
