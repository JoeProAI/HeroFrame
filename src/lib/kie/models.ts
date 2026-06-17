export type KieMode = "image" | "image-edit" | "video";
export type KieSpeed = "fast" | "balanced" | "quality";
type ModelFamily = "OpenAI" | "Google" | "Seedream" | "Flux" | "Grok" | "Qwen" | "Ideogram" | "Z-Image" | "Bytedance" | "Hailuo" | "Kling";

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

export type ModelOption = {
  id: string;
  label: string;
  family: ModelFamily;
  badge: "fast" | "balanced" | "quality" | "reference" | "cinematic";
  hint: string;
};

// Curated catalog. Each list shares the param contract its mode uses
// (image/edit: prompt [+ input_urls]; video: prompt + image_url). Only ids
// confirmed against the Kie docs/live API are included so nothing silently fails.
export const modelCatalog: Record<KieMode, ModelOption[]> = {
  image: [
    { id: "gpt-image-2-text-to-image", label: "GPT Image-2", family: "OpenAI", badge: "quality", hint: "General purpose image generation." },
    { id: "gpt-image/1.5-text-to-image", label: "GPT Image-1.5", family: "OpenAI", badge: "balanced", hint: "Solid prompt following with lower overhead." },
    { id: "google/nano-banana", label: "Nano Banana", family: "Google", badge: "fast", hint: "Fast ideation and character-ish prompts." },
    { id: "nano-banana-2", label: "Nano Banana 2", family: "Google", badge: "fast", hint: "Newer Google image model with strong text handling." },
    { id: "google/nano-banana-pro", label: "Nano Banana Pro", family: "Google", badge: "quality", hint: "Higher fidelity Google image generation." },
    { id: "grok-imagine/text-to-image", label: "Grok Imagine", family: "Grok", badge: "fast", hint: "Energetic stylized image drafts." },
    { id: "qwen2/text-to-image", label: "Qwen2", family: "Qwen", badge: "balanced", hint: "Good multilingual and design text handling." },
    { id: "seedream-v4-text-to-image", label: "Seedream 4", family: "Seedream", badge: "balanced", hint: "Clean commercial-style imagery." },
    { id: "seedream/4.5-text-to-image", label: "Seedream 4.5", family: "Seedream", badge: "quality", hint: "Photorealistic, higher-detail scenes." },
    { id: "seedream/5-lite-text-to-image", label: "Seedream 5 Lite", family: "Seedream", badge: "fast", hint: "Newer fast Seedream option." },
    { id: "ideogram/v3-text-to-image", label: "Ideogram V3", family: "Ideogram", badge: "quality", hint: "Graphic layouts and poster-style prompts." },
    { id: "flux-2/flex-text-to-image", label: "Flux 2 Flex", family: "Flux", badge: "balanced", hint: "Detailed composition control." },
    { id: "flux-2/pro-text-to-image", label: "Flux 2 Pro", family: "Flux", badge: "quality", hint: "Sharper Flux output for finished frames." },
    { id: "google/imagen4-fast", label: "Imagen 4 Fast", family: "Google", badge: "fast", hint: "Quick Google image drafts." },
    { id: "google/imagen4", label: "Imagen 4", family: "Google", badge: "balanced", hint: "Balanced Google image generation." },
    { id: "google/imagen4-ultra", label: "Imagen 4 Ultra", family: "Google", badge: "quality", hint: "Highest-quality Imagen option." },
    { id: "z-image", label: "Z-Image", family: "Z-Image", badge: "balanced", hint: "Photorealistic and design-forward images." },
  ],
  "image-edit": [
    { id: "gpt-image-2-image-to-image", label: "GPT Image-2 Reference", family: "OpenAI", badge: "reference", hint: "Best default for reusable character references." },
    { id: "gpt-image/1.5-image-to-image", label: "GPT Image-1.5 Reference", family: "OpenAI", badge: "reference", hint: "Reference edits with lower overhead." },
    { id: "grok-imagine/image-to-image", label: "Grok Imagine Reference", family: "Grok", badge: "fast", hint: "Stylized reference-driven variations." },
    { id: "google/nano-banana-edit", label: "Nano Banana Edit", family: "Google", badge: "fast", hint: "Fast Google image edits." },
    { id: "seedream/4.5-edit", label: "Seedream 4.5 Edit", family: "Seedream", badge: "quality", hint: "Polished image edits and transformations." },
    { id: "seedream/5-lite-image-to-image", label: "Seedream 5 Lite Reference", family: "Seedream", badge: "fast", hint: "Fast newer reference image generation." },
    { id: "qwen/image-edit", label: "Qwen Image Edit", family: "Qwen", badge: "reference", hint: "Precise single-reference edits and text changes." },
  ],
  video: [
    { id: "bytedance/v1-pro-fast-image-to-video", label: "Seedance V1 Pro Fast", family: "Bytedance", badge: "fast", hint: "Fast image-to-video default." },
    { id: "bytedance/v1-pro-image-to-video", label: "Seedance V1 Pro", family: "Bytedance", badge: "balanced", hint: "Balanced image animation." },
    { id: "bytedance/v1-lite-image-to-video", label: "Seedance V1 Lite", family: "Bytedance", badge: "fast", hint: "Lower-cost quick clips." },
    { id: "bytedance/seedance-2-fast", label: "Seedance 2.0 Fast", family: "Bytedance", badge: "fast", hint: "Newer fast Seedance with first-frame animation." },
    { id: "hailuo/2-3-image-to-video-standard", label: "Hailuo 2.3 Standard", family: "Hailuo", badge: "balanced", hint: "Cinematic motion with standard quality." },
    { id: "hailuo/2-3-image-to-video-pro", label: "Hailuo 2.3 Pro", family: "Hailuo", badge: "quality", hint: "Higher-quality Hailuo animation." },
    { id: "kling-2.6/image-to-video", label: "Kling 2.6", family: "Kling", badge: "cinematic", hint: "Cinematic image animation, optional sound disabled." },
    { id: "grok-imagine/image-to-video", label: "Grok Imagine Video", family: "Grok", badge: "fast", hint: "Fast stylized image-to-video clips." },
  ],
};

export const defaultModel: Record<KieMode, string> = {
  image: "gpt-image-2-text-to-image",
  "image-edit": "gpt-image-2-image-to-image",
  video: "bytedance/v1-pro-fast-image-to-video",
};

// Pipeline model ids for the specialized flows (lipsync, consistency, upscale).
// Verified against the Kie market docs.
export const pipelineModels = {
  tts: "elevenlabs/text-to-speech-turbo-2-5",
  lipsync: "infinitalk/from-audio",
  characterImage: "ideogram/character",
  imageUpscale: "topaz/image-upscale",
  videoUpscale: "topaz/video-upscale",
} as const;

// Curated subset of ElevenLabs voices (id -> friendly label).
export const ttsVoices: { id: string; label: string }[] = [
  { id: "EkK5I93UQWFDigLMpZcX", label: "James — Bold" },
  { id: "nPczCjzI2devNBz1zQrb", label: "Brian — Deep" },
  { id: "FGY2WhTYpPnrIDTdsKH5", label: "Laura — Quirky" },
  { id: "pPdl9cQBQq4p6mRkZy2Z", label: "Emma — Upbeat" },
  { id: "DGzg6RaUqxGRTHSBjfgF", label: "Brock — Commanding" },
  { id: "TC0Zp7WVFzhA8zpTlRqV", label: "Aria — Sultry Villain" },
  { id: "PPzYpIqttlTYA83688JI", label: "Pirate Marshal" },
  { id: "8JVbfL6oEdmuxKn5DK2C", label: "Johnny — Narrator" },
];

export type TtsVoiceOption = {
  id: string;
  label: string;
  tone: string;
  source: "built-in" | "elevenlabs";
  previewUrl?: string;
};

export const expandedTtsVoices: TtsVoiceOption[] = [
  { id: "21m00Tcm4TlvDq8ikWAM", label: "Rachel", tone: "Calm storyteller", source: "built-in" },
  { id: "AZnzlk1XvdvUeBnXmlld", label: "Domi", tone: "Confident lead", source: "built-in" },
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Bella", tone: "Warm and polished", source: "built-in" },
  { id: "ErXwobaYiN019PkySvjV", label: "Antoni", tone: "Conversational", source: "built-in" },
  { id: "MF3mGyEYCl7XYWbV9V6O", label: "Elli", tone: "Young and animated", source: "built-in" },
  { id: "TxGEqnHWrfWFTfGW9XjX", label: "Josh", tone: "Natural male", source: "built-in" },
  { id: "VR6AewLTigWG4xSOukaG", label: "Arnold", tone: "Action trailer", source: "built-in" },
  { id: "pNInz6obpgDQGcFmaJgB", label: "Adam", tone: "Deep narrator", source: "built-in" },
  { id: "yoZ06aMxZJJ28mfd3POQ", label: "Sam", tone: "Casual", source: "built-in" },
  { id: "2EiwWnXFnvU5JabPnv8n", label: "Clyde", tone: "Gruff character", source: "built-in" },
  { id: "IKne3meq5aSn9XLyUdCD", label: "Charlie", tone: "Friendly character", source: "built-in" },
  { id: "N2lVS1w4EtoT3dr4eOWO", label: "Callum", tone: "Dramatic", source: "built-in" },
  { id: "ODq5zmih8GrVes37Dizd", label: "Patrick", tone: "Mature narrator", source: "built-in" },
  { id: "SOYHLrjzK2X1ezoPC6cr", label: "Harry", tone: "Energetic", source: "built-in" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", label: "Liam", tone: "Clear young male", source: "built-in" },
  { id: "ThT5KcBeYPX3keUQqHPh", label: "Dorothy", tone: "Warm senior", source: "built-in" },
  { id: "XB0fDUnXU5powFXDhCwa", label: "Charlotte", tone: "Refined character", source: "built-in" },
  { id: "XrExE9yKIg1WjnnlVkGX", label: "Matilda", tone: "Expressive storyteller", source: "built-in" },
  { id: "Yko7PKHZNXotIFUBG7I9", label: "Matthew", tone: "Documentary", source: "built-in" },
  { id: "ZQe5CZNOzWyzPSCn5a3c", label: "James Classic", tone: "Classic narrator", source: "built-in" },
  { id: "Zlb1dXrM653N07WRdFW3", label: "Joseph", tone: "Calm male", source: "built-in" },
  { id: "piTKgcLEGmPE4e6mEKli", label: "Nicole", tone: "Soft-spoken", source: "built-in" },
  { id: "t0jbNlBVZ17f02VDIeMI", label: "Jessie", tone: "Animated character", source: "built-in" },
  { id: "g5CIjZEefAph4nQFvHAz", label: "Ethan", tone: "Grounded young male", source: "built-in" },
];

export const findModelOption = (mode: KieMode, id: string): ModelOption | undefined =>
  modelCatalog[mode].find((model) => model.id === id);

const singleImage = (imageUrls?: string[]): string | undefined => imageUrls?.find((url) => url.trim());

const numericDuration = (duration: string | undefined, fallback: number): number => {
  const parsed = Number(duration);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const buildKieModeInput = ({
  mode,
  model,
  prompt,
  imageUrls,
  imageSize,
  resolution,
  duration,
}: {
  mode: KieMode;
  model: string;
  prompt: string;
  imageUrls?: string[];
  imageSize?: string;
  resolution?: string;
  duration?: string;
}): Record<string, unknown> => {
  if (mode === "video") {
    const imageUrl = singleImage(imageUrls);
    if (model === "bytedance/seedance-2-fast") {
      return {
        prompt,
        ...(imageUrl ? { first_frame_url: imageUrl } : {}),
        return_last_frame: false,
        generate_audio: false,
        resolution: resolution ?? "720p",
        aspect_ratio: "16:9",
        duration: numericDuration(duration, 5),
      };
    }
    if (model.startsWith("hailuo/")) {
      return {
        prompt,
        ...(imageUrl ? { image_url: imageUrl } : {}),
        resolution: "768P",
        duration: duration ?? "6",
      };
    }
    if (model.startsWith("kling-")) {
      return {
        prompt,
        ...(imageUrl ? { image_urls: [imageUrl] } : {}),
        sound: false,
        duration: duration ?? "5",
      };
    }
    if (model === "grok-imagine/image-to-video") {
      return {
        prompt,
        ...(imageUrl ? { image_urls: [imageUrl] } : {}),
        mode: "normal",
        duration: duration ?? "6",
        resolution: resolution ?? "480p",
        aspect_ratio: "16:9",
      };
    }
    return {
      prompt,
      ...(imageUrl ? { image_url: imageUrl } : {}),
      resolution: resolution ?? "720p",
      duration: duration ?? "5",
    };
  }

  if (mode === "image-edit") {
    const refs = imageUrls?.filter((url) => url.trim()) ?? [];
    if (model.startsWith("seedream/")) {
      return { prompt, image_urls: refs, aspect_ratio: "1:1", quality: "basic", nsfw_checker: true };
    }
    if (model === "qwen/image-edit") {
      return { prompt, ...(refs[0] ? { image_url: refs[0] } : {}) };
    }
    if (model === "grok-imagine/image-to-image") {
      return { prompt, image_urls: refs };
    }
    return { prompt, input_urls: refs };
  }

  if (model === "nano-banana-2") {
    return { prompt, image_input: [], aspect_ratio: "auto", resolution: "1K", output_format: "png" };
  }
  if (model.startsWith("seedream/")) {
    return { prompt, aspect_ratio: "1:1", quality: "basic", nsfw_checker: false };
  }
  if (model === "z-image") {
    return { prompt, aspect_ratio: "1:1", nsfw_checker: true };
  }
  return {
    prompt,
    ...(imageSize ? { image_size: imageSize } : {}),
    ...(imageUrls?.length ? { input_urls: imageUrls } : {}),
  };
};
