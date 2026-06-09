export type KieMode = "image" | "image-edit" | "video";
export type KieSpeed = "fast" | "balanced" | "quality";

// Model ids are passed straight to Kie's unified `model` field.
// Swapping a model never requires touching the client or routes.
const imageModels: Record<KieSpeed, string> = {
  fast: "google/nano-banana",
  balanced: "gpt-image-2-text-to-image",
  quality: "gpt-image-2-text-to-image",
};

// All edit/character-reference work uses gpt-image-2-image-to-image so the
// `input_urls` reference contract stays consistent across speeds.
const imageEditModels: Record<KieSpeed, string> = {
  fast: "gpt-image-2-image-to-image",
  balanced: "gpt-image-2-image-to-image",
  quality: "gpt-image-2-image-to-image",
};

// Image-to-video. v1-pro takes input.image_url + prompt + resolution + duration.
const videoModels: Record<KieSpeed, string> = {
  fast: "bytedance/v1-pro-fast-image-to-video",
  balanced: "bytedance/v1-pro-image-to-video",
  quality: "bytedance/v1-pro-image-to-video",
};

export const resolveKieModel = (mode: KieMode, speed: KieSpeed = "balanced"): string => {
  if (mode === "image-edit") return imageEditModels[speed];
  if (mode === "video") return videoModels[speed];
  return imageModels[speed];
};

export type ModelOption = { id: string; label: string };

// Curated catalog. Each list shares the param contract its mode uses
// (image/edit: prompt [+ input_urls]; video: prompt + image_url). Only ids
// confirmed against the Kie docs/live API are included so nothing silently fails.
export const modelCatalog: Record<KieMode, ModelOption[]> = {
  image: [
    { id: "gpt-image-2-text-to-image", label: "GPT Image-2" },
    { id: "google/nano-banana", label: "Nano Banana (fast)" },
    { id: "google/nano-banana-pro", label: "Nano Banana Pro" },
    { id: "grok-imagine/text-to-image", label: "Grok Imagine" },
    { id: "qwen2/text-to-image", label: "Qwen2" },
    { id: "seedream-v4-text-to-image", label: "Seedream 4" },
  ],
  "image-edit": [
    { id: "gpt-image-2-image-to-image", label: "GPT Image-2 (reference)" },
    { id: "grok-imagine/image-to-image", label: "Grok Imagine (reference)" },
    { id: "google/nano-banana-edit", label: "Nano Banana Edit (fast)" },
  ],
  video: [
    { id: "bytedance/v1-pro-fast-image-to-video", label: "Seedance V1 Pro Fast" },
    { id: "bytedance/v1-pro-image-to-video", label: "Seedance V1 Pro" },
    { id: "bytedance/v1-lite-image-to-video", label: "Seedance V1 Lite" },
  ],
};

export const defaultModel: Record<KieMode, string> = {
  image: "gpt-image-2-text-to-image",
  "image-edit": "gpt-image-2-image-to-image",
  video: "bytedance/v1-pro-fast-image-to-video",
};
