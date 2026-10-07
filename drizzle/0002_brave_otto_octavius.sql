CREATE TABLE `machine_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`machine` text NOT NULL,
	`site` text NOT NULL,
	`name` text NOT NULL,
	`object_key` text NOT NULL,
	`size` integer NOT NULL,
	`actor` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `machine_documents_object_key_unique` ON `machine_documents` (`object_key`);