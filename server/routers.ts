import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { MarketDataError, marketDataService } from "./marketData";

async function loadMarketSnapshot(force = false) {
  try {
    return await marketDataService.getSnapshot(force);
  } catch (error) {
    const message = error instanceof MarketDataError
      ? error.message
      : "市場データを取得できませんでした。しばらくしてから再試行してください。";
    throw new TRPCError({ code: "BAD_GATEWAY", message });
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  market: router({
    overview: publicProcedure.query(() => loadMarketSnapshot()),
    refresh: publicProcedure.mutation(() => loadMarketSnapshot(true)),
  }),
});

export type AppRouter = typeof appRouter;
