CREATE TABLE `quote_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`site` text NOT NULL,
	`recipient` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`sender_email` text NOT NULL,
	`sender_name` text NOT NULL,
	`created` integer NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`decided_by` text,
	`decided_at` integer
);
