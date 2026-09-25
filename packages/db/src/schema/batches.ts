import { integer, pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

export const batchStatusEnum = pgEnum("batch_status", [
  "pending",
  "running",
  "completed",
  "cancelled",
]);

export const batches = pgTable("batches", {
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
});
