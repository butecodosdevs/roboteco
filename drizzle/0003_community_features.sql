CREATE TABLE "level_rewards" (
	"guild_id" text NOT NULL,
	"level" integer NOT NULL,
	"role_id" text NOT NULL,
	CONSTRAINT "level_rewards_guild_id_level_pk" PRIMARY KEY("guild_id","level")
);
--> statement-breakpoint
CREATE TABLE "member_levels" (
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_levels_guild_id_user_id_pk" PRIMARY KEY("guild_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"guild_id" text,
	"channel_id" text,
	"text" text NOT NULL,
	"remind_at" timestamp with time zone NOT NULL,
	"job_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"reporter_id" text NOT NULL,
	"target_id" text NOT NULL,
	"channel_id" text,
	"message_id" text,
	"excerpt" text,
	"reason" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"handled_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"payload" jsonb NOT NULL,
	"run_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "self_roles" (
	"guild_id" text NOT NULL,
	"role_id" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "self_roles_guild_id_role_id_pk" PRIMARY KEY("guild_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "starboard_entries" (
	"message_id" text PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"starboard_message_id" text NOT NULL,
	"stars" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suggestion_votes" (
	"suggestion_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"value" smallint NOT NULL,
	CONSTRAINT "suggestion_votes_suggestion_id_user_id_pk" PRIMARY KEY("suggestion_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"author_id" text NOT NULL,
	"content" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"channel_id" text,
	"message_id" text,
	"decided_by" text,
	"decision_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"guild_id" text NOT NULL,
	"name" text NOT NULL,
	"content" text NOT NULL,
	"author_id" text NOT NULL,
	"uses" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tags_guild_id_name_pk" PRIMARY KEY("guild_id","name")
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"thread_id" text NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "suggestions_channel_id" text;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "reports_channel_id" text;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "tickets_staff_role_id" text;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "role_panel_channel_id" text;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "role_panel_message_id" text;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "level_up_announce" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "starboard_channel_id" text;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "starboard_threshold" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "welcome_channel_id" text;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "welcome_message" text;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "welcome_role_id" text;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "server_log_channel_id" text;--> statement-breakpoint
ALTER TABLE "suggestion_votes" ADD CONSTRAINT "suggestion_votes_suggestion_id_suggestions_id_fk" FOREIGN KEY ("suggestion_id") REFERENCES "public"."suggestions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "member_levels_xp_idx" ON "member_levels" USING btree ("guild_id","xp");--> statement-breakpoint
CREATE INDEX "reminders_user_idx" ON "reminders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "scheduled_jobs_run_at_idx" ON "scheduled_jobs" USING btree ("run_at");--> statement-breakpoint
CREATE INDEX "tickets_owner_idx" ON "tickets" USING btree ("guild_id","user_id");