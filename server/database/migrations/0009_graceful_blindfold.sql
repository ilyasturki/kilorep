CREATE TABLE `api_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`label` text NOT NULL,
	`token_hash` text NOT NULL,
	`token_prefix` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`last_used_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_tokens_hash_unique` ON `api_tokens` (`token_hash`);--> statement-breakpoint
INSERT INTO `api_tokens` (`user_id`, `label`, `token_hash`, `token_prefix`)
SELECT `id`, 'Migrated token', `api_token_hash`, 'kr_'
FROM `users` WHERE `api_token_hash` IS NOT NULL;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `api_token_hash`;