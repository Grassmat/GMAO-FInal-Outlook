CREATE TABLE `intervention_parts` (
	`id` text PRIMARY KEY NOT NULL,
	`intervention` text NOT NULL,
	`part` text,
	`name` text NOT NULL,
	`reference` text NOT NULL,
	`quantity` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `intervention_parts_report` ON `intervention_parts` (`intervention`);--> statement-breakpoint
ALTER TABLE `movements` ADD `intervention` text;--> statement-breakpoint
CREATE INDEX `movements_part` ON `movements` (`part`);