import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, User, users, repositories, monitoredRepos } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); }
    catch (error) { console.warn("[Database] Failed to connect:", error); _db = null; }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  (['name', 'email', 'loginMethod'] as const).forEach(field => {
    if (user[field] !== undefined) { values[field] = user[field] ?? null; updateSet[field] = user[field] ?? null; }
  });
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
  values.lastSignedIn ??= new Date();
  if (!Object.keys(updateSet).length) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function listMonitoredRepos(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ repo: repositories, monitor: monitoredRepos })
    .from(monitoredRepos)
    .leftJoin(repositories, eq(monitoredRepos.repoRef, repositories.repoRef))
    .where(eq(monitoredRepos.userId, userId))
    .orderBy(desc(monitoredRepos.isPinned), desc(monitoredRepos.createdAt));
}

export async function setScheduleTaskUid(userId: number, repoRef: string, taskUid: string) {
  const db = await getDb();
  if (!db) return null;
  await db.update(monitoredRepos).set({ scheduleCronTaskUid: taskUid }).where(and(eq(monitoredRepos.userId, userId), eq(monitoredRepos.repoRef, repoRef)));
  return taskUid;
}

export async function saveMonitorPreferences(userId: number, repoRef: string, patch: Partial<{ isPinned: boolean; alertNewCommits: boolean; alertNewIssues: boolean; alertNewReleases: boolean }>) {
  const db = await getDb();
  if (!db) return null;
  const existing = await db.select().from(monitoredRepos).where(and(eq(monitoredRepos.userId, userId), eq(monitoredRepos.repoRef, repoRef))).limit(1);
  if (existing[0]) {
    await db.update(monitoredRepos).set(patch).where(eq(monitoredRepos.id, existing[0].id));
    return { ...existing[0], ...patch };
  }
  await db.insert(monitoredRepos).values({ userId, repoRef, ...patch });
  const created = await db.select().from(monitoredRepos).where(and(eq(monitoredRepos.userId, userId), eq(monitoredRepos.repoRef, repoRef))).limit(1);
  return created[0] ?? null;
}
