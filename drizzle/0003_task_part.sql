CREATE TABLE `task_part` (
	`character_id` text NOT NULL,
	`task_id` text NOT NULL,
	`part` text NOT NULL,
	PRIMARY KEY(`character_id`, `task_id`, `part`),
	FOREIGN KEY (`character_id`) REFERENCES `character`(`id`) ON UPDATE no action ON DELETE cascade
);
