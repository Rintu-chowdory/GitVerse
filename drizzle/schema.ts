import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, index } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const repositories = mysqlTable("repositories", {
  id: int("id").autoincrement().primaryKey(),
  repoRef: varchar("repoRef", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  owner: varchar("owner", { length: 255 }).notNull(),
  description: text("description"),
  language: varchar("language", { length: 80 }),
  stars: int("stars").default(0).notNull(),
  forks: int("forks").default(0).notNull(),
  watchers: int("watchers").default(0).notNull(),
  openIssues: int("openIssues").default(0).notNull(),
  lastUpdated: timestamp("lastUpdated"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const commits = mysqlTable("commits", {
  id: int("id").autoincrement().primaryKey(),
  sha: varchar("sha", { length: 80 }).notNull().unique(),
  message: text("message").notNull(),
  author: varchar("author", { length: 255 }),
  date: timestamp("date").notNull(),
  repoRef: varchar("repoRef", { length: 255 }).notNull(),
});

export const issues = mysqlTable("issues", {
  id: int("id").autoincrement().primaryKey(),
  number: int("number").notNull(),
  title: text("title").notNull(),
  state: mysqlEnum("state", ["open", "closed"]).notNull(),
  labels: text("labels"),
  createdDate: timestamp("createdDate").notNull(),
  repoRef: varchar("repoRef", { length: 255 }).notNull(),
});

export const pullRequests = mysqlTable("pull_requests", {
  id: int("id").autoincrement().primaryKey(),
  number: int("number").notNull(),
  title: text("title").notNull(),
  state: mysqlEnum("state", ["open", "closed", "merged"]).notNull(),
  author: varchar("author", { length: 255 }),
  createdDate: timestamp("createdDate").notNull(),
  repoRef: varchar("repoRef", { length: 255 }).notNull(),
});

export const releases = mysqlTable("releases", {
  id: int("id").autoincrement().primaryKey(),
  tag: varchar("tag", { length: 120 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  body: text("body"),
  publishedDate: timestamp("publishedDate").notNull(),
  repoRef: varchar("repoRef", { length: 255 }).notNull(),
});

export const monitoredRepos = mysqlTable("monitored_repos", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  repoRef: varchar("repoRef", { length: 255 }).notNull(),
  isPinned: boolean("isPinned").default(false).notNull(),
  alertNewReleases: boolean("alertNewReleases").default(false).notNull(),
  alertNewIssues: boolean("alertNewIssues").default(false).notNull(),
  alertNewCommits: boolean("alertNewCommits").default(false).notNull(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  lastCheckedAt: timestamp("lastCheckedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({ userRepoIdx: index("monitored_user_repo_idx").on(table.userId, table.repoRef) }));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Repository = typeof repositories.$inferSelect;
export type MonitoredRepo = typeof monitoredRepos.$inferSelect;
