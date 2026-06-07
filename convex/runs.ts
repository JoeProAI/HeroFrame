import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

const query = queryGeneric;
const mutation = mutationGeneric;

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("runs")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    workflowId: v.id("workflows"),
    triggeredBy: v.string(),
    input: v.object({
      title: v.string(),
      storyBeat: v.string(),
      styleHint: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("runs", {
      projectId: args.projectId,
      workflowId: args.workflowId,
      triggeredBy: args.triggeredBy,
      status: "queued",
      input: args.input,
      output: { shotList: [], renderJobs: [] },
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const markRunning = mutation({
  args: { runId: v.id("runs") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, {
      status: "running",
      startedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const complete = mutation({
  args: {
    runId: v.id("runs"),
    status: v.union(v.literal("succeeded"), v.literal("failed")),
    output: v.object({
      promptPackUrl: v.optional(v.string()),
      shotList: v.array(v.string()),
      renderJobs: v.array(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, {
      status: args.status,
      output: args.output,
      finishedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});
