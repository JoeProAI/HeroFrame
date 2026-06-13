import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

const query = queryGeneric;
const mutation = mutationGeneric;

export const list = query({
  args: { ownerId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("characters")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
      .order("desc")
      .collect();
    return rows.filter((c) => !c.deletedAt);
  },
});

export const listDeleted = query({
  args: { ownerId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("characters")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
      .order("desc")
      .collect();
    return rows.filter((c) => c.deletedAt);
  },
});

export const create = mutation({
  args: {
    ownerId: v.string(),
    name: v.string(),
    referenceUrl: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("characters", {
      ownerId: args.ownerId,
      name: args.name,
      referenceUrl: args.referenceUrl,
      notes: args.notes,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Soft delete: keeps the row so it can be restored from the recycle bin.
export const softDelete = mutation({
  args: { id: v.id("characters") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { deletedAt: Date.now(), updatedAt: Date.now() });
  },
});

export const restore = mutation({
  args: { id: v.id("characters") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { deletedAt: undefined, updatedAt: Date.now() });
  },
});

export const purge = mutation({
  args: { id: v.id("characters") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
