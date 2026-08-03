CREATE TABLE `google_codes` (
	`code_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`challenge` text NOT NULL,
	`expires_at` integer NOT NULL,
	CONSTRAINT `fk_google_codes_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
