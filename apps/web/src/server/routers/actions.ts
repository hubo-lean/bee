import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { prisma } from "@packages/db";

export const actionsRouter = router({
  /**
   * Get count of actions due today (for Today badge in sidebar)
   * Includes: due today, scheduled for today, and overdue items
   */
  getTodayCount: protectedProcedure.query(async ({ ctx }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const count = await prisma.action.count({
      where: {
        userId: ctx.session.user.id,
        status: { not: "completed" },
        OR: [
          // Due today
          {
            dueDate: {
              gte: today,
              lt: tomorrow,
            },
          },
          // Scheduled for today
          {
            scheduledFor: {
              gte: today,
              lt: tomorrow,
            },
          },
          // Overdue
          {
            dueDate: {
              lt: today,
            },
          },
        ],
      },
    });

    return count;
  }),

  /**
   * Get all actions for today view
   * Returns overdue items + items due today + items scheduled for today
   */
  getToday: protectedProcedure.query(async ({ ctx }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const actions = await prisma.action.findMany({
      where: {
        userId: ctx.session.user.id,
        status: { not: "completed" },
        OR: [
          // Due today
          {
            dueDate: {
              gte: today,
              lt: tomorrow,
            },
          },
          // Scheduled for today
          {
            scheduledFor: {
              gte: today,
              lt: tomorrow,
            },
          },
          // Overdue
          {
            dueDate: {
              lt: today,
            },
          },
        ],
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        area: {
          select: {
            id: true,
            name: true,
            icon: true,
            color: true,
          },
        },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    });

    // Add computed flags to each action
    return actions.map((action) => {
      const isDueToday = action.dueDate
        ? action.dueDate >= today && action.dueDate < tomorrow
        : false;
      const isScheduledToday = action.scheduledFor
        ? action.scheduledFor >= today && action.scheduledFor < tomorrow
        : false;
      const isOverdue = action.dueDate ? action.dueDate < today : false;

      return {
        ...action,
        isOverdue,
        isDueToday,
        isScheduledToday,
      };
    });
  }),

  /**
   * Toggle action completion status
   */
  toggleComplete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const action = await prisma.action.findFirst({
        where: { id: input.id, userId: ctx.session.user.id },
      });

      if (!action) {
        throw new Error("Action not found");
      }

      const isCompleting = action.status !== "completed";

      return prisma.action.update({
        where: { id: input.id },
        data: {
          status: isCompleting ? "completed" : "pending",
          completedAt: isCompleting ? new Date() : null,
        },
      });
    }),

  /**
   * Update action details
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        description: z.string().optional(),
        status: z.enum(["pending", "in_progress", "completed", "archived"]).optional(),
        priority: z.enum(["urgent", "high", "normal", "low"]).optional(),
        dueDate: z.date().nullable().optional(),
        scheduledFor: z.date().nullable().optional(),
        projectId: z.string().uuid().nullable().optional(),
        areaId: z.string().uuid().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // Verify ownership
      const action = await prisma.action.findFirst({
        where: { id, userId: ctx.session.user.id },
      });

      if (!action) {
        throw new Error("Action not found");
      }

      return prisma.action.update({
        where: { id },
        data: {
          ...data,
          completedAt: data.status === "completed" ? new Date() : data.status ? null : undefined,
        },
      });
    }),

  /**
   * Delete an action
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const action = await prisma.action.findFirst({
        where: { id: input.id, userId: ctx.session.user.id },
      });

      if (!action) {
        throw new Error("Action not found");
      }

      return prisma.action.delete({
        where: { id: input.id },
      });
    }),

  /**
   * List actions with filtering
   */
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(["pending", "in_progress", "completed", "archived"]).optional(),
        projectId: z.string().uuid().optional(),
        areaId: z.string().uuid().optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const actions = await prisma.action.findMany({
        where: {
          userId: ctx.session.user.id,
          ...(input.status && { status: input.status }),
          ...(input.projectId && { projectId: input.projectId }),
          ...(input.areaId && { areaId: input.areaId }),
        },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        include: {
          project: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
          area: {
            select: {
              id: true,
              name: true,
              icon: true,
              color: true,
            },
          },
        },
      });

      let nextCursor: string | undefined = undefined;
      if (actions.length > input.limit) {
        const nextItem = actions.pop();
        nextCursor = nextItem?.id;
      }

      return {
        actions,
        nextCursor,
      };
    }),
});
