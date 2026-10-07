ALTER TABLE `interventions` ADD `author_id` text;--> statement-breakpoint
ALTER TABLE `interventions` ADD `deleted` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `interventions` ADD `deleted_by` text;--> statement-breakpoint
ALTER TABLE `interventions` ADD `deleted_at` text;--> statement-breakpoint
-- One-time attribution of old native reports only when the saved author name is unambiguous.
-- Imported technician lists do not identify the account that submitted a report.
UPDATE interventions SET author_id=(SELECT u.id FROM users u WHERE u.name=interventions.actor)
WHERE source='GMAO' AND author_id IS NULL
  AND (SELECT COUNT(*) FROM users u WHERE u.name=interventions.actor)=1;
