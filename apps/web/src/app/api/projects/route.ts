import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@packages/db";
import { auth } from "@/lib/auth";

/**
 * Verify the webhook secret from n8n (for automated access)
 */
function verifyWebhookSecret(request: NextRequest): boolean {
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return false;
  }

  const providedSecret = request.headers.get("X-Webhook-Secret");
  return providedSecret === webhookSecret;
}

/**
 * GET /api/projects
 * Returns list of projects for the authenticated user or n8n service
 * Used by n8n for entity linking during tag extraction
 */
export async function GET(request: NextRequest) {
  try {
    // Check for n8n webhook authentication first
    const isN8nRequest = verifyWebhookSecret(request);

    // Get userId from query param (for n8n) or session
    let userId: string | undefined;

    if (isN8nRequest) {
      // n8n passes userId as query param
      const url = new URL(request.url);
      userId = url.searchParams.get("userId") ?? undefined;

      if (!userId) {
        return NextResponse.json(
          { success: false, error: "userId query parameter required for service access" },
          { status: 400 }
        );
      }
    } else {
      // Regular user authentication
      const session = await auth();

      if (!session?.user?.id) {
        return NextResponse.json(
          { success: false, error: "Unauthorized" },
          { status: 401 }
        );
      }

      userId = session.user.id;
    }

    // Fetch user's projects
    const projects = await prisma.project.findMany({
      where: {
        userId,
        status: { in: ["active", "on_hold"] }, // Only active projects for matching
      },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: projects,
    });
  } catch (error) {
    console.error("[ProjectsAPI] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
