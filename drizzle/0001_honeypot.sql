ALTER TABLE "guilds" ADD COLUMN "honeypot_channel_id" text;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "honeypot_delete_message_seconds" integer DEFAULT 3600 NOT NULL;