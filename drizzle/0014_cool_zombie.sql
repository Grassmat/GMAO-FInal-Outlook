ALTER TABLE `email_outbox` ADD `reply_to` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `users_unique_email` ON `users` (`email`) WHERE "users"."email" <> '';