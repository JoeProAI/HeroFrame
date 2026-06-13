import { actionGeneric } from "convex/server";
import { v } from "convex/values";

// Fetch a (temporary) external URL, store the bytes in Convex file storage,
// and return a permanent Convex URL. Used so generated media survives after
// the provider's short-lived links expire.
// Store a base64 / data-URL upload directly in Convex storage (used for
// user-uploaded reference images — no third-party key needed).
export const persistBase64 = actionGeneric({
  args: { base64: v.string() },
  handler: async (ctx, args): Promise<string | null> => {
    try {
      const raw = args.base64;
      const comma = raw.indexOf(",");
      const meta = raw.startsWith("data:") && comma >= 0 ? raw.slice(5, comma) : "";
      const b64 = comma >= 0 ? raw.slice(comma + 1) : raw;
      const type = (meta.split(";")[0] || "image/png").trim();
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type });
      const storageId = await ctx.storage.store(blob);
      return await ctx.storage.getUrl(storageId);
    } catch {
      return null;
    }
  },
});

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
