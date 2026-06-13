import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

const query = queryGeneric;
const mutation = mutationGeneric;

export const listByOwner = query({
  args: { ownerId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("generations")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
      .order("desc")
      .take(200);
  },
});

// Log every generation — success OR failure — so nothing is ever lost.
export const log = mutation({
  args: {
    ownerId: v.string(),
    kind: v.union(
      v.literal("reference"),
      v.literal("scene"),
      v.literal("variation"),
      v.literal("fight"),
      v.literal("video"),
      v.literal("adhoc"),
    ),
    status: v.union(v.literal("succeeded"), v.literal("failed")),
    prompt: v.string(),
    model: v.optional(v.string()),
    url: v.optional(v.string()),
    type: v.optional(v.union(v.literal("image"), v.literal("video"))),
    characterName: v.optional(v.string()),
    shot: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("generations", { ...args, createdAt: Date.now() });
  },
});

export const clear = mutation({
  args: { ownerId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("generations")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
      .collect();
    await Promise.all(rows.map((r) => ctx.db.delete(r._id)));
  },
});
