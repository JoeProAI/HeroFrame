import { env } from "@/lib/env";

const hasValue = (value: string): boolean => value.trim().length > 0;

export const validateClientEnv = (): string[] => {
  const missing: string[] = [];
  if (!hasValue(env.convexUrl)) missing.push("NEXT_PUBLIC_CONVEX_URL");
  if (!hasValue(env.firebaseApiKey)) missing.push("NEXT_PUBLIC_FIREBASE_API_KEY");
  if (!hasValue(env.firebaseAuthDomain)) missing.push("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
  if (!hasValue(env.firebaseProjectId)) missing.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  if (!hasValue(env.firebaseStorageBucket)) missing.push("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
  if (!hasValue(env.firebaseMessagingSenderId)) {
    missing.push("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID");
  }
  if (!hasValue(env.firebaseAppId)) missing.push("NEXT_PUBLIC_FIREBASE_APP_ID");
  return missing;
};
