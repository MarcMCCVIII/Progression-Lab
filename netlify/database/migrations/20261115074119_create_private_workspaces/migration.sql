CREATE TABLE "workspaces" (
	"user_id" text PRIMARY KEY,
	"data" jsonb NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
