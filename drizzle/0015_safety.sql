ALTER TABLE "guilds" ADD COLUMN "safety_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "safety_timeout_minutes" integer;