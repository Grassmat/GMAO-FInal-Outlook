ALTER TABLE `interventions` ADD `revision` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `interventions` ADD `last_edit` text;--> statement-breakpoint
ALTER TABLE `interventions` ADD `updated_at` text;--> statement-breakpoint
ALTER TABLE `interventions` ADD `updated_by` text;--> statement-breakpoint
ALTER TABLE `interventions` ADD `machine_service` text;--> statement-breakpoint
ALTER TABLE `interventions` ADD `waiting_note` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `interventions` ADD `waiting_order` text;--> statement-breakpoint
UPDATE interventions SET machine_service=json_extract(answers,'$.service')
WHERE json_extract(answers,'$.service') IN ('Oui','Non');
