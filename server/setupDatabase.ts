import type { Express, Request, Response } from "express";
import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { ENV } from "./_core/env";

/**
 * One-time database bootstrap for self-hosted deployments:
 *   POST /api/setup/database
 *   Authorization: Bearer $CRON_SECRET     (or ?key=$CRON_SECRET)
 *
 * Creates every table the app needs (idempotent). This mirrors drizzle/schema.ts
 * so no drizzle-kit migration step is required on the hosting platform.
 */

const TABLES: Array<string> = [
  `CREATE TABLE IF NOT EXISTS \`users\` (
    \`id\` int AUTO_INCREMENT PRIMARY KEY,
    \`openId\` varchar(64) NOT NULL UNIQUE,
    \`name\` text,
    \`email\` varchar(320),
    \`loginMethod\` varchar(64),
    \`role\` enum('user','admin') NOT NULL DEFAULT 'user',
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    \`lastSignedIn\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS \`repositories\` (
    \`id\` int AUTO_INCREMENT PRIMARY KEY,
    \`repoRef\` varchar(255) NOT NULL UNIQUE,
    \`name\` varchar(255) NOT NULL,
    \`owner\` varchar(255) NOT NULL,
    \`description\` text,
    \`language\` varchar(80),
    \`stars\` int NOT NULL DEFAULT 0,
    \`forks\` int NOT NULL DEFAULT 0,
    \`watchers\` int NOT NULL DEFAULT 0,
    \`openIssues\` int NOT NULL DEFAULT 0,
    \`lastUpdated\` timestamp NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS \`commits\` (
    \`id\` int AUTO_INCREMENT PRIMARY KEY,
    \`sha\` varchar(80) NOT NULL UNIQUE,
    \`message\` text NOT NULL,
    \`author\` varchar(255),
    \`date\` timestamp NOT NULL,
    \`repoRef\` varchar(255) NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS \`issues\` (
    \`id\` int AUTO_INCREMENT PRIMARY KEY,
    \`number\` int NOT NULL,
    \`title\` text NOT NULL,
    \`state\` enum('open','closed') NOT NULL,
    \`labels\` text,
    \`createdDate\` timestamp NOT NULL,
    \`repoRef\` varchar(255) NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS \`pull_requests\` (
    \`id\` int AUTO_INCREMENT PRIMARY KEY,
    \`number\` int NOT NULL,
    \`title\` text NOT NULL,
    \`state\` enum('open','closed','merged') NOT NULL,
    \`author\` varchar(255),
    \`createdDate\` timestamp NOT NULL,
    \`repoRef\` varchar(255) NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS \`releases\` (
    \`id\` int AUTO_INCREMENT PRIMARY KEY,
    \`tag\` varchar(120) NOT NULL,
    \`name\` varchar(255) NOT NULL,
    \`body\` text,
    \`publishedDate\` timestamp NOT NULL,
    \`repoRef\` varchar(255) NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS \`monitored_repos\` (
    \`id\` int AUTO_INCREMENT PRIMARY KEY,
    \`userId\` int NOT NULL,
    \`repoRef\` varchar(255) NOT NULL,
    \`isPinned\` boolean NOT NULL DEFAULT false,
    \`alertNewReleases\` boolean NOT NULL DEFAULT false,
    \`alertNewIssues\` boolean NOT NULL DEFAULT false,
    \`alertNewCommits\` boolean NOT NULL DEFAULT false,
    \`scheduleCronTaskUid\` varchar(65),
    \`lastCheckedAt\` timestamp NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`lastCommitSha\` varchar(40) NULL,
    \`lastReleaseTag\` varchar(120) NULL,
    \`lastOpenIssues\` int NULL,
    \`unseenCommits\` int NOT NULL DEFAULT 0,
    \`unseenIssues\` int NOT NULL DEFAULT 0,
    \`unseenReleases\` int NOT NULL DEFAULT 0
  )`,
];

function authorize(req: Request): boolean {
  if (!ENV.cronSecret) return false;
  const header = req.headers.authorization;
  if (header === `Bearer ${ENV.cronSecret}`) return true;
  const key = req.query.key;
  return typeof key === "string" && key === ENV.cronSecret;
}

export function registerSetupRoutes(app: Express) {
  app.post("/api/setup/database", async (req: Request, res: Response) => {
    if (!ENV.cronSecret) return res.status(503).json({ error: "setup-not-configured" });
    if (!authorize(req)) return res.status(401).json({ error: "unauthorized" });

    const db = await getDb();
    if (!db) return res.status(503).json({ error: "database-unavailable", hint: "Set DATABASE_URL and redeploy" });

    const created: Array<string> = [];
    try {
      for (const stmt of TABLES) {
        await db.execute(sql.raw(stmt));
      }
      try {
        await db.execute(sql.raw(
          "CREATE INDEX monitored_user_repo_idx ON monitored_repos (userId, repoRef)"
        ));
      } catch {
        // Index already exists — fine.
      }
      return res.json({ ok: true, tables: TABLES.length, created, timestamp: new Date().toISOString() });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ error: message, timestamp: new Date().toISOString() });
    }
  });
}
