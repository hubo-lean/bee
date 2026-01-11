import { z } from "zod";
import { nanoid } from "nanoid";
import { router, protectedProcedure } from "../trpc";
import { prisma } from "@packages/db";

const EMAIL_DOMAIN = process.env.EMAIL_DOMAIN || "bee.example.com";

export const userRouter = router({
  generateForwardToken: protectedProcedure.mutation(async ({ ctx }) => {
    // Check for existing email_forward token
    const existing = await prisma.userToken.findFirst({
      where: {
        userId: ctx.userId,
        type: "email_forward",
      },
    });

    if (existing) {
      return {
        token: existing.token,
        address: `inbox+${existing.token}@${EMAIL_DOMAIN}`,
        isNew: false,
      };
    }

    // Generate new 12-character token
    const token = nanoid(12);

    await prisma.userToken.create({
      data: {
        userId: ctx.userId,
        token,
        type: "email_forward",
      },
    });

    return {
      token,
      address: `inbox+${token}@${EMAIL_DOMAIN}`,
      isNew: true,
    };
  }),

  getForwardAddress: protectedProcedure.query(async ({ ctx }) => {
    const existing = await prisma.userToken.findFirst({
      where: {
        userId: ctx.userId,
        type: "email_forward",
      },
    });

    if (!existing) {
      return {
        hasAddress: false,
        address: null,
        token: null,
      };
    }

    return {
      hasAddress: true,
      address: `inbox+${existing.token}@${EMAIL_DOMAIN}`,
      token: existing.token,
    };
  }),

  regenerateForwardToken: protectedProcedure.mutation(async ({ ctx }) => {
    // Delete existing token if any
    await prisma.userToken.deleteMany({
      where: {
        userId: ctx.userId,
        type: "email_forward",
      },
    });

    // Generate new token
    const token = nanoid(12);

    await prisma.userToken.create({
      data: {
        userId: ctx.userId,
        token,
        type: "email_forward",
      },
    });

    return {
      token,
      address: `inbox+${token}@${EMAIL_DOMAIN}`,
    };
  }),

  // Story 3.4: Get user settings
  getSettings: protectedProcedure.query(async ({ ctx }) => {
    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { settings: true },
    });

    const settings = user?.settings as Record<string, unknown> | null;

    return {
      confidenceThreshold: (settings?.confidenceThreshold as number) ?? 0.6,
      autoArchiveDays: (settings?.autoArchiveDays as number) ?? 30,
      defaultModel: (settings?.defaultModel as string) ?? "claude",
      weeklyReviewDay: (settings?.weeklyReviewDay as number) ?? 0, // Sunday
    };
  }),

  // Story 3.4: Update confidence threshold
  updateConfidenceThreshold: protectedProcedure
    .input(z.object({ threshold: z.number().min(0).max(1) }))
    .mutation(async ({ ctx, input }) => {
      const user = await prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { settings: true },
      });

      const currentSettings = (user?.settings as Record<string, unknown>) ?? {};

      const updatedUser = await prisma.user.update({
        where: { id: ctx.userId },
        data: {
          settings: {
            ...currentSettings,
            confidenceThreshold: input.threshold,
          },
        },
        select: { settings: true },
      });

      return {
        success: true,
        settings: updatedUser.settings,
      };
    }),

  // Story 3.4: Update all settings
  updateSettings: protectedProcedure
    .input(
      z.object({
        confidenceThreshold: z.number().min(0).max(1).optional(),
        autoArchiveDays: z.number().min(1).max(365).optional(),
        defaultModel: z.string().optional(),
        weeklyReviewDay: z.number().min(0).max(6).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { settings: true },
      });

      const currentSettings = (user?.settings as Record<string, unknown>) ?? {};

      const updatedUser = await prisma.user.update({
        where: { id: ctx.userId },
        data: {
          settings: {
            ...currentSettings,
            ...input,
          },
        },
        select: { settings: true },
      });

      return {
        success: true,
        settings: updatedUser.settings,
      };
    }),
});
