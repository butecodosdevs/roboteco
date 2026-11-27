CREATE TABLE "drop_channels" (
	"channel_id" text PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"every" integer NOT NULL,
	"xp" integer NOT NULL,
	"lifetime_seconds" integer DEFAULT 60 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drop_claims" (
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"claims" integer DEFAULT 0 NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "drop_claims_guild_id_user_id_pk" PRIMARY KEY("guild_id","user_id")
);
--> statement-breakpoint
CREATE INDEX "drop_claims_rank_idx" ON "drop_claims" USING btree ("guild_id","claims");