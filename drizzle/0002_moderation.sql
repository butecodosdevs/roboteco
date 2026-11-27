CREATE TABLE "moderation_cases" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"number" integer NOT NULL,
	"action" text NOT NULL,
	"target_id" text NOT NULL,
	"moderator_id" text NOT NULL,
	"reason" text,
	"duration_seconds" integer,
	"log_channel_id" text,
	"log_message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "moderation_cases_guild_id_number_unique" UNIQUE("guild_id","number")
);
--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "moderation_log_channel_id" text;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "moderation_dm_users" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "moderation_case_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "moderation_cases_target_idx" ON "moderation_cases" USING btree ("guild_id","target_id");