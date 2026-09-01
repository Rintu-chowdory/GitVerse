import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { getGitVerseDashboard } from "./github";
import type { TrpcContext } from "./_core/context";

describe("GitVerse dashboard and monitoring", () => {
  it("returns an empty, well-shaped dashboard for an empty monitored set", async () => {
    const snapshot = await getGitVerseDashboard([]);
    expect(snapshot.repos).toEqual([]);
    expect(snapshot.activity).toEqual([]);
    expect(snapshot.stats).toEqual({ activeRepositories: 0, totalStars: 0, openIssues: 0, recentReleases: 0 });
    expect(snapshot.streak).toEqual({ current: 0, days: [0, 0, 0, 0, 0, 0, 0] });
  });

  it("requires an authenticated user before changing monitoring preferences", async () => {
    const ctx = {
      user: undefined,
      req: { protocol: "https", headers: {} },
      res: { clearCookie: () => undefined },
    } as unknown as TrpcContext;
    const caller = appRouter.createCaller(ctx);
    await expect(caller.monitoring.update({ repoRef: "octo/demo", isPinned: true })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
