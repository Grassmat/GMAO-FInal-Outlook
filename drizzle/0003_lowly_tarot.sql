CREATE TABLE `intervention_files` (
	`id` text PRIMARY KEY NOT NULL,
	`intervention` text NOT NULL,
	`field` text NOT NULL,
	`site` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`object_key` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `intervention_form` (
	`id` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`questions` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `intervention_imports` (
	`id` text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE `intervention_machines` (
	`id` text PRIMARY KEY NOT NULL,
	`intervention` text NOT NULL,
	`machine` text NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `interventions` (
	`id` text PRIMARY KEY NOT NULL,
	`site` text NOT NULL,
	`created` text NOT NULL,
	`actor` text NOT NULL,
	`date` text NOT NULL,
	`duration` integer,
	`answers` text NOT NULL,
	`questions` text NOT NULL,
	`source` text NOT NULL
);
