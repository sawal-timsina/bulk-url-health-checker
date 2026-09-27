import { type InferEnum, type InferInsertModel, type InferSelectModel, sql } from "drizzle-orm";
import { check, index, integer, pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

export const batchStatusEnum = pgEnum("batch_status", ["pending", "running", "completed", "cancelled"]);

export const batches = pgTable(
  "batches",
  {
    id: uuid("id").primaryKey(),

    status: batchStatusEnum("status").notNull().default("pending"),

    totalCount: integer("total_count").notNull(),

    completedCount: integer("completed_count").notNull().default(0),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    batchesTotalCountCheck: check("batches_total_count_check", sql`${table.totalCount} >= 0`),
    batchesCompletedCountCheck: check(
      "batches_completed_count_check",
      sql`${table.completedCount} >= 0 AND ${table.completedCount} <= ${table.totalCount}`,
    ),
    batchesCreatedAtIdx: index("idx_batches_created_at").on(sql`${table.createdAt} DESC`),
  }),
);

export type Batch = InferSelectModel<typeof batches>;
export type NewBatch = InferInsertModel<typeof batches>;
export type BatchStatus = InferEnum<typeof batchStatusEnum>;
