import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { env } from "@/lib/env";
import { validateClientEnv } from "@/lib/env-guards";

const firebaseConfig = {
  apiKey: env.firebaseApiKey,
  authDomain: env.firebaseAuthDomain,
  projectId: env.firebaseProjectId,
  appId: env.firebaseAppId,
};

const missingEnv = validateClientEnv();
if (missingEnv.length > 0) {
  throw new Error(`Missing environment variables: ${missingEnv.join(", ")}`);
}

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
