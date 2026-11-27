CREATE TABLE "birthdays" (
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"month" smallint NOT NULL,
	"day" smallint NOT NULL,
	CONSTRAINT "birthdays_guild_id_user_id_pk" PRIMARY KEY("guild_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "counting_channels" (
	"guild_id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"current" integer DEFAULT 0 NOT NULL,
	"last_user_id" text,
	"record" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_commands" (
	"guild_id" text NOT NULL,
	"name" text NOT NULL,
	"response" text NOT NULL,
	"description" text NOT NULL,
	"command_id" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "custom_commands_guild_id_name_pk" PRIMARY KEY("guild_id","name")
);
--> statement-breakpoint
CREATE TABLE "feeds" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"seen_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"failures" integer DEFAULT 0 NOT NULL,
	"last_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "giveaway_entries" (
	"giveaway_id" integer NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "giveaway_entries_giveaway_id_user_id_pk" PRIMARY KEY("giveaway_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "giveaways" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"message_id" text,
	"host_id" text NOT NULL,
	"prize" text NOT NULL,
	"winners_count" integer NOT NULL,
	"winner_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"job_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invite_joins" (
	"guild_id" text NOT NULL,
	"member_id" text NOT NULL,
	"inviter_id" text,
	"code" text,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone,
	CONSTRAINT "invite_joins_guild_id_member_id_pk" PRIMARY KEY("guild_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "scheduled_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"content" text NOT NULL,
	"repeat" text DEFAULT 'none' NOT NULL,
	"next_run_at" timestamp with time zone NOT NULL,
	"job_id" integer,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "temp_bans" (
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"job_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "temp_bans_guild_id_user_id_pk" PRIMARY KEY("guild_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "escalation_warnings" integer;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "escalation_action" text;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "escalation_duration_seconds" integer;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "warn_expiry_days" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "verification_role_id" text;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "verification_min_account_age_days" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "antiraid_joins" integer;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "antiraid_seconds" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "antiraid_locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "antiraid_previous_level" integer;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "birthday_channel_id" text;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "birthday_role_id" text;--> statement-breakpoint
ALTER TABLE "giveaway_entries" ADD CONSTRAINT "giveaway_entries_giveaway_id_giveaways_id_fk" FOREIGN KEY ("giveaway_id") REFERENCES "public"."giveaways"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "birthdays_date_idx" ON "birthdays" USING btree ("month","day");--> statement-breakpoint
CREATE INDEX "invite_joins_inviter_idx" ON "invite_joins" USING btree ("guild_id","inviter_id");