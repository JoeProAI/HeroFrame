export type CreativeMode = "image" | "video" | "audio";

export type SpeedTier = "fast" | "balanced" | "quality";

export type BudgetTier = "low" | "medium" | "high";

export type WaveSpeedStrategy = {
  speed?: SpeedTier;
  budget?: BudgetTier;
  async?: boolean;
};

export type WaveSpeedOrchestrateRequest = {
  runId?: string;
  mode: CreativeMode;
  prompt: string;
  styleHint?: string;
  negativePrompt?: string;
  inputUrls?: string[];
  modelPath?: string;
  strategy?: WaveSpeedStrategy;
};

export type WaveSpeedJobStatus = "queued" | "running" | "succeeded" | "failed" | "unknown";

export type WaveSpeedWebhookEvent = {
  id?: string;
  status?: string;
  output?: unknown;
  data?: unknown;
  metadata?: {
    runId?: string;
    fingerprint?: string;
  };
};
