import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@packages/db";
import { z } from "zod";
import crypto from "crypto";

const WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET;

const emailWebhookSchema = z.object({
  userToken: z.string().min(1, "User token is required"),
  from: z.string().min(1, "From address is required"),
  subject: z.string(),
  body: z.string(),
  originalDate: z.string().optional(),
  attachments: z
    .array(
      z.object({
        name: z.string(),
        size: z.number(),
        type: z.string(),
        url: z.string().url().optional(),
      })
    )
    .optional()
    .default([]),
});

function verifySignature(payload: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) {
    console.error("N8N_WEBHOOK_SECRET is not configured");
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac("sha256", WEBHOOK_SECRET)
      .update(payload)
      .digest("hex");

    // Use timing-safe comparison to prevent timing attacks
    if (signature.length !== expectedSignature.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

function cleanSubject(subject: string): string {
  // Remove common forwarding and reply prefixes
  return subject
    .replace(/^(Fwd?:|FW:|Re:|RE:|Fw:|fw:|re:)\s*/gi, "")
    .trim();
}

function extractTextFromHtml(html: string): string {
  // Basic HTML to text conversion
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function POST(request: NextRequest) {
  // Verify signature
  const signature = request.headers.get("x-webhook-signature");
  const body = await request.text();

  if (!signature || !verifySignature(body, signature)) {
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 401 }
    );
  }

  // Parse and validate payload
  let payload;
  try {
    const parsed = JSON.parse(body);
    payload = emailWebhookSchema.parse(parsed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid payload", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }

  // Find user by token
  const userToken = await prisma.userToken.findUnique({
    where: { token: payload.userToken },
    include: { user: true },
  });

  if (!userToken || !userToken.user) {
    return NextResponse.json(
      { error: "Invalid user token" },
      { status: 404 }
    );
  }

  // Check if token is expired
  if (userToken.expiresAt && userToken.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "Token has expired" },
      { status: 401 }
    );
  }

  // Clean subject line and extract body text
  const cleanedSubject = cleanSubject(payload.subject);
  const bodyText = payload.body.includes("<")
    ? extractTextFromHtml(payload.body)
    : payload.body;

  // Format attachment metadata for display
  const attachmentInfo =
    payload.attachments && payload.attachments.length > 0
      ? `\n\n**Attachments:** ${payload.attachments.map((a) => `${a.name} (${a.type}, ${Math.round(a.size / 1024)}KB)`).join(", ")}`
      : "";

  // Create inbox item
  const inboxItem = await prisma.inboxItem.create({
    data: {
      userId: userToken.user.id,
      type: "email",
      content: `**From:** ${payload.from}\n**Subject:** ${cleanedSubject}\n\n${bodyText}${attachmentInfo}`,
      source: "email-forward",
      status: "pending",
    },
  });

  return NextResponse.json({
    success: true,
    inboxItemId: inboxItem.id,
  });
}
