CREATE TYPE "public"."batch_status" AS ENUM('pending', 'running', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."url_status" AS ENUM('queued', 'processing', 'success', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "batches"
(
    "id"              uuid PRIMARY KEY                           NOT NULL,
    "status"          "batch_status"           DEFAULT 'pending' NOT NULL,
    "total_count"     integer                                    NOT NULL,
    "completed_count" integer                  DEFAULT 0         NOT NULL,
    "created_at"      timestamp with time zone DEFAULT now()     NOT NULL,
    "updated_at"      timestamp with time zone DEFAULT now()     NOT NULL
);
--> statement-breakpoint
CREATE TABLE "urls"
(
    "id"               uuid PRIMARY KEY                          NOT NULL,
    "batch_id"         uuid                                      NOT NULL,
    "url"              text                                      NOT NULL,
    "status"           "url_status"             DEFAULT 'queued' NOT NULL,
    "http_status"      integer,
    "response_time_ms" integer,
    "title"            text,
    "error"            text,
    "attempts"         integer                  DEFAULT 0        NOT NULL,
    "created_at"       timestamp with time zone DEFAULT now()    NOT NULL,
    "started_at"       timestamp with time zone,
    "completed_at"     timestamp with time zone,
    "updated_at"       timestamp with time zone DEFAULT now()    NOT NULL,
    CONSTRAINT "urls_batch_url_unique" UNIQUE ("batch_id", "url")
);
--> statement-breakpoint
ALTER TABLE "urls"
    ADD CONSTRAINT "urls_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches" ("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "urls_batch_id_idx" ON "urls" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "urls_batch_status_idx" ON "urls" USING btree ("batch_id","status");