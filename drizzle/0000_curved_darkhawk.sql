CREATE TABLE `movements` (
	`id` text PRIMARY KEY NOT NULL,
	`part` text NOT NULL,
	`site` text NOT NULL,
	`quantity` integer NOT NULL,
	`machine` text,
	`reason` text NOT NULL,
	`actor` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `records` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`site` text NOT NULL,
	`data` text NOT NULL
);
