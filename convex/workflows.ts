import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

const query = queryGeneric;
const mutation = mutationGeneric;

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("workflows")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const upsert = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    key: v.string(),
    version: v.number(),
    steps: v.array(
      v.object({
        id: v.string(),
        label: v.string(),
        kind: v.union(
          v.literal("brief"),
          v.literal("prompt"),
          v.literal("asset"),
          v.literal("voice"),
          v.literal("render"),
          v.literal("review"),
        ),
        required: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const existing = (await ctx.db
      .query("workflows")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect())
      .filter((workflow) => workflow.key === args.key)
      .at(0);

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        version: args.version,
        steps: args.steps,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("workflows", {
      projectId: args.projectId,
      name: args.name,
      key: args.key,
      version: args.version,
      steps: args.steps,
      createdAt: now,
      updatedAt: now,
    });
  },
});
