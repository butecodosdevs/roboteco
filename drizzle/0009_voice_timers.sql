ALTER TABLE "temp_voice_channels" ADD COLUMN "close_job_id" integer;--> statement-breakpoint
ALTER TABLE "temp_voice_channels" ADD COLUMN "close_reason" text;--> statement-breakpoint
ALTER TABLE "temp_voice_hubs" ADD COLUMN "empty_timeout_seconds" integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "temp_voice_hubs" ADD COLUMN "idle_timeout_seconds" integer DEFAULT 600 NOT NULL;