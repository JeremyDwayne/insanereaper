-- Makes character.user_id nullable. D1 enforces foreign keys even under PRAGMA foreign_keys=OFF, so dropping
-- `character` would cascade-delete every progress row. The progress tables are copied aside and dropped first,
-- then recreated and filled after `character` is rebuilt.
CREATE TABLE `__item_progress` AS SELECT * FROM `item_progress`;--> statement-breakpoint
CREATE TABLE `__task_progress` AS SELECT * FROM `task_progress`;--> statement-breakpoint
CREATE TABLE `__kill_count` AS SELECT * FROM `kill_count`;--> statement-breakpoint
CREATE TABLE `__task_part` AS SELECT * FROM `task_part`;--> statement-breakpoint
DROP TABLE `item_progress`;--> statement-breakpoint
DROP TABLE `task_progress`;--> statement-breakpoint
DROP TABLE `kill_count`;--> statement-breakpoint
DROP TABLE `task_part`;--> statement-breakpoint
CREATE TABLE `__new_character` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_character`("id", "user_id", "name", "name_key", "created_at") SELECT "id", "user_id", "name", "name_key", "created_at" FROM `character`;--> statement-breakpoint
DROP TABLE `character`;--> statement-breakpoint
ALTER TABLE `__new_character` RENAME TO `character`;--> statement-breakpoint
CREATE UNIQUE INDEX `character_name_key_unique` ON `character` (`name_key`);--> statement-breakpoint
CREATE TABLE `item_progress` (
	`character_id` text NOT NULL,
	`item_id` text NOT NULL,
	`count` integer NOT NULL,
	PRIMARY KEY(`character_id`, `item_id`),
	FOREIGN KEY (`character_id`) REFERENCES `character`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `task_progress` (
	`character_id` text NOT NULL,
	`task_id` text NOT NULL,
	`completed_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`character_id`, `task_id`),
	FOREIGN KEY (`character_id`) REFERENCES `character`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `kill_count` (
	`character_id` text NOT NULL,
	`boss_id` text NOT NULL,
	`kind` text NOT NULL,
	`value` integer NOT NULL,
	PRIMARY KEY(`character_id`, `boss_id`, `kind`),
	FOREIGN KEY (`character_id`) REFERENCES `character`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `task_part` (
	`character_id` text NOT NULL,
	`task_id` text NOT NULL,
	`part` text NOT NULL,
	PRIMARY KEY(`character_id`, `task_id`, `part`),
	FOREIGN KEY (`character_id`) REFERENCES `character`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `item_progress` SELECT `character_id`, `item_id`, `count` FROM `__item_progress`;--> statement-breakpoint
INSERT INTO `task_progress` SELECT `character_id`, `task_id`, `completed_at` FROM `__task_progress`;--> statement-breakpoint
INSERT INTO `kill_count` SELECT `character_id`, `boss_id`, `kind`, `value` FROM `__kill_count`;--> statement-breakpoint
INSERT INTO `task_part` SELECT `character_id`, `task_id`, `part` FROM `__task_part`;--> statement-breakpoint
DROP TABLE `__item_progress`;--> statement-breakpoint
DROP TABLE `__task_progress`;--> statement-breakpoint
DROP TABLE `__kill_count`;--> statement-breakpoint
DROP TABLE `__task_part`;--> statement-breakpoint
CREATE TABLE `group` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `group_name_key_unique` ON `group` (`name_key`);--> statement-breakpoint
CREATE TABLE `group_character` (
	`group_id` text NOT NULL,
	`character_id` text NOT NULL,
	`added_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`group_id`, `character_id`),
	FOREIGN KEY (`group_id`) REFERENCES `group`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `character`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `group_character_character_idx` ON `group_character` (`character_id`);--> statement-breakpoint
CREATE TABLE `group_leader` (
	`group_id` text NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`group_id`, `user_id`),
	FOREIGN KEY (`group_id`) REFERENCES `group`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `group_leader_user_idx` ON `group_leader` (`user_id`);--> statement-breakpoint
CREATE TABLE `pending_edit` (
	`character_id` text NOT NULL,
	`target` text NOT NULL,
	`edit` text NOT NULL,
	`group_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`character_id`, `target`),
	FOREIGN KEY (`group_id`,`character_id`) REFERENCES `group_character`(`group_id`,`character_id`) ON UPDATE no action ON DELETE cascade
);
