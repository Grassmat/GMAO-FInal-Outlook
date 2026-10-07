CREATE TABLE `purchase_receipts` (
	`order_id` text PRIMARY KEY NOT NULL,
	`part` text NOT NULL,
	`site` text NOT NULL,
	`quantity` integer NOT NULL,
	`actor` text NOT NULL,
	`created` text NOT NULL
);
