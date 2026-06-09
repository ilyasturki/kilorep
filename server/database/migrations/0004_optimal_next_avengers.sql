CREATE TABLE `workout_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workout_id` integer NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `workout_exercises` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entry_id` integer NOT NULL,
	`exercise_id` integer NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `workout_entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `workout_sets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workout_exercise_id` integer NOT NULL,
	`reps` integer NOT NULL,
	`weight` real,
	`done` integer DEFAULT false NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`workout_exercise_id`) REFERENCES `workout_exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `workouts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer,
	`name` text NOT NULL,
	`started_at` integer DEFAULT (unixepoch()) NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE set null
);
