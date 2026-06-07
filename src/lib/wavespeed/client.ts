import { getWaveSpeedAuthHeaders } from "@/lib/wavespeed/auth";
import { wavespeedEnv } from "@/lib/wavespeed/env";

const MAX_RETRIES = 3;
const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const withTimeout = async (input: RequestInfo | URL, init: RequestInit, timeoutMs: number) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

export const callWaveSpeed = async ({
  modelPath,
  payload,
  webhookUrl,
}: {
  modelPath: string;
  payload: Record<string, unknown>;
  webhookUrl?: string;
}) => {
  const base = wavespeedEnv.baseUrl.replace(/\/$/, "");
  const path = modelPath.startsWith("/") ? modelPath : `/${modelPath}`;
  const endpoint = new URL(`${base}${path}`);
  if (webhookUrl) {
    endpoint.searchParams.set("webhook", webhookUrl);
  }

  const headers = getWaveSpeedAuthHeaders(wavespeedEnv.apiKey);

  let lastResponse: Response | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const response = await withTimeout(
      endpoint.toString(),
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      },
      45_000,
    );

    lastResponse = response;
    if (response.ok) {
      return response;
    }
    if (!RETRYABLE_STATUS.has(response.status) || attempt === MAX_RETRIES) {
      return response;
    }

    const backoff = 400 * 2 ** attempt;
    await sleep(backoff);
  }

  if (!lastResponse) {
    throw new Error("WaveSpeed request failed before receiving a response.");
  }
  return lastResponse;
};
