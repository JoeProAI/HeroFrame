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
