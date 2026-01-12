import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { calendarService } from "../services/calendar";

export const calendarRouter = router({
  getAccounts: protectedProcedure.query(async ({ ctx }) => {
    return calendarService.getAccounts(ctx.userId);
  }),

  getDefaultAccount: protectedProcedure.query(async ({ ctx }) => {
    return calendarService.getDefaultAccount(ctx.userId);
  }),

  getEvents: protectedProcedure
    .input(
      z.object({
        dateRange: z.object({
          start: z.date(),
          end: z.date(),
        }),
        accountId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return calendarService.getEventsFromCache(
        ctx.userId,
        input.dateRange,
        input.accountId
      );
    }),

  syncCalendar: protectedProcedure
    .input(z.object({ accountId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      return calendarService.syncCalendar(input.accountId);
    }),

  getSummary: protectedProcedure
    .input(z.object({ weekStart: z.date() }))
    .query(async ({ ctx, input }) => {
      return calendarService.getSummary(ctx.userId, input.weekStart);
    }),

  getFreeSlots: protectedProcedure
    .input(
      z.object({
        date: z.date(),
        minDuration: z.number().min(15).max(480).default(60),
      })
    )
    .query(async ({ ctx, input }) => {
      return calendarService.getFreeSlots(ctx.userId, input.date, input.minDuration);
    }),

  createTimeBlock: protectedProcedure
    .input(
      z.object({
        actionId: z.string(),
        startTime: z.date(),
        duration: z.number().min(15).max(480),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return calendarService.createTimeBlock(ctx.userId, input);
    }),

  deleteTimeBlock: protectedProcedure
    .input(z.object({ actionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return calendarService.deleteTimeBlock(ctx.userId, input.actionId);
    }),
});
