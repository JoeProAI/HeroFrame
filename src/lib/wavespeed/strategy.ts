import { createHash } from "node:crypto";
import type {
  CreativeMode,
  SpeedTier,
  WaveSpeedOrchestrateRequest,
  WaveSpeedStrategy,
} from "@/types/wavespeed";

type ModelMap = Record<SpeedTier, string>;

const defaultModels: Record<CreativeMode, ModelMap> = {
  image: {
    fast: "/api/v3/wavespeed-ai/flux-dev",
    balanced: "/api/v3/wavespeed-ai/seedream-4",
    quality: "/api/v3/wavespeed-ai/flux-kontext-pro",
  },
  video: {
    fast: "/api/v3/wavespeed-ai/wan-2.7-t2v-fast",
    balanced: "/api/v3/wavespeed-ai/seedance-1-pro",
    quality: "/api/v3/wavespeed-ai/veo-3.1",
  },
  audio: {
    fast: "/api/v3/minimax/speech-02-hd",
    balanced: "/api/v3/elevenlabs/eleven-v3",
    quality: "/api/v3/openai/gpt-4o-mini-tts",
  },
};

const normalizeStrategy = (strategy: WaveSpeedStrategy | undefined) => {
  return {
    speed: strategy?.speed ?? "balanced",
    async: strategy?.async ?? true,
  };
};

export const resolveWaveSpeedModelPath = (request: WaveSpeedOrchestrateRequest): string => {
  if (request.modelPath?.trim()) {
    return request.modelPath.trim();
  }

  const strategy = normalizeStrategy(request.strategy);
  return defaultModels[request.mode][strategy.speed];
};

export const createPromptFingerprint = (request: WaveSpeedOrchestrateRequest): string => {
  const stableInput = JSON.stringify({
    runId: request.runId ?? "",
    mode: request.mode,
    prompt: request.prompt,
    styleHint: request.styleHint ?? "",
    negativePrompt: request.negativePrompt ?? "",
    inputUrls: request.inputUrls ?? [],
    modelPath: resolveWaveSpeedModelPath(request),
  });

  return createHash("sha256").update(stableInput).digest("hex");
};

export const buildWaveSpeedPayload = (request: WaveSpeedOrchestrateRequest): Record<string, unknown> => {
  return {
    prompt: request.prompt,
    ...(request.styleHint ? { style: request.styleHint } : {}),
    ...(request.negativePrompt ? { negative_prompt: request.negativePrompt } : {}),
    ...(request.inputUrls?.length ? { image_urls: request.inputUrls } : {}),
    metadata: {
      runId: request.runId,
      fingerprint: createPromptFingerprint(request),
    },
  };
};
