import { createHmac } from "node:crypto";
import { getGhostEnv } from "@/lib/ghost/env";

const base64url = (input: Buffer | string): string =>
  Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

// Ghost Admin API keys are `id:secret` where secret is hex-encoded.
// Requests authenticate with a short-lived HS256 JWT (aud "/admin/").
const createAdminToken = (adminApiKey: string): string => {
  const [id, secret] = adminApiKey.split(":");
  if (!id || !secret) {
    throw new Error("Invalid GHOST_ADMIN_API_KEY format. Expected `id:secret`.");
  }

  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT", kid: id }));
  const iat = Math.floor(Date.now() / 1000);
  const payload = base64url(
    JSON.stringify({ iat, exp: iat + 300, aud: "/admin/" }),
  );

  const signature = base64url(
    createHmac("sha256", Buffer.from(secret, "hex")).update(`${header}.${payload}`).digest(),
  );

  return `${header}.${payload}.${signature}`;
};

export type GhostPublishInput = {
  title: string;
  html: string;
  status?: "draft" | "published";
  tags?: string[];
  excerpt?: string;
};

export type GhostPublishResult = {
  id: string;
  url: string;
  status: string;
};

export const publishGhostPost = async (input: GhostPublishInput): Promise<GhostPublishResult> => {
  const { apiUrl, adminApiKey } = getGhostEnv();
  const token = createAdminToken(adminApiKey);

  const endpoint = `${apiUrl}/ghost/api/admin/posts/?source=html`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Ghost ${token}`,
      "Content-Type": "application/json",
      "Accept-Version": "v5.0",
    },
    body: JSON.stringify({
      posts: [
        {
          title: input.title,
          html: input.html,
          status: input.status ?? "draft",
          custom_excerpt: input.excerpt,
          tags: input.tags?.map((name) => ({ name })),
        },
      ],
    }),
  });

  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text };
  }

  if (!response.ok) {
    const detail =
      typeof parsed === "object" && parsed !== null && "errors" in parsed
        ? JSON.stringify((parsed as { errors: unknown }).errors)
        : `HTTP ${response.status}`;
    throw new Error(`Ghost publish failed: ${detail}`);
  }

  const post = (parsed as { posts?: Array<{ id: string; url: string; status: string }> })?.posts?.at(0);
  if (!post) {
    throw new Error("Ghost publish returned no post.");
  }

  return { id: post.id, url: post.url, status: post.status };
};
