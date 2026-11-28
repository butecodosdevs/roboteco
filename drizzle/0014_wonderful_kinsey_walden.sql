CREATE TABLE "reaction_roles" (
	"message_id" text NOT NULL,
	"emoji" text NOT NULL,
	"guild_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"role_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reaction_roles_message_id_emoji_pk" PRIMARY KEY("message_id","emoji")
);
--> statement-breakpoint
CREATE INDEX "reaction_roles_guild_idx" ON "reaction_roles" USING btree ("guild_id");