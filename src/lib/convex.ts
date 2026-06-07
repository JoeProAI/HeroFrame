import { ConvexHttpClient } from "convex/browser";
import { env } from "@/lib/env";

if (!env.convexUrl.trim()) {
  throw new Error("Missing environment variable: NEXT_PUBLIC_CONVEX_URL");
}

export const convexClient = new ConvexHttpClient(env.convexUrl);
