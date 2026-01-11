import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { accountService } from "@/server/services/account.service";
import { z } from "zod";

const createImapAccountSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  imapHost: z.string().min(1, "IMAP host is required"),
  imapPort: z.number().int().positive(),
  smtpHost: z.string().min(1, "SMTP host is required"),
  smtpPort: z.number().int().positive(),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  isDefault: z.boolean().optional(),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accounts = await accountService.getEmailAccounts(session.user.id);
    return NextResponse.json({ accounts });
  } catch (error) {
    console.error("Error fetching email accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch email accounts" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validationResult = createImapAccountSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const account = await accountService.addImapEmailAccount(
      session.user.id,
      validationResult.data
    );

    // Return sanitized account data (no password)
    return NextResponse.json({
      account: {
        id: account.id,
        name: account.name,
        email: account.email,
        provider: account.provider,
        imapHost: account.imapHost,
        imapPort: account.imapPort,
        smtpHost: account.smtpHost,
        smtpPort: account.smtpPort,
        isDefault: account.isDefault,
        syncStatus: account.syncStatus,
        createdAt: account.createdAt,
      },
    });
  } catch (error) {
    console.error("Error creating email account:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create email account";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("id");

    if (!accountId) {
      return NextResponse.json(
        { error: "Account ID is required" },
        { status: 400 }
      );
    }

    const deleted = await accountService.deleteEmailAccount(
      session.user.id,
      accountId
    );

    if (!deleted) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting email account:", error);
    return NextResponse.json(
      { error: "Failed to delete email account" },
      { status: 500 }
    );
  }
}
