import { router } from "../trpc";
import { inboxRouter } from "./inbox";
import { userRouter } from "./user";

export const appRouter = router({
  inbox: inboxRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;
