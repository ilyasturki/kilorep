ALTER TABLE `workouts` ADD `completed` integer DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE `workouts` SET `completed` = (`completed_at` IS NOT NULL);--> statement-breakpoint
ALTER TABLE `workouts` DROP COLUMN `completed_at`;