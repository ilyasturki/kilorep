ALTER TABLE `sessions` ADD `position` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `sessions` SET `position` = (
	SELECT COUNT(*) FROM `sessions` AS `s2`
	WHERE `s2`.`user_id` = `sessions`.`user_id`
		AND (
			`s2`.`created_at` > `sessions`.`created_at`
			OR (`s2`.`created_at` = `sessions`.`created_at` AND `s2`.`id` > `sessions`.`id`)
		)
);