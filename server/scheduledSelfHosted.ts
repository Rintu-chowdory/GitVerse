import type { Express, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { monitoredRepos } from "../drizzle/schema";
import { getDb, listAllMonitoredRepos } from "./db";
import { ENV } from "./_core/env";
import { getRepositorySnapshot } from "./github";

/**
 * Self-hosted scheduled checks (replaces the legacy Manus cron system).
 *
 * Triggered by any external scheduler (e.g. a GitHub Actions workflow) via:
 *   POST /api/cron/check-monitored
 *   Authorization: Bearer $CRON_SECRET     (or ?key=$CRON_SECRET)
 *
 * For every monitored repository it compares GitHub's current state against
 * the baselines stored on the row (latest commit SHA, latest release tag,
 * open-issue count), increments per-category "unseen" counters that the UI
 * surfaces as new-activity badges, and refreshes the baselines.
 */

function authorize(req: Request): boolean {
  if (!ENV.cronSecret) return false;
  const header = req.headers.authorization;
  if (header === `Bearer ${ENV.cronSecret}`) return true;
  const key = req.query.key;
  return typeof key === "string" && key === ENV.cronSecret;
}

export function registerScheduledRoutes(app: Express) {
  const handler = async (req: Request, res: Response) => {
    if (!ENV.cronSecret) {
      return res.status(503).json({ error: "cron-not-configured" });
    }
    if (!authorize(req)) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const db = await getDb();
    if (!db) return res.json({ ok: true, skipped: "database-unavailable", timestamp: new Date().toISOString() });

    const rows = await listAllMonitoredRepos();
    if (!rows.length) return res.json({ ok: true, checked: 0, timestamp: new Date().toISOString() });

    let newItems = 0;
    const results: Array<Record<string, unknown>> = [];

    for (const row of rows) {
      try {
        const snapshot = await getRepositorySnapshot(row.repoRef);

        // New commits: everything newer than the last seen SHA (the snapshot
        // lists the latest 8 commits, newest first). First run only records
        // the baseline so it never reports the entire history as new.
        let newCommits = 0;
        if (row.alertNewCommits && row.lastCommitSha) {
          const shas = snapshot.commits.map(c => c.sha);
          const idx = shas.indexOf(row.lastCommitSha);
          newCommits = idx === -1 ? shas.length : idx;
        }

        // New issues: increase in open issues since the last baseline.
        const openIssues = snapshot.issues.filter(i => i.state === "open").length;
        let newIssues = 0;
        if (row.alertNewIssues && row.lastOpenIssues != null) {
          newIssues = Math.max(0, openIssues - row.lastOpenIssues);
        }

        // New releases: published after the last check.
        let newReleases = 0;
        if (row.alertNewReleases && row.lastCheckedAt) {
          newReleases = snapshot.releases.filter(
            r => r.published_at && new Date(r.published_at) > row.lastCheckedAt!
          ).length;
        }

        const patch: Record<string, unknown> = {
          lastCheckedAt: new Date(),
          unseenCommits: (row.unseenCommits ?? 0) + newCommits,
          unseenIssues: (row.unseenIssues ?? 0) + newIssues,
          unseenReleases: (row.unseenReleases ?? 0) + newReleases,
          lastOpenIssues: openIssues,
        };
        if (snapshot.commits[0]?.sha) patch.lastCommitSha = snapshot.commits[0].sha;
        if (snapshot.releases[0]?.tag_name) patch.lastReleaseTag = snapshot.releases[0].tag_name;

        await db.update(monitoredRepos).set(patch).where(eq(monitoredRepos.id, row.id));
        newItems += newCommits + newIssues + newReleases;
        if (newCommits || newIssues || newReleases) {
          results.push({ repoRef: row.repoRef, newCommits, newIssues, newReleases });
        }
      } catch (error) {
        results.push({ repoRef: row.repoRef, error: error instanceof Error ? error.message : String(error) });
      }
    }

    return res.json({
      ok: true,
      checked: rows.length,
      newItems,
      reposWithNewActivity: results.length,
      results,
      timestamp: new Date().toISOString(),
    });
  };

  app.post("/api/cron/check-monitored", handler);
  app.get("/api/cron/check-monitored", handler);
}
