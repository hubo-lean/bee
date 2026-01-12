import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import {
  listObjectives,
  createObjective,
  updateObjective,
  carryForward,
  archiveObjective,
  deleteObjective,
  getObjectiveById,
  getAvailableParents,
  getCurrentWeekObjectives,
  getTimeframeDates,
  type Timeframe,
  type ObjectiveStatus,
} from "../services/objectives.service";

const timeframeSchema = z.enum(["yearly", "monthly", "weekly"]);
const statusSchema = z.enum(["active", "completed", "deferred", "archived"]);

export const objectivesRouter = router({
  /**
   * List objectives with optional filters
   */
  list: protectedProcedure
    .input(
      z.object({
        timeframe: timeframeSchema.optional(),
        status: statusSchema.optional(),
        includeChildren: z.boolean().default(false),
        parentId: z.string().uuid().nullish(),
      })
    )
    .query(async ({ ctx, input }) => {
      return listObjectives(ctx.session.user.id, {
        timeframe: input.timeframe as Timeframe | undefined,
        status: input.status as ObjectiveStatus | undefined,
        includeChildren: input.includeChildren,
        parentId: input.parentId,
      });
    }),

  /**
   * Get current week's objectives with parent hierarchy
   */
  getCurrentWeek: protectedProcedure.query(async ({ ctx }) => {
    return getCurrentWeekObjectives(ctx.session.user.id);
  }),

  /**
   * Get a single objective by ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const objective = await getObjectiveById(ctx.session.user.id, input.id);

      if (!objective) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Objective not found",
        });
      }

      return objective;
    }),

  /**
   * Get available parent objectives for a timeframe
   */
  getAvailableParents: protectedProcedure
    .input(z.object({ timeframe: timeframeSchema }))
    .query(async ({ ctx, input }) => {
      return getAvailableParents(
        ctx.session.user.id,
        input.timeframe as Timeframe
      );
    }),

  /**
   * Get timeframe dates (for UI date display)
   */
  getTimeframeDates: protectedProcedure
    .input(
      z.object({
        timeframe: timeframeSchema,
        referenceDate: z.date().optional(),
      })
    )
    .query(({ input }) => {
      return getTimeframeDates(
        input.timeframe as Timeframe,
        input.referenceDate
      );
    }),

  /**
   * Create a new objective
   */
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().max(1000).optional(),
        timeframe: timeframeSchema,
        parentId: z.string().uuid().optional(),
        cascadeToWeekly: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate parent if provided
      if (input.parentId) {
        const parent = await getObjectiveById(ctx.session.user.id, input.parentId);
        if (!parent) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Parent objective not found",
          });
        }
      }

      return createObjective(ctx.session.user.id, {
        title: input.title,
        description: input.description,
        timeframe: input.timeframe as Timeframe,
        parentId: input.parentId,
        cascadeToWeekly: input.cascadeToWeekly,
      });
    }),

  /**
   * Update an objective
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(200).optional(),
        description: z.string().max(1000).optional(),
        status: statusSchema.optional(),
        progress: z.number().min(0).max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      try {
        return await updateObjective(ctx.session.user.id, id, {
          title: data.title,
          description: data.description,
          status: data.status as ObjectiveStatus | undefined,
          progress: data.progress,
        });
      } catch {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Objective not found",
        });
      }
    }),

  /**
   * Mark an objective as complete
   */
  complete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await updateObjective(ctx.session.user.id, input.id, {
          status: "completed",
          progress: 100,
        });
      } catch {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Objective not found",
        });
      }
    }),

  /**
   * Carry forward an incomplete objective to the next period
   */
  carryForward: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await carryForward(ctx.session.user.id, input.id);
      } catch (error) {
        if (error instanceof Error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message,
          });
        }
        throw error;
      }
    }),

  /**
   * Archive an objective
   */
  archive: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await archiveObjective(ctx.session.user.id, input.id);
      } catch {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Objective not found",
        });
      }
    }),

  /**
   * Delete an objective (only if no children)
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await deleteObjective(ctx.session.user.id, input.id);
        return { success: true };
      } catch (error) {
        if (error instanceof Error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message,
          });
        }
        throw error;
      }
    }),
});
