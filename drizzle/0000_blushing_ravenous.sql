CREATE TABLE "guilds" (
	"id" text PRIMARY KEY NOT NULL,
	"locale" text DEFAULT 'en-US' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
