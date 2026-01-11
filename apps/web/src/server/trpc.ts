import { initTRPC, TRPCError } from "@trpc/server";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import superjson from "superjson";

export interface Context {
  session: Session | null;
}

export async function createContext(): Promise<Context> {
  const session = await auth();
  return { session };
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session?.user?.id) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource",
    });
  }

  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      userId: ctx.session.user.id,
    },
  });
});
