CREATE TABLE `order_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`site` text NOT NULL,
	`name` text NOT NULL,
	`object_key` text NOT NULL,
	`size` integer NOT NULL,
	`actor` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `order_documents_object_key_unique` ON `order_documents` (`object_key`);--> statement-breakpoint
CREATE INDEX `order_documents_order` ON `order_documents` (`order_id`);