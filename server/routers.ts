import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { ChartRange, MarketDataError, marketDataService } from "./marketData";

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

async function loadMarketChart(coinId: string, days: ChartRange) {
  try {
    return await marketDataService.getChart(coinId, days);
  } catch (error) {
    const message = error instanceof MarketDataError
      ? error.message
      : "価格チャートを取得できませんでした。しばらくしてから再試行してください。";
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
    chart: publicProcedure
      .input(z.object({ id: z.string().regex(/^[a-z0-9-]+$/), days: z.enum(["1", "7", "30", "365"]) }))
      .query(({ input }) => loadMarketChart(input.id, input.days)),
  }),
});

export type AppRouter = typeof appRouter;
