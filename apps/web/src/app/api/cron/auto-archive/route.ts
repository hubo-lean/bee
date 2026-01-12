import { NextResponse } from "next/server";
import { prisma } from "@packages/db";
import { processAutoArchive } from "@/server/services/auto-archive.service";

interface UserSettings {
  autoArchiveDays?: number;
}

/**
 * Cron endpoint for auto-archiving old inbox items
 * Should be called daily by a cron service (e.g., Vercel Cron, Railway, etc.)
 */
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all users with auto-archive enabled (autoArchiveDays > 0)
    const users = await prisma.user.findMany({
      select: { id: true, settings: true },
    });

    // Filter users with auto-archive enabled
    const usersWithAutoArchive = users.filter((user) => {
      const settings = user.settings as UserSettings | null;
      return (settings?.autoArchiveDays ?? 30) > 0;
    });

    let totalArchived = 0;
    let totalWarned = 0;

    for (const user of usersWithAutoArchive) {
      const result = await processAutoArchive(user.id);
      totalArchived += result.archived;
      totalWarned += result.warned;
    }

    return NextResponse.json({
      success: true,
      usersProcessed: usersWithAutoArchive.length,
      totalArchived,
      totalWarned,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[AutoArchiveCron] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
