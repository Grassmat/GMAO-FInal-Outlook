CREATE INDEX `intervention_machines_lookup` ON `intervention_machines` (`machine`,`intervention`);--> statement-breakpoint
CREATE INDEX `interventions_site_date` ON `interventions` (`site`,`date`);