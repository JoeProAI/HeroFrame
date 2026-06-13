import { hfFetch } from "@/lib/hf-client";

// Client-side helper: kicks off a Kie generation through our own API routes
// and resolves once the frame is ready (or throws on failure/timeout).

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
};

type GenerateResponse = {
  ok?: boolean;
  error?: string;
  taskId?: string;
  state?: string;
  resultUrl?: string;
  failMsg?: string;
};

type TaskResponse = {
  ok?: boolean;
  state?: string;
  resultUrl?: string;
  failMsg?: string;
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

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

  // image-to-image (character-locked scenes) can run several minutes.
  const deadline = Date.now() + 300_000;
  while (Date.now() < deadline) {
    await sleep(3_000);
    try {
      const taskResponse = await hfFetch(`/api/kie/task?taskId=${encodeURIComponent(taskId)}`);
      const task = (await taskResponse.json().catch(() => null)) as TaskResponse | null;
      if (!taskResponse.ok || !task?.ok) continue;
      if (task.state === "success") {
        if (!task.resultUrl) throw new Error("Task finished without a result URL.");
        return task.resultUrl;
      }
      if (task.state === "fail") throw new Error(task.failMsg ?? "Generation failed.");
      params.onProgress?.(task.state ?? "working");
    } catch (error) {
      if (error instanceof Error && error.message.includes("result URL")) throw error;
      // otherwise transient; keep polling
    }
  }
  throw new Error("Timed out waiting for the frame.");
};
