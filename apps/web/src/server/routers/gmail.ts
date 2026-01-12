import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { GmailService } from "../services/gmail.service";
import { TRPCError } from "@trpc/server";
import { prisma } from "@packages/db";

export const gmailRouter = router({
  /**
   * Sync unread emails from Gmail
   */
  syncInbox: protectedProcedure
    .input(
      z
        .object({
          maxResults: z.number().min(1).max(50).default(20),
          onlyUnread: z.boolean().default(true),
        })
        .optional()
    )
    .mutation(async ({ ctx, input }) => {
      // Get Google OAuth tokens from account
      const account = await prisma.account.findFirst({
        where: {
          userId: ctx.userId,
          provider: "google",
        },
        select: {
          access_token: true,
          refresh_token: true,
        },
      });

      if (!account?.access_token) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Google account not connected. Please sign in with Google.",
        });
      }

      const gmailService = new GmailService(
        account.access_token,
        account.refresh_token ?? undefined
      );

      const result = await gmailService.syncUnreadToInbox(ctx.userId, {
        maxResults: input?.maxResults ?? 20,
        onlyUnread: input?.onlyUnread ?? true,
      });

      return result;
    }),

  /**
   * Get Gmail sync status
   */
  getSyncStatus: protectedProcedure.query(async ({ ctx }) => {
    // Check if Google account is connected
    const account = await prisma.account.findFirst({
      where: {
        userId: ctx.userId,
        provider: "google",
      },
      select: {
        access_token: true,
        scope: true,
      },
    });

    // Check if Gmail scope is granted
    const hasGmailScope = account?.scope?.includes("gmail.readonly") ?? false;

    // Get last synced email
    const lastSync = await prisma.inboxItem.findFirst({
      where: {
        userId: ctx.userId,
        source: "gmail",
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    // Count synced emails
    const syncedCount = await prisma.inboxItem.count({
      where: {
        userId: ctx.userId,
        source: "gmail",
      },
    });

    // Get user settings for last sync time
    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { settings: true },
    });
    const settings = user?.settings as Record<string, unknown> | null;
    const gmailLastSyncAt = settings?.gmailLastSyncAt as string | null;

    return {
      connected: !!account?.access_token,
      hasGmailScope,
      lastSyncAt: gmailLastSyncAt ? new Date(gmailLastSyncAt) : lastSync?.createdAt ?? null,
      totalSynced: syncedCount,
    };
  }),

  /**
   * Get Gmail account info
   */
  getAccount: protectedProcedure.query(async ({ ctx }) => {
    const account = await prisma.account.findFirst({
      where: {
        userId: ctx.userId,
        provider: "google",
      },
      select: {
        access_token: true,
        refresh_token: true,
      },
    });

    if (!account?.access_token) {
      return null;
    }

    try {
      const gmailService = new GmailService(
        account.access_token,
        account.refresh_token ?? undefined
      );
      const profile = await gmailService.getProfile();

      return {
        email: profile.email,
        messagesTotal: profile.messagesTotal,
      };
    } catch (error) {
      console.error("[GmailRouter] Failed to get Gmail profile:", error);
      return null;
    }
  }),

  /**
   * Test Gmail connection
   */
  testConnection: protectedProcedure.query(async ({ ctx }) => {
    const account = await prisma.account.findFirst({
      where: {
        userId: ctx.userId,
        provider: "google",
      },
      select: {
        access_token: true,
        refresh_token: true,
      },
    });

    if (!account?.access_token) {
      return {
        success: false,
        error: "Google account not connected",
      };
    }

    return GmailService.testConnection(
      account.access_token,
      account.refresh_token ?? undefined
    );
  }),
});
