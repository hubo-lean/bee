import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { n8nService } from "@/lib/services/n8n";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!n8nService.isConfigured()) {
      return NextResponse.json({
        success: false,
        error: "n8n is not configured",
      });
    }

    const result = await n8nService.testConnection();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error testing n8n connection:", error);
    return NextResponse.json(
      { success: false, error: "Failed to test connection" },
      { status: 500 }
    );
  }
}
