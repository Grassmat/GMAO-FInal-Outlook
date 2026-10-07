CREATE TABLE `account_tokens` (
	`hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`purpose` text NOT NULL,
	`email` text NOT NULL,
	`fingerprint` text NOT NULL,
	`expires` integer NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `email_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`record_id` text NOT NULL,
	`kind` text NOT NULL,
	`occurrence` text DEFAULT '' NOT NULL,
	`email` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`created` integer NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`first_attempt` integer DEFAULT 0 NOT NULL,
	`lease` integer DEFAULT 0 NOT NULL,
	`provider_id` text
);
--> statement-breakpoint
ALTER TABLE `users` ADD `email` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `email_verified` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `avatar_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `avatar_version` integer DEFAULT 0 NOT NULL;