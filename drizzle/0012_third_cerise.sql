ALTER TABLE "guilds" ADD COLUMN "embeds_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "embeds_disabled_sites" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "embeds_ignored_channels" jsonb DEFAULT '[]'::jsonb NOT NULL;