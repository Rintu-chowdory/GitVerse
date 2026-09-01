import { z } from "zod";
import { parse as parseCookie } from "cookie";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { createHeartbeatJob } from "./_core/heartbeat";
import { listMonitoredRepos, saveMonitorPreferences, setScheduleTaskUid } from "./db";
import { searchPublicRepositories, getRepositorySnapshot, normalizeRepoRef } from "./github";

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
  github: router({
    search: publicProcedure.input(z.object({ query: z.string().max(120), page: z.number().int().min(1).max(10).default(1) })).query(({ input }) => searchPublicRepositories(input.query, input.page)),
    repository: publicProcedure.input(z.object({ repoRef: z.string().regex(/^[\w.-]+\/[\w.-]+$/) })).query(({ input }) => getRepositorySnapshot(normalizeRepoRef(input.repoRef))),
  }),
  monitoring: router({
    list: protectedProcedure.query(({ ctx }) => listMonitoredRepos(ctx.user.id)),
    update: protectedProcedure.input(z.object({ repoRef: z.string().regex(/^[\w.-]+\/[\w.-]+$/), isPinned: z.boolean().optional(), alertNewCommits: z.boolean().optional(), alertNewIssues: z.boolean().optional(), alertNewReleases: z.boolean().optional() })).mutation(({ ctx, input }) => {
      const { repoRef, ...patch } = input;
      return saveMonitorPreferences(ctx.user.id, repoRef, patch);
    }),
    schedule: protectedProcedure.input(z.object({ repoRef: z.string().regex(/^[\w.-]+\/[\w.-]+$/), cron: z.string().regex(/^0 \S+ \S+ \S+ \S+ \S+$/).default("0 */15 * * * *") })).mutation(async ({ ctx, input }) => {
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      const job = await createHeartbeatJob({ name: `gitverse-${ctx.user.id}-${input.repoRef.replace("/", "-")}`, cron: input.cron, path: "/api/scheduled/check-github", description: `GitVerse read-only activity check for ${input.repoRef}` }, sessionToken);
      await setScheduleTaskUid(ctx.user.id, input.repoRef, job.taskUid);
      return job;
    }),
  }),
});

export type AppRouter = typeof appRouter;
