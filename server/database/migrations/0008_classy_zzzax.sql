CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`email` text,
	`name` text,
	`avatar_url` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`catalog_cursor` integer DEFAULT 0 NOT NULL,
	`api_token_hash` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_provider_account_unique` ON `users` (`provider`,`provider_account_id`);--> statement-breakpoint
INSERT INTO `users` (`id`, `provider`, `provider_account_id`, `catalog_cursor`)
SELECT 1, 'local', 'default',
	COALESCE(
		(SELECT CAST(`value` AS integer) FROM `meta` WHERE `key` = 'catalogCursor'),
		CASE WHEN EXISTS (SELECT 1 FROM `exercises`) THEN 65 ELSE 0 END
	)
WHERE EXISTS (SELECT 1 FROM `exercises`)
	OR EXISTS (SELECT 1 FROM `sessions`)
	OR EXISTS (SELECT 1 FROM `workouts`)
	OR EXISTS (SELECT 1 FROM `bodyweight`)
	OR EXISTS (SELECT 1 FROM `meta` WHERE `key` = 'catalogCursor');--> statement-breakpoint
DROP TABLE `meta`;--> statement-breakpoint
CREATE TABLE `__new_exercises` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`equipment` text NOT NULL,
	`type` text NOT NULL,
	`muscles` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_exercises` (`id`, `user_id`, `name`, `equipment`, `type`, `muscles`)
SELECT `id`, 1, `name`, `equipment`, `type`, `muscles` FROM `exercises`;--> statement-breakpoint
DROP TABLE `exercises`;--> statement-breakpoint
ALTER TABLE `__new_exercises` RENAME TO `exercises`;--> statement-breakpoint
CREATE UNIQUE INDEX `exercises_user_name_unique` ON `exercises` (`user_id`,`name`);--> statement-breakpoint
CREATE TABLE `__new_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_sessions` (`id`, `user_id`, `name`, `created_at`)
SELECT `id`, 1, `name`, `created_at` FROM `sessions`;--> statement-breakpoint
DROP TABLE `sessions`;--> statement-breakpoint
ALTER TABLE `__new_sessions` RENAME TO `sessions`;--> statement-breakpoint
CREATE TABLE `__new_workouts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`session_id` integer,
	`name` text NOT NULL,
	`started_at` integer DEFAULT (unixepoch()) NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_workouts` (`id`, `user_id`, `session_id`, `name`, `started_at`, `completed`)
SELECT `id`, 1, `session_id`, `name`, `started_at`, `completed` FROM `workouts`;--> statement-breakpoint
DROP TABLE `workouts`;--> statement-breakpoint
ALTER TABLE `__new_workouts` RENAME TO `workouts`;--> statement-breakpoint
CREATE TABLE `__new_bodyweight` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`date` text NOT NULL,
	`weight` real NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_bodyweight` (`id`, `user_id`, `date`, `weight`, `created_at`)
SELECT `id`, 1, `date`, `weight`, `created_at` FROM `bodyweight`;--> statement-breakpoint
DROP TABLE `bodyweight`;--> statement-breakpoint
ALTER TABLE `__new_bodyweight` RENAME TO `bodyweight`;--> statement-breakpoint
CREATE UNIQUE INDEX `bodyweight_user_date_unique` ON `bodyweight` (`user_id`,`date`);
