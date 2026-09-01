CREATE TABLE `commits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sha` varchar(80) NOT NULL,
	`message` text NOT NULL,
	`author` varchar(255),
	`date` timestamp NOT NULL,
	`repoRef` varchar(255) NOT NULL,
	CONSTRAINT `commits_id` PRIMARY KEY(`id`),
	CONSTRAINT `commits_sha_unique` UNIQUE(`sha`)
);
--> statement-breakpoint
CREATE TABLE `issues` (
	`id` int AUTO_INCREMENT NOT NULL,
	`number` int NOT NULL,
	`title` text NOT NULL,
	`state` enum('open','closed') NOT NULL,
	`labels` text,
	`createdDate` timestamp NOT NULL,
	`repoRef` varchar(255) NOT NULL,
	CONSTRAINT `issues_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `monitored_repos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`repoRef` varchar(255) NOT NULL,
	`isPinned` boolean NOT NULL DEFAULT false,
	`alertNewReleases` boolean NOT NULL DEFAULT false,
	`alertNewIssues` boolean NOT NULL DEFAULT false,
	`alertNewCommits` boolean NOT NULL DEFAULT false,
	`scheduleCronTaskUid` varchar(65),
	`lastCheckedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `monitored_repos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pull_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`number` int NOT NULL,
	`title` text NOT NULL,
	`state` enum('open','closed','merged') NOT NULL,
	`author` varchar(255),
	`createdDate` timestamp NOT NULL,
	`repoRef` varchar(255) NOT NULL,
	CONSTRAINT `pull_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `releases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tag` varchar(120) NOT NULL,
	`name` varchar(255) NOT NULL,
	`body` text,
	`publishedDate` timestamp NOT NULL,
	`repoRef` varchar(255) NOT NULL,
	CONSTRAINT `releases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `repositories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`repoRef` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`owner` varchar(255) NOT NULL,
	`description` text,
	`language` varchar(80),
	`stars` int NOT NULL DEFAULT 0,
	`forks` int NOT NULL DEFAULT 0,
	`watchers` int NOT NULL DEFAULT 0,
	`openIssues` int NOT NULL DEFAULT 0,
	`lastUpdated` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `repositories_id` PRIMARY KEY(`id`),
	CONSTRAINT `repositories_repoRef_unique` UNIQUE(`repoRef`)
);
--> statement-breakpoint
CREATE INDEX `monitored_user_repo_idx` ON `monitored_repos` (`userId`,`repoRef`);