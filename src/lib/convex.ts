import { ConvexHttpClient } from "convex/browser";
import { env } from "@/lib/env";

export const getConvexClient = (): ConvexHttpClient => {
  if (!env.convexUrl.trim()) {
    throw new Error("Missing environment variable: NEXT_PUBLIC_CONVEX_URL");
  }
  return new ConvexHttpClient(env.convexUrl);
};
