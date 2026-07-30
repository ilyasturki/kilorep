ALTER TABLE `users` ADD `google_sub` text;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL UNIQUE,
	`password_hash` text,
	`google_sub` text UNIQUE,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`(`id`, `email`, `password_hash`, `created_at`) SELECT `id`, `email`, `password_hash`, `created_at` FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;