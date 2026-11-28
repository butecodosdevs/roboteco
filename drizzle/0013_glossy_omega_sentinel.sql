CREATE TABLE "plugin_kv" (
	"plugin_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plugin_kv_plugin_id_guild_id_key_pk" PRIMARY KEY("plugin_id","guild_id","key")
);
--> statement-breakpoint
CREATE TABLE "plugin_messages" (
	"message_id" text PRIMARY KEY NOT NULL,
	"plugin_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "plugin_messages_guild_idx" ON "plugin_messages" USING btree ("guild_id");