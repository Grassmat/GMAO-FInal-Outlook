CREATE TABLE `site_mail_settings` (
	`site` text PRIMARY KEY NOT NULL,
	`sender_email` text DEFAULT '' NOT NULL,
	`sender_name` text DEFAULT 'Maintenance' NOT NULL,
	`confirmed` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE `account_tokens` ADD `context` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `quote_email` integer DEFAULT 0 NOT NULL;