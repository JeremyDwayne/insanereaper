CREATE TABLE `kill_count` (
	`character_id` text NOT NULL,
	`log_id` text NOT NULL,
	`kind` text NOT NULL,
	`value` integer NOT NULL,
	PRIMARY KEY(`character_id`, `log_id`, `kind`),
	FOREIGN KEY (`character_id`) REFERENCES `character`(`id`) ON UPDATE no action ON DELETE cascade
);
