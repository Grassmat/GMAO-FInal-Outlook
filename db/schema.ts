import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
export const records = sqliteTable("records", { id: text("id").primaryKey(), kind: text("kind").notNull(), site: text("site").notNull(), data: text("data").notNull() });
export const movements = sqliteTable("movements", { id: text("id").primaryKey(), part: text("part").notNull(), site: text("site").notNull(), quantity: integer("quantity").notNull(), machine: text("machine"), reason: text("reason").notNull(), actor: text("actor").notNull(), created: text("created").notNull(), intervention: text('intervention') }, table => [index('movements_part').on(table.part)]);
export const users = sqliteTable("users", { id: text("id").primaryKey(), username: text("username").notNull().unique(), name: text("name").notNull(), role: text("role").notNull(), site: text("site"), password: text("password").notNull(), active: integer("active").notNull().default(1), changePassword: integer("change_password").notNull().default(1), testAccount: integer('test_account').notNull().default(0), quoteEmail: integer('quote_email').notNull().default(0), email: text('email').notNull().default(''), emailVerified: integer('email_verified').notNull().default(0), avatarKey: text('avatar_key').notNull().default(''), avatarVersion: integer('avatar_version').notNull().default(0), planningCreate: integer("planning_create").notNull().default(0) }, table => [uniqueIndex('users_unique_email').on(table.email).where(sql`${table.email} <> ''`)]);
export const sessions = sqliteTable("sessions", { token: text("token").primaryKey(), userId: text("user_id").notNull(), expires: integer("expires").notNull() });
export const loginAttempts = sqliteTable("login_attempts", { key: text("key").primaryKey(), count: integer("count").notNull(), window: integer("window").notNull() });
export const machineDocuments = sqliteTable('machine_documents', {
  id: text('id').primaryKey(),
  machine: text('machine').notNull(),
  site: text('site').notNull(),
  name: text('name').notNull(),
  objectKey: text('object_key').notNull().unique(),
  size: integer('size').notNull(),
  actor: text('actor').notNull(),
  created: text('created').notNull(),
});
export const interventionForm = sqliteTable('intervention_form', {
 id:text('id').primaryKey(),version:integer('version').notNull(),questions:text('questions').notNull(),
});
export const interventions = sqliteTable('interventions', {
 id:text('id').primaryKey(),site:text('site').notNull(),created:text('created').notNull(),actor:text('actor').notNull(),
 revision:integer('revision').notNull().default(1),lastEdit:text('last_edit'),updatedAt:text('updated_at'),updatedBy:text('updated_by'),machineService:text('machine_service'),waitingNote:text('waiting_note').notNull().default(''),waitingOrder:text('waiting_order'),
 authorId:text('author_id'),deleted:integer('deleted').notNull().default(0),deletedBy:text('deleted_by'),deletedAt:text('deleted_at'),
 date:text('date').notNull(),duration:integer('duration'),answers:text('answers').notNull(),questions:text('questions').notNull(),source:text('source').notNull(),
}, table=>[index('interventions_site_date').on(table.site,table.date)]);
export const interventionMachines = sqliteTable('intervention_machines', {
 id:text('id').primaryKey(),intervention:text('intervention').notNull(),machine:text('machine').notNull(),name:text('name').notNull(),
}, table=>[index('intervention_machines_lookup').on(table.machine,table.intervention)]);
export const interventionFiles = sqliteTable('intervention_files', {
 id:text('id').primaryKey(),intervention:text('intervention').notNull(),field:text('field').notNull(),site:text('site').notNull(),
 name:text('name').notNull(),mime:text('mime').notNull(),objectKey:text('object_key').notNull(),
});
export const interventionImports = sqliteTable('intervention_imports', {id:text('id').primaryKey()});
export const interventionParts = sqliteTable('intervention_parts', {
  id: text('id').primaryKey(),
  intervention: text('intervention').notNull(),
  part: text('part'),
  name: text('name').notNull(),
  reference: text('reference').notNull(),
  quantity: integer('quantity').notNull(),
}, table => [index('intervention_parts_report').on(table.intervention)]);
export const purchaseReceipts = sqliteTable('purchase_receipts', {
  order: text('order_id').primaryKey(),
  part: text('part').notNull(),
  site: text('site').notNull(),
  quantity: integer('quantity').notNull(),
  actor: text('actor').notNull(),
  created: text('created').notNull(),
});
export const orderDocuments = sqliteTable('order_documents', {
  id: text('id').primaryKey(),
  order: text('order_id').notNull(),
  site: text('site').notNull(),
  name: text('name').notNull(),
  objectKey: text('object_key').notNull().unique(),
  size: integer('size').notNull(),
  actor: text('actor').notNull(),
  created: text('created').notNull(),
}, table => [index('order_documents_order').on(table.order)]);

export const accountTokens = sqliteTable('account_tokens', {
 hash:text('hash').primaryKey(), context:text('context').notNull().default(''), userId:text('user_id').notNull(), purpose:text('purpose').notNull(),
 email:text('email').notNull(), fingerprint:text('fingerprint').notNull(), expires:integer('expires').notNull(), created:integer('created').notNull(),
});
export const emailOutbox = sqliteTable('email_outbox', {
 id:text('id').primaryKey(), userId:text('user_id').notNull(), recordId:text('record_id').notNull(), kind:text('kind').notNull(),
 occurrence:text('occurrence').notNull().default(''), email:text('email').notNull(), subject:text('subject').notNull(), body:text('body').notNull(),
 created:integer('created').notNull(), state:text('state').notNull().default('pending'), firstAttempt:integer('first_attempt').notNull().default(0),
 lease:integer('lease').notNull().default(0), providerId:text('provider_id'), replyTo:text('reply_to').notNull().default(''),
});

export const siteMailSettings=sqliteTable('site_mail_settings',{
 site:text('site').primaryKey(),senderEmail:text('sender_email').notNull().default(''),senderName:text('sender_name').notNull().default('Maintenance'),
 confirmed:integer('confirmed').notNull().default(0),revision:integer('revision').notNull().default(0),
});
export const quoteRequests=sqliteTable('quote_requests',{
 id:text('id').primaryKey(),userId:text('user_id').notNull(),site:text('site').notNull(),recipient:text('recipient').notNull(),
 subject:text('subject').notNull(),body:text('body').notNull(),senderEmail:text('sender_email').notNull(),senderName:text('sender_name').notNull(),
 created:integer('created').notNull(),state:text('state').notNull().default('pending'),revision:integer('revision').notNull().default(1),
 decidedBy:text('decided_by'),decidedAt:integer('decided_at'),orderData:text('order_data'),
});
export const mailConfiguration=sqliteTable('mail_configuration',{
 id:text('id').primaryKey(),cipher:text('cipher').notNull(),nonce:text('nonce').notNull(),
 sender:text('sender').notNull().default(''),revision:integer('revision').notNull().default(1),
});
export const mailOAuthStates=sqliteTable('mail_oauth_states',{
 hash:text('hash').primaryKey(),userId:text('user_id').notNull(),connectionId:text('connection_id').notNull(),
 revision:integer('revision').notNull(),verifier:text('verifier').notNull(),expires:integer('expires').notNull(),
});
export const mailDeliveries=sqliteTable('mail_deliveries',{
 id:text('id').primaryKey(),state:text('state').notNull(),providerId:text('provider_id'),created:integer('created').notNull(),
});
