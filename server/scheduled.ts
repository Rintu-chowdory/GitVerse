import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { monitoredRepos } from "../drizzle/schema";
import { getDb } from "./db";
import { sdk } from "./_core/sdk";
import { notifyOwner } from "./_core/notification";
import { getRepositorySnapshot } from "./github";

export async function checkGithubRepositories(req: Request, res: Response) {
  const startedAt = new Date().toISOString();
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const db = await getDb();
    if (!db) return res.json({ ok: true, skipped: "database-unavailable" });
    const rows = await db.select().from(monitoredRepos).where(eq(monitoredRepos.scheduleCronTaskUid, user.taskUid));
    if (!rows.length) return res.json({ ok: true, skipped: "orphan" });
    let notifications = 0;
    for (const row of rows) {
      const snapshot = await getRepositorySnapshot(row.repoRef);
      const releaseCount = row.alertNewReleases ? snapshot.releases.length : 0;
      const issueCount = row.alertNewIssues ? snapshot.issues.length : 0;
      const commitCount = row.alertNewCommits ? snapshot.commits.length : 0;
      if (releaseCount || issueCount || commitCount) {
        const sent = await notifyOwner({ title: `GitVerse activity · ${row.repoRef}`, content: `${commitCount} commits, ${issueCount} issues, and ${releaseCount} releases matched your enabled alerts.` });
        if (sent) notifications += 1;
      }
      await db.update(monitoredRepos).set({ lastCheckedAt: new Date() }).where(eq(monitoredRepos.id, row.id));
    }
    return res.json({ ok: true, checked: rows.length, notifications, startedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message, timestamp: new Date().toISOString(), context: { url: req.originalUrl, taskUid: "unavailable", startedAt } });
  }
}
