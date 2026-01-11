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
});
