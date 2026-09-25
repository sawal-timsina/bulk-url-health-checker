import { type InferInsertModel, type InferSelectModel, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { batches } from "./batches.js";

export const urlStatusEnum = pgEnum("url_status", [
  "queued",
  "processing",
  "success",
  "failed",
  "cancelled",
]);

export const urls = pgTable(
  "urls",
  {
    id: uuid("id").primaryKey(),

    batchId: uuid("batch_id")
      .notNull()
      .references(() => batches.id, {
        onDelete: "cascade",
      }),

    url: text("url").notNull(),

    status: urlStatusEnum("status").notNull().default("queued"),

    httpStatus: integer("http_status"),

    responseTimeMs: integer("response_time_ms"),

    title: text("title"),

    error: text("error"),

    attempts: integer("attempts").notNull().default(0),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    startedAt: timestamp("started_at", {
      withTimezone: true,
    }),

    completedAt: timestamp("completed_at", {
      withTimezone: true,
    }),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },

  (table) => ({
    urlsAttemptsCheck: check(
      "urls_attempts_check",
      sql`${table.attempts} >= 0`,
    ),
    urlsResponseTimeCheck: check(
      "urls_response_time_check",
      sql`${table.responseTimeMs} IS NULL OR ${table.responseTimeMs} >= 0`,
    ),
    urlsHttpStatusCheck: check(
      "urls_http_status_check",
      sql`${table.httpStatus} IS NULL OR ${table.httpStatus} BETWEEN 100 AND 599`,
    ),

    batchIdIdx: index("urls_batch_id_idx").on(table.batchId),

    batchStatusIdx: index("urls_batch_status_idx").on(
      table.batchId,
      table.status,
    ),

    batchUrlUnique: unique("urls_batch_url_unique").on(
      table.batchId,
      table.url,
    ),
  }),
);

export type Url = InferSelectModel<typeof urls>;
export type NewUrl = InferInsertModel<typeof urls>;
