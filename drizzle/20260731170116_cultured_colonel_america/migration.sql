CREATE TABLE `records` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`kind` text NOT NULL,
	`seq` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`payload` text NOT NULL,
	CONSTRAINT `records_pk` PRIMARY KEY(`user_id`, `id`),
	CONSTRAINT `fk_records_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `records_user_seq_idx` ON `records` (`user_id`,`seq`);