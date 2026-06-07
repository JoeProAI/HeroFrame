import { env } from "@/lib/env";

const hasValue = (value: string): boolean => value.trim().length > 0;

export const validateClientEnv = (): string[] => {
  const missing: string[] = [];
  if (!hasValue(env.convexUrl)) missing.push("NEXT_PUBLIC_CONVEX_URL");
  if (!hasValue(env.firebaseApiKey)) missing.push("NEXT_PUBLIC_FIREBASE_API_KEY");
  if (!hasValue(env.firebaseAuthDomain)) missing.push("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
  if (!hasValue(env.firebaseProjectId)) missing.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  if (!hasValue(env.firebaseAppId)) missing.push("NEXT_PUBLIC_FIREBASE_APP_ID");
  return missing;
};
