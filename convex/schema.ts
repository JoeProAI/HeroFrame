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
          v.literal("design"),
        ),
        required: v.boolean(),
      }),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_project", ["projectId"]),

  characters: defineTable({
    ownerId: v.string(),
    name: v.string(),
    referenceUrl: v.string(),
    notes: v.optional(v.string()),
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_owner", ["ownerId"]),

  generations: defineTable({
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
    createdAt: v.number(),
  }).index("by_owner", ["ownerId"]),

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
