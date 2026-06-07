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
};
