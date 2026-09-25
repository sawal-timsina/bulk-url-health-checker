CREATE INDEX "idx_batches_created_at" ON "batches" USING btree ("created_at" DESC);--> statement-breakpoint
ALTER TABLE "batches"
    ADD CONSTRAINT "batches_total_count_check" CHECK ("batches"."total_count" >= 0);--> statement-breakpoint
ALTER TABLE "batches"
    ADD CONSTRAINT "batches_completed_count_check" CHECK ("batches"."completed_count" >= 0 AND
                                                          "batches"."completed_count" <= "batches"."completed_count");--> statement-breakpoint
ALTER TABLE "urls"
    ADD CONSTRAINT "urls_attempts_check" CHECK ("urls"."attempts" >= 0);--> statement-breakpoint
ALTER TABLE "urls"
    ADD CONSTRAINT "urls_response_time_check" CHECK ("urls"."response_time_ms" IS NULL OR "urls"."response_time_ms" >= 0);--> statement-breakpoint
ALTER TABLE "urls"
    ADD CONSTRAINT "urls_http_status_check" CHECK ("urls"."http_status" IS NULL OR "urls"."http_status" BETWEEN 100 AND 599);