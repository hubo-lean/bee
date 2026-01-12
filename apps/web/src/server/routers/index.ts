import { router } from "../trpc";
import { inboxRouter } from "./inbox";
import { userRouter } from "./user";
import { reviewRouter } from "./review";
import { objectivesRouter } from "./objectives";
import { weeklyReviewRouter } from "./weekly-review";
import { paraRouter } from "./para";
import { calendarRouter } from "./calendar";
import { searchRouter } from "./search";

export const appRouter = router({
  inbox: inboxRouter,
  user: userRouter,
  review: reviewRouter,
  objectives: objectivesRouter,
  weeklyReview: weeklyReviewRouter,
  para: paraRouter,
  calendar: calendarRouter,
  search: searchRouter,
});

export type AppRouter = typeof appRouter;
