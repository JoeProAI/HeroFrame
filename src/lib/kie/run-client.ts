import { hfFetch } from "@/lib/hf-client";

export type RunKieParams = {
  prompt: string;
  styleHint?: string;
  speed?: "fast" | "balanced" | "quality";
  mode?: "image" | "image-edit" | "video";
  model?: string;
  imageUrls?: string[];
  resolution?: string;
  duration?: string;
  input?: Record<string, unknown>;
  onProgress?: (state: string) => void;
  onTaskStarted?: (task: { taskId: string; model?: string; state?: string }) => void;
  timeoutMs?: number;
};

type GenerateResponse = {
  ok?: boolean;
  error?: string;
  model?: string;
  taskId?: string;
  state?: string;
  resultUrl?: string;
  failMsg?: string;
};

type TaskResponse = {
  ok?: boolean;
  taskId?: string;
  model?: string;
  state?: string;
  resultUrl?: string;
  failMsg?: string;
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export class KieGenerationTimeoutError extends Error {
  taskId: string;
  model?: string;
  state?: string;

  constructor(taskId: string, model?: string, state?: string) {
    super(`Kie task ${taskId} is still running. You can recover it from History when it finishes.`);
    this.name = "KieGenerationTimeoutError";
    this.taskId = taskId;
    this.model = model;
    this.state = state;
  }
}

export const runKieGeneration = async (params: RunKieParams): Promise<string> => {
  const response = await hfFetch("/api/kie/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: params.mode ?? "image",
      speed: params.speed ?? "balanced",
      model: params.model || undefined,
      prompt: params.prompt,
      styleHint: params.styleHint || undefined,
      imageUrls: params.imageUrls,
      resolution: params.resolution,
      duration: params.duration,
      input: params.input,
    }),
  });
  const payload = (await response.json().catch(() => null)) as GenerateResponse | null;
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error ?? `Kie request failed (HTTP ${response.status}).`);
  }
  if (payload.state === "fail") throw new Error(payload.failMsg ?? "Generation failed.");
  if (payload.resultUrl) return payload.resultUrl;

  const taskId = payload.taskId;
  if (!taskId) throw new Error("Kie returned no task id.");
  params.onTaskStarted?.({ taskId, model: payload.model, state: payload.state });

  // image-to-image (character-locked scenes) can run several minutes.
  const startedAt = Date.now();
  const deadline = startedAt + (params.timeoutMs ?? 900_000);
  let pollDelay = 2_000;
  let lastState = payload.state;
  while (Date.now() < deadline) {
    await sleep(pollDelay);
    try {
      const taskResponse = await hfFetch(`/api/kie/task?taskId=${encodeURIComponent(taskId)}`);
      const task = (await taskResponse.json().catch(() => null)) as TaskResponse | null;
      if (!taskResponse.ok || !task?.ok) continue;
      lastState = task.state;
      if (task.state === "success") {
        if (!task.resultUrl) throw new Error("Task finished without a result URL.");
        return task.resultUrl;
      }
      if (task.state === "fail") throw new Error(task.failMsg ?? "Generation failed.");
      params.onProgress?.(task.state ?? "working");
    } catch (error) {
      if (error instanceof Error && error.message.includes("result URL")) throw error;
    }
    const elapsed = Date.now() - startedAt;
    pollDelay = elapsed > 180_000 ? 10_000 : elapsed > 60_000 ? 5_000 : 2_000;
  }
  throw new KieGenerationTimeoutError(taskId, payload.model, lastState);
};
