/**
 * Delivery schema management.
 *
 * Stores the canonical expected output headers (uploaded from the official
 * UniHack Expected Output CSV). The header list, order, and count become
 * the single source of truth for every export.
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/** Returns the currently active delivery schema, if any. */
export const get = query({
  args: {},
  handler: async (ctx) => {
    const schemas = await ctx.db.query("deliverySchema").order("desc").collect();
    return schemas[0] ?? null;
  },
});

/** Upload (or replace) the delivery schema from a list of header strings. */
export const upload = mutation({
  args: {
    name: v.string(),
    headers: v.array(v.string()),
  },
  handler: async (ctx, { name, headers }) => {
    // Validate: no empty headers, no duplicates
    const trimmed = headers.map((h) => h.trim());
    if (trimmed.some((h) => h === "")) {
      throw new Error("Schema contains empty header names.");
    }
    const seen = new Set<string>();
    for (const h of trimmed) {
      if (seen.has(h)) {
        throw new Error(`Duplicate header: "${h}"`);
      }
      seen.add(h);
    }

    // Delete any existing schemas (we keep only the latest)
    const existing = await ctx.db.query("deliverySchema").collect();
    for (const doc of existing) {
      await ctx.db.delete(doc._id);
    }

    const id = await ctx.db.insert("deliverySchema", {
      name,
      headers: trimmed,
      headerCount: trimmed.length,
      createdAt: Date.now(),
    });
    return { id, headerCount: trimmed.length };
  },
});

/** Delete the current delivery schema. */
export const clear = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("deliverySchema").collect();
    for (const doc of existing) {
      await ctx.db.delete(doc._id);
    }
    return { deleted: existing.length };
  },
});
