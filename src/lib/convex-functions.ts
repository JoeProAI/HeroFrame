import { makeFunctionReference } from "convex/server";

export const convexFunctions = {
  projects: {
    list: makeFunctionReference<"query">("projects:list"),
    upsert: makeFunctionReference<"mutation">("projects:upsert"),
  },
  workflows: {
    listByProject: makeFunctionReference<"query">("workflows:listByProject"),
    upsert: makeFunctionReference<"mutation">("workflows:upsert"),
  },
  runs: {
    listByProject: makeFunctionReference<"query">("runs:listByProject"),
    create: makeFunctionReference<"mutation">("runs:create"),
    markRunning: makeFunctionReference<"mutation">("runs:markRunning"),
    complete: makeFunctionReference<"mutation">("runs:complete"),
  },
  characters: {
    list: makeFunctionReference<"query">("characters:list"),
    listDeleted: makeFunctionReference<"query">("characters:listDeleted"),
    create: makeFunctionReference<"mutation">("characters:create"),
    softDelete: makeFunctionReference<"mutation">("characters:softDelete"),
    restore: makeFunctionReference<"mutation">("characters:restore"),
    purge: makeFunctionReference<"mutation">("characters:purge"),
  },
  generations: {
    listByOwner: makeFunctionReference<"query">("generations:listByOwner"),
    log: makeFunctionReference<"mutation">("generations:log"),
    clear: makeFunctionReference<"mutation">("generations:clear"),
  },
  storage: {
    persistFromUrl: makeFunctionReference<"action">("storage:persistFromUrl"),
    persistBase64: makeFunctionReference<"action">("storage:persistBase64"),
  },
};
