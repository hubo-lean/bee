import { prisma } from "@packages/db";
import { auth } from "@/lib/auth";

/**
 * Beacon endpoint for saving session state on page unload
 * Uses minimal processing for reliability
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await request.json();
    const { sessionId, lastActivityAt } = body;

    if (!sessionId || typeof sessionId !== "string") {
      return new Response("Invalid session ID", { status: 400 });
    }

    // Verify ownership and update
    await prisma.reviewSession.updateMany({
      where: {
        id: sessionId,
        userId: session.user.id,
      },
      data: {
        lastActivityAt: lastActivityAt ? new Date(lastActivityAt) : new Date(),
      },
    });

    return new Response("OK", { status: 200 });
  } catch {
    // Beacon saves should fail silently to not block page unload
    return new Response("OK", { status: 200 });
  }
}
