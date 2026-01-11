import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { libreChatService } from "@/lib/services/librechat";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!libreChatService.isConfigured()) {
      return NextResponse.json({
        success: false,
        error: "LibreChat is not configured",
      });
    }

    const result = await libreChatService.testConnection();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error testing LibreChat connection:", error);
    return NextResponse.json(
      { success: false, error: "Failed to test connection" },
      { status: 500 }
    );
  }
}
