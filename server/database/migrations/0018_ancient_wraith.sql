ALTER TABLE `exercises` ADD `load_mode` text DEFAULT 'total' NOT NULL;--> statement-breakpoint
UPDATE `exercises` SET `load_mode` = 'per-hand' WHERE `equipment` = 'dumbbell';--> statement-breakpoint
UPDATE `exercises` SET `load_mode` = 'total' WHERE `name` = 'Overhead Dumbbell Triceps Extension';--> statement-breakpoint
UPDATE `exercises` SET `load_mode` = 'per-hand' WHERE `name` IN ('Cable Fly', 'Incline Cable Fly');--> statement-breakpoint
UPDATE `exercises` SET `load_mode` = 'unilateral' WHERE `name` IN ('Dumbbell Row', 'Cable Lateral Raise');
