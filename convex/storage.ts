import { actionGeneric } from "convex/server";
import { v } from "convex/values";

// Fetch a (temporary) external URL, store the bytes in Convex file storage,
// and return a permanent Convex URL. Used so generated media survives after
// the provider's short-lived links expire.
export const persistFromUrl = actionGeneric({
  args: { url: v.string() },
  handler: async (ctx, args): Promise<string | null> => {
    try {
      const response = await fetch(args.url);
      if (!response.ok) return null;
      const blob = await response.blob();
      const storageId = await ctx.storage.store(blob);
      return await ctx.storage.getUrl(storageId);
    } catch {
      return null;
    }
  },
});
