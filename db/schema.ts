import { pgTable, text, jsonb, integer, timestamp } from "drizzle-orm/pg-core";
import type { DataSet } from "../src/lib/types.js";

// One private workspace per Identity user; ownership is never accepted from clients.
export const workspaces = pgTable("workspaces", {
  userId: text("user_id").primaryKey(),
  data: jsonb("data").$type<DataSet>().notNull(),
  version: integer("version").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
