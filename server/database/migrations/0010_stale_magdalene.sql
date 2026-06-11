ALTER TABLE `exercises` ADD `aliases` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
UPDATE `exercises` SET `aliases` = '["Flat Bench Press"]' WHERE `name` = 'Barbell Bench Press';--> statement-breakpoint
UPDATE `exercises` SET `aliases` = '["Butterfly","Machine Fly"]' WHERE `name` = 'Pec Deck Fly';--> statement-breakpoint
UPDATE `exercises` SET `aliases` = '["Cable Crossover"]' WHERE `name` = 'Cable Fly';--> statement-breakpoint
UPDATE `exercises` SET `aliases` = '["Press-Up"]' WHERE `name` = 'Push-Up';--> statement-breakpoint
UPDATE `exercises` SET `aliases` = '["Military Press","Barbell Shoulder Press"]' WHERE `name` = 'Overhead Press';--> statement-breakpoint
UPDATE `exercises` SET `aliases` = '["Side Raise"]' WHERE `name` = 'Dumbbell Lateral Raise';--> statement-breakpoint
UPDATE `exercises` SET `aliases` = '["Machine Reverse Fly"]' WHERE `name` = 'Reverse Pec Deck';--> statement-breakpoint
UPDATE `exercises` SET `aliases` = '["Reverse Fly","Bent-Over Lateral Raise"]' WHERE `name` = 'Dumbbell Rear Delt Fly';--> statement-breakpoint
UPDATE `exercises` SET `aliases` = '["Conventional Deadlift"]' WHERE `name` = 'Deadlift';--> statement-breakpoint
UPDATE `exercises` SET `aliases` = '["Bent-Over Row"]' WHERE `name` = 'Barbell Row';--> statement-breakpoint
UPDATE `exercises` SET `aliases` = '["One-Arm Dumbbell Row"]' WHERE `name` = 'Dumbbell Row';--> statement-breakpoint
UPDATE `exercises` SET `aliases` = '["Cable Pullover","Lat Prayer"]' WHERE `name` = 'Straight-Arm Pulldown';--> statement-breakpoint
UPDATE `exercises` SET `aliases` = '["Neutral-Grip Curl"]' WHERE `name` = 'Hammer Curl';--> statement-breakpoint
UPDATE `exercises` SET `aliases` = '["Scott Curl"]' WHERE `name` = 'Preacher Curl';--> statement-breakpoint
UPDATE `exercises` SET `aliases` = '["Triceps Pressdown","Rope Pushdown"]' WHERE `name` = 'Cable Triceps Pushdown';--> statement-breakpoint
UPDATE `exercises` SET `aliases` = '["Lying Triceps Extension","French Press"]' WHERE `name` = 'Skull Crusher';--> statement-breakpoint
UPDATE `exercises` SET `aliases` = '["Barbell Squat"]' WHERE `name` = 'Back Squat';--> statement-breakpoint
UPDATE `exercises` SET `aliases` = '["Rear-Foot-Elevated Split Squat"]' WHERE `name` = 'Bulgarian Split Squat';--> statement-breakpoint
UPDATE `exercises` SET `aliases` = '["Seated Hamstring Curl"]' WHERE `name` = 'Seated Leg Curl';--> statement-breakpoint
UPDATE `exercises` SET `aliases` = '["Lying Hamstring Curl"]' WHERE `name` = 'Lying Leg Curl';--> statement-breakpoint
UPDATE `exercises` SET `aliases` = '["Abductor Machine"]' WHERE `name` = 'Hip Abduction';--> statement-breakpoint
UPDATE `exercises` SET `aliases` = '["Rope Crunch"]' WHERE `name` = 'Cable Crunch';