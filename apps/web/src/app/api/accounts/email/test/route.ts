import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { accountService } from "@/server/services/account.service";
import { z } from "zod";

const testImapSchema = z.object({
  imapHost: z.string().min(1, "IMAP host is required"),
  imapPort: z.number().int().positive(),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

const testExistingSchema = z.object({
  accountId: z.string().uuid("Invalid account ID"),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Check if testing existing account or new credentials
    if (body.accountId) {
      const validationResult = testExistingSchema.safeParse(body);
      if (!validationResult.success) {
        return NextResponse.json(
          { error: "Validation failed", details: validationResult.error.issues },
          { status: 400 }
        );
      }

      const result = await accountService.testExistingEmailAccount(
        session.user.id,
        validationResult.data.accountId
      );

      return NextResponse.json(result);
    }

    // Testing new credentials
    const validationResult = testImapSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const result = await accountService.testImapConnection({
      name: "",
      email: "",
      smtpHost: "",
      smtpPort: 587,
      ...validationResult.data,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error testing email connection:", error);
    return NextResponse.json(
      { success: false, error: "Failed to test connection" },
      { status: 500 }
    );
  }
}
