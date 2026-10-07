CREATE TABLE `mail_configuration` (
	`id` text PRIMARY KEY NOT NULL,
	`cipher` text NOT NULL,
	`nonce` text NOT NULL,
	`sender` text DEFAULT '' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mail_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`provider_id` text,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mail_oauth_states` (
	`hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`connection_id` text NOT NULL,
	`revision` integer NOT NULL,
	`verifier` text NOT NULL,
	`expires` integer NOT NULL
);
