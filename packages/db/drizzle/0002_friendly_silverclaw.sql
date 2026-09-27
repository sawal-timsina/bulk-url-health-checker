ALTER TABLE "batches" DROP CONSTRAINT "batches_completed_count_check";--> statement-breakpoint
ALTER TABLE "urls"
  ADD COLUMN "generation" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "batches"
  ADD CONSTRAINT "batches_completed_count_check" CHECK ("batches"."completed_count" >= 0 AND
                                                        "batches"."completed_count" <= "batches"."total_count");