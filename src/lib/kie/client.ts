import { getKieEnv } from "@/lib/kie/env";

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const MAX_RETRIES = 3;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithRetry = async (input: string, init: RequestInit, timeoutMs = 30_000): Promise<Response> => {
  let last: Response | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(input, { ...init, signal: controller.signal });
      last = response;
      if (response.ok || !RETRYABLE_STATUS.has(response.status) || attempt === MAX_RETRIES) {
        return response;
      }
    } finally {
      clearTimeout(timer);
    }
    await sleep(400 * 2 ** attempt);
  }
  if (!last) throw new Error("Kie request failed before a response was received.");
  return last;
};

type KieEnvelope<T> = {
  code?: number;
  msg?: string;
  data?: T;
};

export type KieTaskState = "waiting" | "queuing" | "generating" | "success" | "fail" | "unknown";

export type KieTaskRecord = {
  taskId: string;
  model?: string;
  state: KieTaskState;
  resultUrls: string[];
  failMsg?: string;
};

const authHeaders = (apiKey: string): HeadersInit => ({
  Authorization: `Bearer ${apiKey}`,
  "Content-Type": "application/json",
});

export const createKieTask = async (params: {
  model: string;
  input: Record<string, unknown>;
  callBackUrl?: string;
}): Promise<string> => {
  const { apiKey, baseUrl } = getKieEnv();
  const response = await fetchWithRetry(`${baseUrl}/api/v1/jobs/createTask`, {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify({
      model: params.model,
      input: params.input,
      ...(params.callBackUrl ? { callBackUrl: params.callBackUrl } : {}),
    }),
  });

  const text = await response.text();
  let parsed: KieEnvelope<{ taskId?: string }> | null = null;
  try {
    parsed = text ? (JSON.parse(text) as KieEnvelope<{ taskId?: string }>) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    throw new Error(parsed?.msg ?? `Kie createTask failed (HTTP ${response.status}).`);
  }
  const taskId = parsed?.data?.taskId;
  if (!taskId) {
    throw new Error(parsed?.msg ?? "Kie createTask returned no taskId.");
  }
  return taskId;
};

const extractResultUrls = (resultJson: unknown): string[] => {
  if (typeof resultJson !== "string" || !resultJson.trim()) return [];
  try {
    const parsed = JSON.parse(resultJson) as { resultUrls?: unknown };
    if (Array.isArray(parsed.resultUrls)) {
      return parsed.resultUrls.filter((url): url is string => typeof url === "string");
    }
  } catch {
    return [];
  }
  return [];
};

export const getKieTask = async (taskId: string): Promise<KieTaskRecord> => {
  const { apiKey, baseUrl } = getKieEnv();
  const response = await fetchWithRetry(
    `${baseUrl}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
    { method: "GET", headers: authHeaders(apiKey) },
  );

  const text = await response.text();
  let parsed: KieEnvelope<{
    taskId?: string;
    model?: string;
    state?: string;
    resultJson?: string;
    failMsg?: string;
  }> | null = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok || !parsed?.data) {
    throw new Error(parsed?.msg ?? `Kie recordInfo failed (HTTP ${response.status}).`);
  }

  const data = parsed.data;
  const state = (data.state ?? "unknown") as KieTaskState;
  return {
    taskId: data.taskId ?? taskId,
    model: data.model,
    state,
    resultUrls: extractResultUrls(data.resultJson),
    failMsg: data.failMsg,
  };
};

// Bounded server-side wait so fast models can return inline; otherwise the
// caller falls back to client polling via the task-status route.
export const waitForKieTask = async (taskId: string, budgetMs = 7_000): Promise<KieTaskRecord> => {
  const deadline = Date.now() + budgetMs;
  let record = await getKieTask(taskId);
  while (Date.now() < deadline && record.state !== "success" && record.state !== "fail") {
    await sleep(2_000);
    record = await getKieTask(taskId);
  }
  return record;
};
