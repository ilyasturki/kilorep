ALTER TABLE `exercises` ADD `source` text DEFAULT 'custom' NOT NULL;--> statement-breakpoint
UPDATE `exercises` SET `source` = 'catalog' WHERE `name` IN (
	'Barbell Bench Press', 'Incline Barbell Bench Press', 'Dumbbell Bench Press',
	'Incline Dumbbell Bench Press', 'Machine Chest Press', 'Incline Machine Chest Press',
	'Pec Deck Fly', 'Cable Fly', 'Incline Cable Fly', 'Dumbbell Fly', 'Push-Up',
	'Chest Dip', 'Overhead Press', 'Dumbbell Shoulder Press', 'Machine Shoulder Press',
	'Arnold Press', 'Dumbbell Lateral Raise', 'Cable Lateral Raise', 'Machine Lateral Raise',
	'Reverse Pec Deck', 'Dumbbell Rear Delt Fly', 'Face Pull', 'Barbell Shrug',
	'Dumbbell Shrug', 'Deadlift', 'Pull-Up', 'Chin-Up', 'Lat Pulldown',
	'Close-Grip Lat Pulldown', 'Barbell Row', 'Dumbbell Row', 'Seated Cable Row',
	'T-Bar Row', 'Machine Row', 'Straight-Arm Pulldown', 'Barbell Curl', 'Dumbbell Curl',
	'Hammer Curl', 'Incline Dumbbell Curl', 'Preacher Curl', 'Cable Curl',
	'Close-Grip Bench Press', 'Triceps Dip', 'Cable Triceps Pushdown',
	'Overhead Cable Triceps Extension', 'Overhead Dumbbell Triceps Extension',
	'Skull Crusher', 'Back Squat', 'Front Squat', 'Hack Squat', 'Leg Press',
	'Bulgarian Split Squat', 'Walking Lunge', 'Leg Extension', 'Romanian Deadlift',
	'Seated Leg Curl', 'Lying Leg Curl', 'Hip Thrust', 'Hip Abduction',
	'Standing Calf Raise', 'Seated Calf Raise', 'Hanging Leg Raise', 'Cable Crunch',
	'Plank', 'Russian Twist'
);