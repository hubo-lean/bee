import { google, gmail_v1, Auth } from "googleapis";
import { prisma } from "@packages/db";
import { aiClassificationService } from "./ai-classification.service";

/**
 * Email message structure
 */
export interface EmailMessage {
  messageId: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  snippet: string;
  date: Date;
  labels: string[];
  attachments: Array<{
    filename: string;
    mimeType: string;
    size: number;
  }>;
}

/**
 * Sync result structure
 */
export interface GmailSyncResult {
  synced: number;
  skipped: number;
  errors: number;
  messages: Array<{ id: string; subject: string }>;
}

/**
 * Sync options
 */
export interface GmailSyncOptions {
  maxResults?: number;
  labelIds?: string[];
  onlyUnread?: boolean;
}

/**
 * Gmail Service for syncing emails to Bee inbox
 * Story 7.3: Gmail Inbox Sync
 */
export class GmailService {
  private gmail: gmail_v1.Gmail;
  private oauth2Client: Auth.OAuth2Client;

  constructor(accessToken: string, refreshToken?: string) {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    this.oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    this.gmail = google.gmail({ version: "v1", auth: this.oauth2Client });
  }

  /**
   * Sync unread emails from Gmail to Bee inbox
   */
  async syncUnreadToInbox(
    userId: string,
    options: GmailSyncOptions = {}
  ): Promise<GmailSyncResult> {
    const {
      maxResults = 20,
      labelIds = ["INBOX"],
      onlyUnread = true,
    } = options;

    const result: GmailSyncResult = {
      synced: 0,
      skipped: 0,
      errors: 0,
      messages: [],
    };

    try {
      // Build query
      const q = onlyUnread ? "is:unread" : undefined;

      // List messages
      const listResponse = await this.gmail.users.messages.list({
        userId: "me",
        labelIds,
        maxResults,
        q,
      });

      const messageRefs = listResponse.data.messages || [];

      // Get user context for classification
      const userContext = await aiClassificationService.getUserContext(userId);

      for (const msgRef of messageRefs) {
        try {
          if (!msgRef.id) {
            continue;
          }

          // Check if already synced using Gmail message ID
          const existing = await prisma.inboxItem.findFirst({
            where: {
              userId,
              source: "gmail",
              aiClassification: {
                path: ["gmailMessageId"],
                equals: msgRef.id,
              },
            },
            select: { id: true },
          });

          if (existing) {
            result.skipped++;
            continue;
          }

          // Fetch full message
          const email = await this.fetchMessage(msgRef.id);

          // Create inbox item with email metadata
          const item = await prisma.inboxItem.create({
            data: {
              userId,
              type: "email",
              source: "gmail",
              content: this.formatEmailContent(email),
              status: "processing",
              aiClassification: {
                gmailMessageId: email.messageId,
                gmailThreadId: email.threadId,
                emailFrom: email.from,
                emailTo: email.to,
                emailSubject: email.subject,
                emailDate: email.date.toISOString(),
                emailLabels: email.labels,
                hasAttachments: email.attachments.length > 0,
                attachments: email.attachments,
              },
            },
          });

          // Trigger classification asynchronously
          aiClassificationService
            .classifyItem(item.id, item.content, {
              ...userContext,
              source: "gmail",
            })
            .catch((err) =>
              console.error("[GmailService] Failed to classify email:", item.id, err)
            );

          result.synced++;
          result.messages.push({
            id: item.id,
            subject: email.subject,
          });
        } catch (error) {
          console.error(`[GmailService] Failed to sync message ${msgRef.id}:`, error);
          result.errors++;
        }
      }

      // Update last sync time
      await this.updateSyncStatus(userId);

      return result;
    } catch (error) {
      console.error("[GmailService] Gmail sync failed:", error);
      throw error;
    }
  }

  /**
   * Fetch a single message with full details
   */
  async fetchMessage(messageId: string): Promise<EmailMessage> {
    const response = await this.gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    const message = response.data;
    const headers = message.payload?.headers || [];

    const getHeader = (name: string): string =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";

    // Extract body
    let body = "";
    if (message.payload?.body?.data) {
      body = this.decodeBase64(message.payload.body.data);
    } else if (message.payload?.parts) {
      body = this.extractBodyFromParts(message.payload.parts);
    }

    // Extract attachments metadata
    const attachments = this.extractAttachments(message.payload?.parts || []);

    return {
      messageId: message.id!,
      threadId: message.threadId!,
      from: getHeader("from"),
      to: getHeader("to"),
      subject: getHeader("subject") || "(no subject)",
      body,
      snippet: message.snippet || "",
      date: new Date(parseInt(message.internalDate || "0")),
      labels: message.labelIds || [],
      attachments,
    };
  }

  /**
   * Extract text body from multipart message
   */
  private extractBodyFromParts(parts: gmail_v1.Schema$MessagePart[]): string {
    // Prefer plain text
    const textPart = parts.find((p) => p.mimeType === "text/plain");
    if (textPart?.body?.data) {
      return this.decodeBase64(textPart.body.data);
    }

    // Fall back to HTML (stripped)
    const htmlPart = parts.find((p) => p.mimeType === "text/html");
    if (htmlPart?.body?.data) {
      const html = this.decodeBase64(htmlPart.body.data);
      return this.stripHtml(html);
    }

    // Check nested parts (multipart/alternative, multipart/mixed, etc.)
    for (const part of parts) {
      if (part.parts) {
        const nested = this.extractBodyFromParts(part.parts);
        if (nested) return nested;
      }
    }

    return "";
  }

  /**
   * Extract attachment metadata from message parts
   */
  private extractAttachments(
    parts: gmail_v1.Schema$MessagePart[]
  ): EmailMessage["attachments"] {
    const attachments: EmailMessage["attachments"] = [];

    for (const part of parts) {
      if (part.filename && part.body?.attachmentId) {
        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType || "application/octet-stream",
          size: part.body.size || 0,
        });
      }

      // Check nested parts
      if (part.parts) {
        attachments.push(...this.extractAttachments(part.parts));
      }
    }

    return attachments;
  }

  /**
   * Decode base64 URL-safe encoded string
   */
  private decodeBase64(data: string): string {
    const decoded = Buffer.from(
      data.replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    ).toString("utf-8");
    return decoded;
  }

  /**
   * Strip HTML tags from content
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Format email content for inbox item
   */
  private formatEmailContent(email: EmailMessage): string {
    const lines = [
      `From: ${email.from}`,
      `Subject: ${email.subject}`,
      `Date: ${email.date.toLocaleString()}`,
      "",
      email.body.slice(0, 5000), // Limit body length
    ];

    if (email.attachments.length > 0) {
      lines.push("");
      lines.push(
        `Attachments: ${email.attachments.map((a) => a.filename).join(", ")}`
      );
    }

    return lines.join("\n");
  }

  /**
   * Update sync status in user settings
   */
  private async updateSyncStatus(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        settings: {
          // Using Prisma's merge functionality
          ...(await this.getCurrentSettings(userId)),
          gmailLastSyncAt: new Date().toISOString(),
        },
      },
    });
  }

  /**
   * Get current user settings
   */
  private async getCurrentSettings(userId: string): Promise<Record<string, unknown>> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });
    return (user?.settings as Record<string, unknown>) || {};
  }

  /**
   * Get user profile from Gmail
   */
  async getProfile(): Promise<{ email: string; messagesTotal: number }> {
    const response = await this.gmail.users.getProfile({
      userId: "me",
    });

    return {
      email: response.data.emailAddress || "",
      messagesTotal: response.data.messagesTotal || 0,
    };
  }

  /**
   * Test Gmail connection
   */
  static async testConnection(
    accessToken: string,
    refreshToken?: string
  ): Promise<{ success: boolean; error?: string; latency?: number }> {
    const start = Date.now();

    try {
      const service = new GmailService(accessToken, refreshToken);
      await service.getProfile();

      return {
        success: true,
        latency: Date.now() - start,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Connection failed",
        latency: Date.now() - start,
      };
    }
  }
}
