import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  projects: defineTable({
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    ownerId: v.string(),
    status: v.union(v.literal("draft"), v.literal("active"), v.literal("archived")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_owner", ["ownerId"]),

  workflows: defineTable({
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
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_project", ["projectId"]),

  runs: defineTable({
    projectId: v.id("projects"),
    workflowId: v.id("workflows"),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("succeeded"),
      v.literal("failed"),
    ),
    triggeredBy: v.string(),
    input: v.object({
      title: v.string(),
      storyBeat: v.string(),
      styleHint: v.optional(v.string()),
    }),
    output: v.optional(
      v.object({
        promptPackUrl: v.optional(v.string()),
        shotList: v.array(v.string()),
        renderJobs: v.array(v.string()),
      }),
    ),
    startedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_workflow", ["workflowId"]),
});
