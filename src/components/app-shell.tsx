"use client";

import { useEffect, useState } from "react";
import { KieGenerationTimeoutError, runKieGeneration } from "@/lib/kie/run-client";
import { useCharacters, type Character } from "@/lib/use-characters";
import { useStylePresets } from "@/lib/use-style-presets";
import { useFrames, type Frame } from "@/lib/use-frames";
import { buildFightShots, expandShots } from "@/lib/shots";
import { expandedTtsVoices, findModelOption, modelCatalog, defaultModel, pipelineModels, ttsVoices, type TtsVoiceOption } from "@/lib/kie/models";
import { hfFetch, getElevenLabsKey, getGlmKey, getKieKey, setElevenLabsKey, setGlmKey, setKieKey } from "@/lib/hf-client";

type Status = "idle" | "loading" | "success" | "error";
type Speed = "fast" | "balanced" | "quality";
type Tab = "studio" | "cast" | "scenes" | "fight" | "lipsync" | "frames" | "history";
type GenerationKind = "reference" | "scene" | "variation" | "fight" | "video" | "adhoc";
type BoardStatus = "idea" | "ready" | "rendering" | "done";
type BoardCard = {
  id: string;
  title: string;
  brief: string;
  prompt: string;
  modelHint: string;
  status: BoardStatus;
  createdAt: number;
};
type CoachMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: number;
  card?: Omit<BoardCard, "id" | "status" | "createdAt">;
};
type ImportedVoice = TtsVoiceOption & { category?: string };
type TaskLookupResponse = {
  ok?: boolean;
  error?: string;
  taskId?: string;
  model?: string;
  state?: string;
  resultUrl?: string;
  failMsg?: string;
};

const CUSTOM_VOICE_ID = "__custom__";
const BOARD_STORAGE = "heroframe.board";
const COACH_STORAGE = "heroframe.artCoach";

const panel = "rounded-2xl border border-[#2e2640] bg-[#181320]/70 backdrop-blur-sm";
const labelCls = "text-[11px] font-bold uppercase tracking-[0.16em] text-[#b3a7c4]";
const field =
  "min-h-11 w-full rounded-xl border border-[#2e2640] bg-[#0c0a12] px-3 text-sm text-[#fbf4e6] placeholder:text-[#6b6480] outline-none transition focus-visible:border-[#ffd23f] focus-visible:ring-1 focus-visible:ring-[#ffd23f]";
const btn =
  "inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-bold transition hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd23f] disabled:cursor-not-allowed disabled:opacity-40 disabled:translate-y-0";

const tabs: { id: Tab; label: string; dot: string }[] = [
  { id: "studio", label: "Studio", dot: "#ffd23f" },
  { id: "cast", label: "Cast", dot: "#8a5cff" },
  { id: "scenes", label: "Scenes", dot: "#ff5a3c" },
  { id: "fight", label: "Versus", dot: "#2ec4b6" },
  { id: "lipsync", label: "Lipsync", dot: "#ff8cc8" },
  { id: "frames", label: "Frames", dot: "#ffd23f" },
  { id: "history", label: "History", dot: "#9aa6bd" },
];

const tabGroups: { label: string; tabs: Tab[] }[] = [
  { label: "Plan", tabs: ["studio"] },
  { label: "Create", tabs: ["cast", "scenes", "fight", "lipsync"] },
  { label: "Review", tabs: ["frames", "history"] },
];

const speeds: Speed[] = ["fast", "balanced", "quality"];
const boardColumns: { id: BoardStatus; label: string; accent: string }[] = [
  { id: "idea", label: "Ideas", accent: "#ffd23f" },
  { id: "ready", label: "Ready", accent: "#8a5cff" },
  { id: "rendering", label: "Rendering", accent: "#ff5a3c" },
  { id: "done", label: "Done", accent: "#2ec4b6" },
];

const isVideoUrl = (url: string): boolean => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);

const makeId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `hf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

const parseBoardCards = (value: string | null): BoardCard[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is BoardCard => {
      if (!item || typeof item !== "object") return false;
      const card = item as Partial<BoardCard>;
      return typeof card.id === "string" && typeof card.title === "string" && typeof card.brief === "string" && typeof card.prompt === "string" && typeof card.modelHint === "string" && typeof card.createdAt === "number" && (card.status === "idea" || card.status === "ready" || card.status === "rendering" || card.status === "done");
    });
  } catch {
    return [];
  }
};

const parseCoachMessages = (value: string | null): CoachMessage[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is CoachMessage => {
      if (!item || typeof item !== "object") return false;
      const message = item as Partial<CoachMessage>;
      return typeof message.id === "string" && (message.role === "user" || message.role === "assistant") && typeof message.text === "string" && typeof message.createdAt === "number";
    });
  } catch {
    return [];
  }
};

const buildCoachReply = (input: string, activeHero?: string): CoachMessage => {
  const idea = input.trim();
  const lower = idea.toLowerCase();
  const isMotion = lower.includes("video") || lower.includes("animate") || lower.includes("motion") || lower.includes("clip");
  const isFight = lower.includes("fight") || lower.includes("versus") || lower.includes("battle");
  const imagePick = modelCatalog.image.find((model) => model.id === "seedream/4.5-text-to-image") ?? modelCatalog.image[0];
  const videoPick = modelCatalog.video.find((model) => model.id === "bytedance/seedance-2-fast") ?? modelCatalog.video[0];
  const editPick = modelCatalog["image-edit"].find((model) => model.id === "gpt-image-2-image-to-image") ?? modelCatalog["image-edit"][0];
  const model = isMotion ? videoPick : activeHero ? editPick : imagePick;
  const title = idea.split(/[.!?]/)[0]?.slice(0, 70) || "Cartoon scene idea";
  const prompt = [
    activeHero ? `Keep ${activeHero} visually consistent.` : "Original cartoon cast.",
    isFight ? "Stage it as a clear three-beat confrontation with readable silhouettes." : "Frame it as a production-ready cartoon key art scene.",
    idea,
    "Use bold shapes, readable emotion, strong pose language, and a background that supports the story beat.",
  ].join(" ");
  const text = [
    `Direction: ${isMotion ? "build a still first, then animate the strongest frame" : "start with a polished image frame"}.`,
    `Model lane: ${model.family} / ${model.label}.`,
    "Creative check: name the emotion, the camera angle, and the one prop or background detail that makes the shot memorable before generating.",
  ].join("\n");
  return {
    id: makeId(),
    role: "assistant",
    text,
    createdAt: Date.now(),
    card: {
      title,
      brief: isFight ? "Versus or action beat" : isMotion ? "Animation-ready shot" : "Cartoon key frame",
      prompt,
      modelHint: `${model.family} / ${model.label}`,
    },
  };
};

export const AppShell = () => {
  const { characters, deleted, activeCharacter, activeId, setActiveId, addCharacter, removeCharacter, restoreCharacter, purgeCharacter, loadDeleted } = useCharacters();
  const { presets, activePreset, activeId: presetId, setActiveId: setPresetId, addPreset } = useStylePresets();
  const { frames, history, addFrame, logGeneration, clearFrames } = useFrames();

  const [tab, setTab] = useState<Tab>("studio");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [speed, setSpeed] = useState<Speed>("balanced");
  const [credits, setCredits] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [kieKeyInput, setKieKeyInput] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [elevenLabsKeyInput, setElevenLabsKeyInput] = useState("");
  const [hasElevenLabsKey, setHasElevenLabsKey] = useState(false);
  const [glmKeyInput, setGlmKeyInput] = useState("");
  const [hasGlmKey, setHasGlmKey] = useState(false);
  const [importedVoices, setImportedVoices] = useState<ImportedVoice[]>([]);
  const [importingVoices, setImportingVoices] = useState(false);
  const [useIdeoChar, setUseIdeoChar] = useState(false);
  const [previewCharacter, setPreviewCharacter] = useState<Character | null>(null);
  const [showProductionSettings, setShowProductionSettings] = useState(false);
  const [coachLoading, setCoachLoading] = useState(false);

  // Lipsync pipeline
  const [lipImageId, setLipImageId] = useState<string>("");
  const [lipText, setLipText] = useState("");
  const [lipVoice, setLipVoice] = useState<string>(ttsVoices[0].id);
  const [customVoiceId, setCustomVoiceId] = useState("");
  const [lipRes, setLipRes] = useState<"480p" | "720p">("480p");

  // Model selection per mode
  const [imageModel, setImageModel] = useState<string>(defaultModel.image);
  const [editModel, setEditModel] = useState<string>(defaultModel["image-edit"]);
  const [videoModel, setVideoModel] = useState<string>(defaultModel.video);

  // Cast creation
  const [charName, setCharName] = useState("");
  const [charPrompt, setCharPrompt] = useState("");
  const [charUrl, setCharUrl] = useState("");

  // Scenes
  const [sceneTitle, setSceneTitle] = useState("");
  const [storyBeat, setStoryBeat] = useState("");
  const [shotCount, setShotCount] = useState(4);
  const [variantCount, setVariantCount] = useState(4);

  // Style preset creation
  const [presetName, setPresetName] = useState("");
  const [presetText, setPresetText] = useState("");

  // Any-model advanced
  const [anyModel, setAnyModel] = useState("");
  const [anyPrompt, setAnyPrompt] = useState("");
  const [anyParams, setAnyParams] = useState("");
  const [recoverTaskId, setRecoverTaskId] = useState("");
  const [recoverPrompt, setRecoverPrompt] = useState("");
  const [recoverKind, setRecoverKind] = useState<GenerationKind>("adhoc");
  const [recoverType, setRecoverType] = useState<"image" | "video">("image");
  const [boardCards, setBoardCards] = useState<BoardCard[]>([]);
  const [coachMessages, setCoachMessages] = useState<CoachMessage[]>([]);
  const [coachInput, setCoachInput] = useState("");
  const [manualCardTitle, setManualCardTitle] = useState("");
  const [manualCardBrief, setManualCardBrief] = useState("");

  // Fight
  const [fighterAId, setFighterAId] = useState<string>("");
  const [fighterBId, setFighterBId] = useState<string>("");
  const [arena, setArena] = useState("");

  const busy = status === "loading";
  const styleHint = activePreset?.text;
  const imageModelOption = findModelOption("image", imageModel);
  const editModelOption = findModelOption("image-edit", editModel);
  const videoModelOption = findModelOption("video", videoModel);
  const legacyVoiceOptions: TtsVoiceOption[] = ttsVoices.map((voice) => ({
    id: voice.id,
    label: voice.label.replace("â€”", "-"),
    tone: "Kie preset",
    source: "built-in",
  }));
  const voiceOptions = [...legacyVoiceOptions, ...expandedTtsVoices, ...importedVoices].reduce<TtsVoiceOption[]>((acc, voice) => {
    if (!acc.some((existing) => existing.id === voice.id)) acc.push(voice);
    return acc;
  }, []);
  const selectedVoice = voiceOptions.find((voice) => voice.id === lipVoice);

  const refreshCredits = async () => {
    try {
      const response = await hfFetch("/api/kie/credits");
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; credits?: number | null } | null;
      if (response.ok && payload?.ok) setCredits(payload.credits ?? null);
    } catch {
      // non-fatal
    }
  };

  useEffect(() => {
    const existing = getKieKey();
    const existingElevenLabs = getElevenLabsKey();
    const existingGlm = getGlmKey();
    const storedBoard = parseBoardCards(window.localStorage.getItem(BOARD_STORAGE));
    const storedCoach = parseCoachMessages(window.localStorage.getItem(COACH_STORAGE));
    setHasKey(existing.length > 0);
    setKieKeyInput(existing);
    setHasElevenLabsKey(existingElevenLabs.length > 0);
    setElevenLabsKeyInput(existingElevenLabs);
    setHasGlmKey(existingGlm.length > 0);
    setGlmKeyInput(existingGlm);
    setBoardCards(storedBoard);
    setCoachMessages(storedCoach.length ? storedCoach : [{
      id: makeId(),
      role: "assistant",
      text: "Bring me a rough cartoon idea, a character problem, or a model question. I will turn it into a practical shot card before you spend credits.",
      createdAt: Date.now(),
    }]);
    void refreshCredits();
  }, []);

  useEffect(() => {
    window.localStorage.setItem(BOARD_STORAGE, JSON.stringify(boardCards));
  }, [boardCards]);

  useEffect(() => {
    window.localStorage.setItem(COACH_STORAGE, JSON.stringify(coachMessages.slice(-30)));
  }, [coachMessages]);

  useEffect(() => {
    if (!previewCharacter) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewCharacter(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewCharacter]);

  const saveKey = async () => {
    setKieKey(kieKeyInput);
    setHasKey(kieKeyInput.trim().length > 0);
    setStatus("success");
    setMessage(kieKeyInput.trim() ? "Kie key saved in your browser." : "Kie key cleared.");
    await refreshCredits();
  };

  const saveElevenLabsKey = () => {
    setElevenLabsKey(elevenLabsKeyInput);
    setHasElevenLabsKey(elevenLabsKeyInput.trim().length > 0);
    setStatus("success");
    setMessage(elevenLabsKeyInput.trim() ? "ElevenLabs key saved in your browser." : "ElevenLabs key cleared.");
  };

  const saveGlmKey = () => {
    setGlmKey(glmKeyInput);
    setHasGlmKey(glmKeyInput.trim().length > 0);
    setStatus("success");
    setMessage(glmKeyInput.trim() ? "GLM key saved in your browser." : "GLM key cleared.");
  };

  const importElevenLabsVoices = async () => {
    setImportingVoices(true);
    setStatus("loading");
    setMessage("Importing ElevenLabs voices...");
    try {
      if (elevenLabsKeyInput.trim() !== getElevenLabsKey()) {
        setElevenLabsKey(elevenLabsKeyInput);
        setHasElevenLabsKey(elevenLabsKeyInput.trim().length > 0);
      }
      const response = await hfFetch("/api/elevenlabs/voices");
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; voices?: ImportedVoice[]; error?: unknown } | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : "Could not import ElevenLabs voices.");
      }
      setImportedVoices(payload.voices ?? []);
      setStatus("success");
      setMessage(`Imported ${(payload.voices ?? []).length} ElevenLabs voices.`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not import ElevenLabs voices.");
    } finally {
      setImportingVoices(false);
    }
  };

  const failureMessage = (error: unknown): string => (error instanceof Error ? error.message : "Generation failed.");

  const logFailure = async (kind: GenerationKind, prompt: string, error: unknown, model?: string) => {
    const taskId = error instanceof KieGenerationTimeoutError ? `Task ID: ${error.taskId}` : undefined;
    await logGeneration({
      kind,
      status: "failed",
      prompt,
      model: error instanceof KieGenerationTimeoutError ? (error.model ?? model) : model,
      error: [failureMessage(error), taskId].filter(Boolean).join(" "),
    });
  };

  const addBoardCard = (card: Omit<BoardCard, "id" | "status" | "createdAt">, statusValue: BoardStatus = "idea") => {
    setBoardCards((current) => [
      {
        ...card,
        id: makeId(),
        status: statusValue,
        createdAt: Date.now(),
      },
      ...current,
    ]);
    setStatus("success");
    setMessage("Added a shot card to Studio.");
  };

  const moveBoardCard = (id: string, statusValue: BoardStatus) => {
    setBoardCards((current) => current.map((card) => card.id === id ? { ...card, status: statusValue } : card));
  };

  const deleteBoardCard = (id: string) => {
    setBoardCards((current) => current.filter((card) => card.id !== id));
  };

  const loadCardIntoScenes = (card: BoardCard) => {
    setSceneTitle(card.title);
    setStoryBeat(card.prompt);
    setTab("scenes");
    setStatus("success");
    setMessage("Loaded the board card into Scenes.");
  };

  const createManualCard = () => {
    if (!manualCardTitle.trim() && !manualCardBrief.trim()) {
      setStatus("error");
      setMessage("Add a title or brief for the card.");
      return;
    }
    const title = manualCardTitle.trim() || "Untitled cartoon beat";
    const brief = manualCardBrief.trim() || "Rough idea";
    addBoardCard({
      title,
      brief,
      prompt: `${title}. ${brief}. Cartoon key art with clear silhouettes, expressive acting, and production-ready composition.`,
      modelHint: `${imageModelOption?.family ?? "Image"} / ${imageModelOption?.label ?? imageModel}`,
    });
    setManualCardTitle("");
    setManualCardBrief("");
  };

  const sendCoachMessage = async () => {
    const text = coachInput.trim();
    if (!text) return;
    const userMessage: CoachMessage = { id: makeId(), role: "user", text, createdAt: Date.now() };
    setCoachInput("");
    setCoachMessages((current) => [...current, userMessage]);
    setCoachLoading(true);
    if (glmKeyInput.trim() && glmKeyInput.trim() !== getGlmKey()) {
      setGlmKey(glmKeyInput);
      setHasGlmKey(true);
    }
    try {
      const response = await hfFetch("/api/glm/art-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          activeHero: activeCharacter?.name,
          imageModel: `${imageModelOption?.family ?? "Image"} / ${imageModelOption?.label ?? imageModel}`,
          editModel: `${editModelOption?.family ?? "Reference"} / ${editModelOption?.label ?? editModel}`,
          videoModel: `${videoModelOption?.family ?? "Video"} / ${videoModelOption?.label ?? videoModel}`,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; reply?: string; card?: CoachMessage["card"]; error?: string } | null;
      if (!response.ok || !payload?.ok || !payload.reply) throw new Error(payload?.error ?? "GLM art coach failed.");
      const assistantMessage: CoachMessage = {
        id: makeId(),
        role: "assistant",
        text: payload.reply,
        card: payload.card,
        createdAt: Date.now(),
      };
      setCoachMessages((current) => [...current, assistantMessage]);
    } catch (error) {
      const fallback = buildCoachReply(text, activeCharacter?.name);
      setCoachMessages((current) => [...current, {
        ...fallback,
        text: `${fallback.text}\n\nGLM was unavailable: ${error instanceof Error ? error.message : "request failed"}`,
      }]);
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "GLM art coach failed.");
    } finally {
      setCoachLoading(false);
    }
  };

  const recoverKieTask = async () => {
    const taskId = recoverTaskId.trim();
    if (!taskId) {
      setStatus("error");
      setMessage("Paste a Kie task ID first.");
      return;
    }
    setStatus("loading");
    setMessage(`Checking Kie task ${taskId}...`);
    try {
      const response = await hfFetch(`/api/kie/task?taskId=${encodeURIComponent(taskId)}`);
      const payload = (await response.json().catch(() => null)) as TaskLookupResponse | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? `Task lookup failed (HTTP ${response.status}).`);
      }
      if (payload.state === "fail") {
        const error = payload.failMsg ?? "Recovered task failed.";
        await logGeneration({
          kind: recoverKind,
          status: "failed",
          prompt: recoverPrompt.trim() || `Recovered Kie task ${taskId}`,
          model: payload.model,
          error,
        });
        throw new Error(error);
      }
      if (payload.state !== "success" || !payload.resultUrl) {
        setMessage(`Task ${taskId} is ${payload.state ?? "still running"}.`);
        return;
      }
      await addFrame({
        url: payload.resultUrl,
        type: recoverType,
        prompt: recoverPrompt.trim() || `Recovered Kie task ${taskId}`,
        shot: `Recovered ${taskId}`,
        kind: recoverKind,
        model: payload.model,
      });
      setRecoverTaskId("");
      setRecoverPrompt("");
      setStatus("success");
      setMessage("Recovered task saved to Frames.");
      setTab("frames");
      void refreshCredits();
    } catch (error) {
      setStatus("error");
      setMessage(failureMessage(error));
    }
  };

  // ---- Upload your own reference -----------------------------------------
  const uploadReference = async (file: File) => {
    if (!charName.trim()) {
      setStatus("error");
      setMessage("Name the character before uploading a reference.");
      return;
    }
    setUploading(true);
    setStatus("loading");
    setMessage("Uploading reference image...");
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Could not read file."));
        reader.readAsDataURL(file);
      });
      const response = await hfFetch("/api/kie/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64Data: dataUrl, fileName: file.name }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; url?: string; error?: string } | null;
      if (!response.ok || !payload?.ok || !payload.url) {
        throw new Error(payload?.error ?? "Upload failed.");
      }
      await addCharacter(charName, payload.url);
      setCharName("");
      setStatus("success");
      setMessage("Reference uploaded and character saved.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  // ---- Cast ---------------------------------------------------------------
  const createCharacterFromPrompt = async () => {
    if (!charName.trim() || !charPrompt.trim()) {
      setStatus("error");
      setMessage("Give the character a name and a reference description.");
      return;
    }
    setStatus("loading");
    setMessage(`Generating reference for ${charName.trim()}...`);
    try {
      const url = await runKieGeneration({
        prompt: `Full-body character reference sheet, single character, neutral background: ${charPrompt.trim()}`,
        styleHint,
        speed,
        mode: "image",
        model: imageModel,
        onProgress: (s) => setMessage(`Generating reference... (${s})`),
      });
      await addCharacter(charName, url, charPrompt.trim());
      setCharName("");
      setCharPrompt("");
      setStatus("success");
      setMessage("Reference generated and character saved.");
    } catch (error) {
      await logFailure("reference", charPrompt.trim(), error, imageModel);
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Reference generation failed.");
    }
  };

  const createCharacterFromUrl = async () => {
    if (!charName.trim() || !charUrl.trim()) {
      setStatus("error");
      setMessage("Give the character a name and a reference image URL.");
      return;
    }
    await addCharacter(charName, charUrl.trim());
    setCharName("");
    setCharUrl("");
    setStatus("success");
    setMessage("Character saved from URL.");
  };

  // ---- Generation helpers -------------------------------------------------
  const generateImage = async (prompt: string, refs?: string[]) => {
    // Single-character + consistency toggle -> Ideogram Character model, which
    // is purpose-built for locking a character across shots.
    if (refs?.length === 1 && useIdeoChar) {
      return runKieGeneration({
        prompt: "",
        model: pipelineModels.characterImage,
        input: {
          prompt: styleHint?.trim() ? `${prompt}. Style: ${styleHint.trim()}` : prompt,
          reference_image_urls: [refs[0]],
          rendering_speed: speed === "fast" ? "TURBO" : speed === "quality" ? "QUALITY" : "BALANCED",
          image_size: "square_hd",
        },
        onProgress: (s) => setMessage(`Working... (${s})`),
      });
    }
    return runKieGeneration({
      prompt: refs?.length ? `Keep the same character(s) from the reference image(s). ${prompt}` : prompt,
      styleHint,
      speed,
      mode: refs?.length ? "image-edit" : "image",
      model: refs?.length ? editModel : imageModel,
      imageUrls: refs,
      onProgress: (s) => setMessage(`Working... (${s})`),
    });
  };

  // ---- Scenes: multi-shot -------------------------------------------------
  const generateMultiShot = async () => {
    if (!storyBeat.trim()) {
      setStatus("error");
      setMessage("Add a story beat first.");
      return;
    }
    const shots = expandShots(storyBeat, shotCount);
    const refs = activeCharacter ? [activeCharacter.referenceUrl] : undefined;
    setStatus("loading");
    try {
      for (let i = 0; i < shots.length; i += 1) {
        setMessage(`Generating shot ${i + 1}/${shots.length}: ${shots[i].label}...`);
        const url = await generateImage(shots[i].prompt, refs);
        addFrame({ url, type: "image", prompt: shots[i].prompt, characterName: activeCharacter?.name, shot: shots[i].label });
      }
      setStatus("success");
      setMessage(`Generated ${shots.length} shots${activeCharacter ? ` with ${activeCharacter.name}` : ""}.`);
      setTab("frames");
      void refreshCredits();
    } catch (error) {
      await logFailure("scene", storyBeat.trim(), error, activeCharacter ? editModel : imageModel);
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Multi-shot generation failed.");
    }
  };

  // ---- Scenes: variations -------------------------------------------------
  const generateVariations = async () => {
    if (!storyBeat.trim()) {
      setStatus("error");
      setMessage("Add a story beat first.");
      return;
    }
    const refs = activeCharacter ? [activeCharacter.referenceUrl] : undefined;
    const prompt = [sceneTitle.trim(), storyBeat.trim()].filter(Boolean).join(". ");
    setStatus("loading");
    try {
      for (let i = 0; i < variantCount; i += 1) {
        setMessage(`Generating variant ${i + 1}/${variantCount}...`);
        const url = await generateImage(prompt, refs);
        addFrame({ url, type: "image", prompt, characterName: activeCharacter?.name, shot: `Variant ${i + 1}` });
      }
      setStatus("success");
      setMessage(`Generated ${variantCount} variants.`);
      setTab("frames");
      void refreshCredits();
    } catch (error) {
      await logFailure("variation", prompt, error, activeCharacter ? editModel : imageModel);
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Variation generation failed.");
    }
  };

  // ---- Fight League -------------------------------------------------------
  const fighterA = characters.find((c) => c.id === fighterAId) ?? null;
  const fighterB = characters.find((c) => c.id === fighterBId) ?? null;

  const generateFight = async () => {
    if (!fighterA || !fighterB) {
      setStatus("error");
      setMessage("Pick two fighters from your cast.");
      return;
    }
    const shots = buildFightShots(fighterA.name, fighterB.name, arena);
    const bothRefs = [fighterA.referenceUrl, fighterB.referenceUrl];
    setStatus("loading");
    try {
      for (let i = 0; i < shots.length; i += 1) {
        setMessage(`Fight shot ${i + 1}/${shots.length}: ${shots[i].label}...`);
        // Intros use the single relevant fighter; the rest use both references.
        const refs = i === 0 ? [fighterA.referenceUrl] : i === 1 ? [fighterB.referenceUrl] : bothRefs;
        const url = await generateImage(shots[i].prompt, refs);
        addFrame({ url, type: "image", prompt: shots[i].prompt, shot: shots[i].label });
      }
      setStatus("success");
      setMessage(`Built a ${shots.length}-shot fight: ${fighterA.name} vs ${fighterB.name}.`);
      setTab("frames");
      void refreshCredits();
    } catch (error) {
      await logFailure("fight", `${fighterA.name} vs ${fighterB.name}${arena.trim() ? ` in ${arena.trim()}` : ""}`, error, editModel);
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Fight generation failed.");
    }
  };

  // ---- Any model (advanced) ----------------------------------------------
  const runAnyModel = async () => {
    if (!anyModel.trim() || !anyPrompt.trim()) {
      setStatus("error");
      setMessage("Enter a model id and a prompt.");
      return;
    }
    let parsedInput: Record<string, unknown> | undefined;
    if (anyParams.trim()) {
      try {
        parsedInput = JSON.parse(anyParams) as Record<string, unknown>;
      } catch {
        setStatus("error");
        setMessage("Params must be valid JSON (or leave it blank).");
        return;
      }
    }
    setStatus("loading");
    setMessage(`Running ${anyModel.trim()}...`);
    try {
      const url = await runKieGeneration({
        prompt: anyPrompt.trim(),
        model: anyModel.trim(),
        input: parsedInput,
        onProgress: (s) => setMessage(`Working... (${s})`),
      });
      addFrame({ url, type: isVideoUrl(url) ? "video" : "image", prompt: anyPrompt.trim(), shot: anyModel.trim() });
      setStatus("success");
      setMessage(`Done with ${anyModel.trim()}.`);
      setTab("frames");
      void refreshCredits();
    } catch (error) {
      await logFailure("adhoc", anyPrompt.trim(), error, anyModel.trim());
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Generation failed.");
    }
  };

  // ---- Animate (image -> video) ------------------------------------------
  const animateFrame = async (frame: Frame) => {
    setStatus("loading");
    setMessage("Animating frame (image-to-video)...");
    try {
      const url = await runKieGeneration({
        prompt: `Animate this scene with subtle, natural motion. ${frame.prompt}`,
        speed: "fast",
        mode: "video",
        model: videoModel,
        imageUrls: [frame.url],
        resolution: "720p",
        duration: "5",
        onProgress: (s) => setMessage(`Animating... (${s})`),
      });
      addFrame({ url, type: "video", prompt: frame.prompt, characterName: frame.characterName, shot: `${frame.shot ?? "clip"} (video)` });
      setStatus("success");
      setMessage("Clip ready.");
      setTab("frames");
      void refreshCredits();
    } catch (error) {
      await logFailure("video", frame.prompt, error, videoModel);
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Animation failed.");
    }
  };

  // ---- Topaz upscale ------------------------------------------------------
  const upscaleFrame = async (frame: Frame) => {
    const isVideo = frame.type === "video";
    setStatus("loading");
    setMessage(`Upscaling ${isVideo ? "clip" : "image"} 2x...`);
    try {
      const url = await runKieGeneration({
        prompt: "",
        model: isVideo ? pipelineModels.videoUpscale : pipelineModels.imageUpscale,
        input: isVideo
          ? { video_url: frame.url, upscale_factor: "2" }
          : { image_url: frame.url, upscale_factor: "2" },
        onProgress: (s) => setMessage(`Upscaling... (${s})`),
      });
      addFrame({ url, type: frame.type, prompt: `Upscaled: ${frame.prompt}`, characterName: frame.characterName, shot: `${frame.shot ?? "frame"} 2x`, kind: "adhoc" });
      setStatus("success");
      setMessage("Upscaled 2x.");
      void refreshCredits();
    } catch (error) {
      await logFailure("adhoc", `Upscaled: ${frame.prompt}`, error, isVideo ? pipelineModels.videoUpscale : pipelineModels.imageUpscale);
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Upscale failed.");
    }
  };

  // ---- Lipsync (TTS voice -> talking character) ---------------------------
  const lipImage = characters.find((c) => c.id === lipImageId) ?? activeCharacter;
  const runLipsync = async () => {
    const sourceUrl = lipImage?.referenceUrl;
    if (!sourceUrl) {
      setStatus("error");
      setMessage("Pick a character for the talking head first.");
      return;
    }
    if (!lipText.trim()) {
      setStatus("error");
      setMessage("Add the line you want them to say.");
      return;
    }
    const voiceId = lipVoice === CUSTOM_VOICE_ID ? customVoiceId.trim() : lipVoice;
    if (!voiceId) {
      setStatus("error");
      setMessage("Choose a voice or paste a custom voice ID.");
      return;
    }
    setStatus("loading");
    try {
      const useDirectElevenLabs = selectedVoice?.source === "elevenlabs" || (lipVoice === CUSTOM_VOICE_ID && hasElevenLabsKey);
      let audioUrl: string;
      if (useDirectElevenLabs) {
        setMessage("Generating voice with ElevenLabs...");
        const response = await hfFetch("/api/elevenlabs/speech", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ voiceId, text: lipText.trim() }),
        });
        const payload = (await response.json().catch(() => null)) as { ok?: boolean; url?: string; error?: string } | null;
        if (!response.ok || !payload?.ok || !payload.url) {
          throw new Error(payload?.error ?? "ElevenLabs speech generation failed.");
        }
        audioUrl = payload.url;
      } else {
        setMessage("Generating voice (Kie ElevenLabs)...");
        audioUrl = await runKieGeneration({
          prompt: "",
          model: pipelineModels.tts,
          input: { text: lipText.trim(), voice: voiceId },
          onProgress: (s) => setMessage(`Voice... (${s})`),
        });
      }
      setMessage("Animating talking character (lipsync)...");
      const videoUrl = await runKieGeneration({
        prompt: "",
        model: pipelineModels.lipsync,
        input: {
          image_url: sourceUrl,
          audio_url: audioUrl,
          prompt: `${lipImage?.name ?? "A cartoon character"} speaking, expressive and natural lip sync.`,
          resolution: lipRes,
        },
        onProgress: (s) => setMessage(`Lipsync... (${s})`),
      });
      addFrame({ url: videoUrl, type: "video", prompt: lipText.trim(), characterName: lipImage?.name, shot: "Lipsync", kind: "video" });
      setStatus("success");
      setMessage("Talking clip ready.");
      setTab("frames");
      void refreshCredits();
    } catch (error) {
      await logFailure("video", lipText.trim(), error, pipelineModels.lipsync);
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Lipsync failed.");
    }
  };

  const feedbackColor =
    status === "error"
      ? "border-[#ff5a3c] bg-[#ff5a3c]/12 text-[#ff8c79]"
      : status === "success"
        ? "border-[#4ade80] bg-[#4ade80]/12 text-[#86efac]"
        : "border-[#2e2640] bg-[#0c0a12] text-[#b3a7c4]";
  const statusDot = status === "error" ? "#ff5a3c" : status === "success" ? "#4ade80" : status === "loading" ? "#ffd23f" : "#6b6480";

  return (
    <div className="flex min-h-screen w-full">
      {/* SIDEBAR / TABS */}
      <aside className="sticky top-0 hidden h-screen w-60 flex-none flex-col border-r border-[#2e2640] bg-[#0c0a12]/80 p-5 lg:flex">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ff5a3c] font-[family-name:var(--font-bricolage)] text-lg font-black text-[#05040a]">H</span>
          <div>
            <p className="font-[family-name:var(--font-bricolage)] text-base font-black leading-none">Heroframe</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#6b6480]">Cartoon maker</p>
          </div>
        </div>
        <nav className="mt-8 flex flex-col gap-4">
          {tabGroups.map((group) => (
            <div key={group.label}>
              <p className="px-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#6b6480]">{group.label}</p>
              <div className="mt-1 grid gap-1">
                {group.tabs.map((id) => {
                  const t = tabs.find((item) => item.id === id)!;
                  return (
                    <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${tab === t.id ? "bg-[#181320] text-[#fbf4e6]" : "text-[#b3a7c4] hover:bg-[#181320] hover:text-[#fbf4e6]"}`}>
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.dot }} />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="mt-auto rounded-xl border border-[#2e2640] bg-[#181320] p-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: statusDot }} />
            <p className="text-xs font-semibold text-[#fbf4e6]">{status}</p>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-[#6b6480]">{characters.length} cast · {frames.length} frames</p>
          <button type="button" onClick={refreshCredits} className="mt-2 w-full rounded-lg border border-[#2e2640] px-2 py-1 text-left text-[11px] text-[#b3a7c4] transition hover:text-[#fbf4e6]">
            Kie credits: <span className="font-bold text-[#ffd23f]">{credits === null ? "—" : credits}</span>
          </button>

          <div className="mt-3 border-t border-[#2e2640] pt-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#6b6480]">Your Kie API key</p>
            <input
              type="password"
              value={kieKeyInput}
              onChange={(e) => setKieKeyInput(e.target.value)}
              placeholder="paste your kie.ai key"
              className="mt-2 min-h-9 w-full rounded-lg border border-[#2e2640] bg-[#0c0a12] px-2 text-[11px] text-[#fbf4e6] outline-none focus-visible:border-[#ffd23f]"
            />
            <button type="button" onClick={saveKey} className="mt-2 w-full rounded-lg bg-[#ffd23f] px-2 py-1.5 text-[11px] font-bold text-[#05040a] hover:bg-[#ffdd66]">
              {hasKey ? "Update key" : "Save key"}
            </button>
            <p className="mt-1 text-[10px] leading-3 text-[#6b6480]">Stored only in your browser. Get one at kie.ai/api-key.</p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-[#2e2640] bg-[#0c0a12]/85 px-5 py-3 backdrop-blur sm:px-8">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-[#ffd23f] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#05040a]">Ages of Cartoons</span>
            <h1 className="font-[family-name:var(--font-bricolage)] text-lg font-black uppercase tracking-tight sm:text-xl">Cartoon Studio</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={presetId ?? ""} onChange={(e) => setPresetId(e.target.value || null)} title="Style preset" className="min-h-9 rounded-lg border border-[#2e2640] bg-[#0c0a12] px-2 text-xs text-[#fbf4e6]">
              <option value="">No style</option>
              {presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div className="flex gap-1">
              {speeds.map((s) => (
                <button key={s} type="button" onClick={() => setSpeed(s)} className={`rounded-lg border px-2 py-1 text-[11px] font-bold capitalize ${speed === s ? "border-[#2ec4b6] bg-[#2ec4b6] text-[#05040a]" : "border-[#2e2640] text-[#b3a7c4]"}`}>{s}</button>
              ))}
            </div>
          </div>
        </header>

        {/* Tab strip for mobile */}
        <div className="flex gap-2 overflow-x-auto border-b border-[#2e2640] px-5 py-2 lg:hidden">
          {tabs.map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold ${tab === t.id ? "bg-[#ffd23f] text-[#05040a]" : "border border-[#2e2640] text-[#b3a7c4]"}`}>{t.label}</button>
          ))}
        </div>

        <section className="border-b border-[#2e2640] bg-[#0c0a12]/55 px-5 py-3 sm:px-8">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6b6480]">Production settings</p>
              <p className="truncate text-xs text-[#b3a7c4]">
                Image: {imageModelOption?.label ?? imageModel} / Reference: {editModelOption?.label ?? editModel} / Video: {videoModelOption?.label ?? videoModel}
              </p>
            </div>
            <button type="button" onClick={() => setShowProductionSettings((value) => !value)} className="w-fit rounded-lg border border-[#2e2640] px-3 py-1.5 text-xs font-black text-[#fbf4e6] hover:bg-[#181320]">
              {showProductionSettings ? "Hide models" : "Choose models"}
            </button>
          </div>
          {showProductionSettings ? <div className="mt-3 grid gap-3 xl:grid-cols-3">
            <div className="rounded-xl border border-[#2e2640] bg-[#181320]/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <label className={labelCls} htmlFor="image-model">New image</label>
                <span className="rounded-full bg-[#ff5a3c]/15 px-2 py-0.5 text-[10px] font-black uppercase text-[#ff8c79]">{imageModelOption?.badge ?? "model"}</span>
              </div>
              <select id="image-model" value={imageModel} onChange={(e) => setImageModel(e.target.value)} className={`${field} mt-2 min-h-10 text-xs`}>
                {modelCatalog.image.map((m) => <option key={m.id} value={m.id}>{m.family} / {m.label}</option>)}
              </select>
              <div className="mt-2 flex items-start justify-between gap-3">
                <p className="min-w-0 text-xs leading-4 text-[#b3a7c4]">{imageModelOption?.hint}</p>
                <code className="max-w-[45%] truncate rounded-md bg-[#05040a] px-1.5 py-1 text-[10px] text-[#7c8499]">{imageModel}</code>
              </div>
            </div>
            <div className="rounded-xl border border-[#2e2640] bg-[#181320]/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <label className={labelCls} htmlFor="edit-model">Reference image</label>
                <span className="rounded-full bg-[#8a5cff]/15 px-2 py-0.5 text-[10px] font-black uppercase text-[#c4afff]">{editModelOption?.badge ?? "model"}</span>
              </div>
              <select id="edit-model" value={editModel} onChange={(e) => setEditModel(e.target.value)} className={`${field} mt-2 min-h-10 text-xs`}>
                {modelCatalog["image-edit"].map((m) => <option key={m.id} value={m.id}>{m.family} / {m.label}</option>)}
              </select>
              <div className="mt-2 flex items-start justify-between gap-3">
                <p className="min-w-0 text-xs leading-4 text-[#b3a7c4]">{editModelOption?.hint}</p>
                <code className="max-w-[45%] truncate rounded-md bg-[#05040a] px-1.5 py-1 text-[10px] text-[#7c8499]">{editModel}</code>
              </div>
            </div>
            <div className="rounded-xl border border-[#2e2640] bg-[#181320]/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <label className={labelCls} htmlFor="video-model">Animate</label>
                <span className="rounded-full bg-[#2ec4b6]/15 px-2 py-0.5 text-[10px] font-black uppercase text-[#7be6dc]">{videoModelOption?.badge ?? "model"}</span>
              </div>
              <select id="video-model" value={videoModel} onChange={(e) => setVideoModel(e.target.value)} className={`${field} mt-2 min-h-10 text-xs`}>
                {modelCatalog.video.map((m) => <option key={m.id} value={m.id}>{m.family} / {m.label}</option>)}
              </select>
              <div className="mt-2 flex items-start justify-between gap-3">
                <p className="min-w-0 text-xs leading-4 text-[#b3a7c4]">{videoModelOption?.hint}</p>
                <code className="max-w-[45%] truncate rounded-md bg-[#05040a] px-1.5 py-1 text-[10px] text-[#7c8499]">{videoModel}</code>
              </div>
            </div>
          </div> : null}
        </section>

        <div className="flex-1 p-5 sm:p-8">
          {message ? <div className={`mb-5 rounded-xl border px-3 py-2 text-sm font-medium ${feedbackColor}`} role="status">{message}</div> : null}

          {tab === "studio" ? (
            <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.5fr)_minmax(22rem,0.8fr)]">
              <section className={`${panel} border-t-4 border-t-[#ffd23f] p-5`}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h2 className="font-[family-name:var(--font-bricolage)] text-2xl font-black">Studio Board</h2>
                    <p className="mt-1 text-xs text-[#6b6480]">Plan beats before spending credits. Move cards as they become prompts, renders, and finished shots.</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[12rem_1fr_auto] lg:min-w-[36rem]">
                    <input value={manualCardTitle} onChange={(e) => setManualCardTitle(e.target.value)} placeholder="Shot title" className={field} />
                    <input value={manualCardBrief} onChange={(e) => setManualCardBrief(e.target.value)} placeholder="Brief idea" className={field} />
                    <button type="button" onClick={createManualCard} className={`${btn} bg-[#ffd23f] text-[#05040a] hover:bg-[#ffdd66]`}>Add card</button>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 xl:grid-cols-4">
                  {boardColumns.map((column) => {
                    const columnCards = boardCards.filter((card) => card.status === column.id);
                    return (
                      <div key={column.id} className="min-h-72 rounded-xl border border-[#2e2640] bg-[#0c0a12]/85 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#fbf4e6]">{column.label}</h3>
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-black text-[#05040a]" style={{ backgroundColor: column.accent }}>{columnCards.length}</span>
                        </div>
                        <div className="mt-3 grid gap-3">
                          {columnCards.length === 0 ? <p className="rounded-lg border border-dashed border-[#2e2640] p-3 text-xs text-[#6b6480]">No cards yet.</p> : null}
                          {columnCards.map((card) => (
                            <article key={card.id} className="rounded-xl border border-[#2e2640] bg-[#181320] p-3">
                              <h4 className="text-sm font-black text-[#fbf4e6]">{card.title}</h4>
                              <p className="mt-1 text-xs leading-4 text-[#b3a7c4]">{card.brief}</p>
                              <p className="mt-2 line-clamp-3 text-[11px] leading-4 text-[#7c8499]">{card.prompt}</p>
                              <p className="mt-2 rounded-lg bg-[#05040a] px-2 py-1 text-[10px] font-bold text-[#ffd23f]">{card.modelHint}</p>
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {boardColumns.map((target) => (
                                  <button key={target.id} type="button" onClick={() => moveBoardCard(card.id, target.id)} disabled={card.status === target.id} className="rounded-lg border border-[#2e2640] px-2 py-1 text-[10px] font-bold text-[#b3a7c4] hover:text-[#fbf4e6] disabled:opacity-35">
                                    {target.label}
                                  </button>
                                ))}
                              </div>
                              <div className="mt-2 flex items-center justify-between gap-2">
                                <button type="button" onClick={() => loadCardIntoScenes(card)} className="text-[11px] font-black text-[#2ec4b6] hover:underline">Use in Scenes</button>
                                <button type="button" onClick={() => deleteBoardCard(card.id)} className="text-[11px] font-bold text-[#6b6480] hover:text-[#ff5a3c]">delete</button>
                              </div>
                            </article>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className={`${panel} border-t-4 border-t-[#8a5cff] p-5`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="font-[family-name:var(--font-bricolage)] text-2xl font-black">Art Coach</h2>
                    <p className="mt-1 text-xs text-[#6b6480]">GLM 5.2 art direction for cartoon prompts, model choice, and board cards.</p>
                  </div>
                  <span className={`w-fit rounded-full px-2 py-1 text-[10px] font-black uppercase ${hasGlmKey ? "bg-[#4ade80] text-[#05040a]" : "bg-[#2e2640] text-[#b3a7c4]"}`}>
                    {hasGlmKey ? "GLM ready" : "BYOK"}
                  </span>
                </div>
                <div className="mt-4 grid gap-2 rounded-xl border border-[#2e2640] bg-[#0c0a12] p-3 sm:grid-cols-[1fr_auto]">
                  <input
                    type="password"
                    value={glmKeyInput}
                    onChange={(e) => setGlmKeyInput(e.target.value)}
                    placeholder="Z.AI / GLM API key"
                    className={field}
                  />
                  <button type="button" onClick={saveGlmKey} className={`${btn} border border-[#2e2640] text-[#fbf4e6] hover:bg-[#181320]`}>
                    {hasGlmKey ? "Update GLM key" : "Save GLM key"}
                  </button>
                  <p className="text-[11px] leading-4 text-[#6b6480] sm:col-span-2">Stored only in your browser. The coach calls `glm-5.2`; if no key is saved, HeroFrame falls back to local guidance.</p>
                </div>
                <div className="mt-4 grid max-h-[32rem] gap-3 overflow-y-auto pr-1">
                  {coachMessages.map((chat) => (
                    <div key={chat.id} className={`rounded-xl border p-3 ${chat.role === "user" ? "border-[#2e2640] bg-[#05040a]" : "border-[#8a5cff]/45 bg-[#8a5cff]/10"}`}>
                      <p className="whitespace-pre-line text-sm leading-5 text-[#fbf4e6]">{chat.text}</p>
                      {chat.card ? (
                        <button type="button" onClick={() => addBoardCard(chat.card!, "ready")} className="mt-3 rounded-lg bg-[#8a5cff] px-3 py-1.5 text-[11px] font-black text-[#fbf4e6] hover:bg-[#9d75ff]">
                          Add suggested card
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid gap-2">
                  <textarea value={coachInput} onChange={(e) => setCoachInput(e.target.value)} placeholder="Ask for a scene idea, model recommendation, fight beat, style direction, or prompt polish." className={`${field} min-h-28 py-2`} />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => void sendCoachMessage()} disabled={coachLoading} className={`${btn} bg-[#8a5cff] text-[#fbf4e6] hover:bg-[#9d75ff]`}>
                      {coachLoading ? "Thinking..." : "Send to GLM 5.2"}
                    </button>
                    <button type="button" onClick={() => setCoachInput("A short cartoon scene where the hero makes a hard choice, with one memorable visual gag and a model recommendation.")} className={`${btn} border border-[#2e2640] text-[#fbf4e6] hover:bg-[#181320]`}>Seed idea</button>
                  </div>
                </div>
                <div className="mt-5 rounded-xl border border-[#2e2640] bg-[#0c0a12] p-3">
                  <h3 className="text-xs font-black uppercase tracking-[0.16em] text-[#ffd23f]">API direction</h3>
                  <ul className="mt-2 grid gap-2 text-xs leading-4 text-[#b3a7c4]">
                    <li>KIE remains the main BYOK generation rail: create a task, poll status, persist successful media.</li>
                    <li>WaveSpeed stays useful as a secondary provider path, especially if you want fallback routing later.</li>
                    <li>ElevenLabs direct import is right for personal voices; KIE TTS remains simpler for built-in voices.</li>
                  </ul>
                </div>
              </section>
            </div>
          ) : null}

          {/* CAST */}
          {tab === "cast" ? (
            <div className="grid gap-5 xl:grid-cols-12">
              <section className={`${panel} border-t-4 border-t-[#8a5cff] p-6 xl:col-span-5`}>
                <h2 className="font-[family-name:var(--font-bricolage)] text-xl font-extrabold">Create a hero</h2>
                <p className="mt-1 text-xs text-[#6b6480]">Save a hero once. Reuse the same look across every scene and fight.</p>
                <div className="mt-4 grid gap-3">
                  <div className="grid gap-2"><label className={labelCls} htmlFor="cn">Name</label><input id="cn" value={charName} onChange={(e) => setCharName(e.target.value)} placeholder="e.g. Captain Rook" className={field} /></div>
                  <div className="grid gap-2"><label className={labelCls} htmlFor="cp">Describe the hero</label><textarea id="cp" value={charPrompt} onChange={(e) => setCharPrompt(e.target.value)} placeholder="stocky knight, copper armor, scar over left eye, teal cape" className={`${field} min-h-24 py-2`} /></div>
                  <button type="button" onClick={createCharacterFromPrompt} disabled={busy} className={`${btn} bg-[#8a5cff] text-[#fbf4e6] hover:bg-[#9d75ff]`}>Generate reference + save</button>
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[#6b6480]"><span className="h-px flex-1 bg-[#2e2640]" /> or paste URL <span className="h-px flex-1 bg-[#2e2640]" /></div>
                  <input value={charUrl} onChange={(e) => setCharUrl(e.target.value)} placeholder="https://image-url..." className={field} />
                  <button type="button" onClick={createCharacterFromUrl} disabled={busy} className={`${btn} border border-[#2e2640] bg-transparent text-[#fbf4e6] hover:bg-[#181320]`}>Save from URL</button>
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[#6b6480]"><span className="h-px flex-1 bg-[#2e2640]" /> or upload a photo <span className="h-px flex-1 bg-[#2e2640]" /></div>
                  <label className={`${btn} cursor-pointer border border-[#2e2640] bg-transparent text-[#fbf4e6] hover:bg-[#181320] ${uploading ? "opacity-40" : ""}`}>
                    {uploading ? "Uploading..." : "Upload reference image"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploading || busy}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadReference(f); e.target.value = ""; }}
                    />
                  </label>
                </div>
              </section>

              <section className={`${panel} border-t-4 border-t-[#2ec4b6] p-6 xl:col-span-7`}>
                <h2 className="font-[family-name:var(--font-bricolage)] text-xl font-extrabold">Cast ({characters.length})</h2>
                {characters.length === 0 ? (
                  <div className="mt-4">
                    <p className="text-sm text-[#6b6480]">No heroes yet. Create one on the left.</p>
                    <div className="hidden">
                      {["bg-hero", "bg-manga", "bg-chibi", "bg-mecha", "bg-noir"].map((name) => (
                        <figure key={name} className="overflow-hidden rounded-xl border border-[#2e2640] bg-[#0c0a12]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/bg/${name}.webp`} alt="Sample cartoon style" className="aspect-square w-full object-cover" />
                        </figure>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {characters.map((c) => (
                      <div key={c.id} className={`flex gap-3 rounded-xl border p-3 ${c.id === activeId ? "border-[#8a5cff] bg-[#8a5cff]/10" : "border-[#2e2640] bg-[#0c0a12]"}`}>
                        <button type="button" onClick={() => setPreviewCharacter(c)} className="group relative h-16 w-16 flex-none overflow-hidden rounded-lg border border-[#2e2640] bg-[#05040a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd23f]" aria-label={`Open ${c.name} reference image`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={c.referenceUrl} alt={c.name} className="h-full w-full object-cover transition group-hover:scale-105" />
                          <span className="absolute inset-x-0 bottom-0 bg-[#05040a]/75 py-0.5 text-center text-[9px] font-black uppercase text-[#ffd23f] opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">View</span>
                        </button>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <button type="button" onClick={() => setPreviewCharacter(c)} className="truncate text-left text-sm font-bold text-[#fbf4e6] hover:text-[#ffd23f] focus-visible:outline-none focus-visible:text-[#ffd23f]">{c.name}</button>
                          <div className="mt-auto flex gap-2">
                            <button type="button" onClick={() => setActiveId(c.id)} className={`rounded-lg px-2 py-1 text-[11px] font-bold ${c.id === activeId ? "bg-[#8a5cff] text-[#fbf4e6]" : "border border-[#2e2640] text-[#b3a7c4] hover:text-[#fbf4e6]"}`}>{c.id === activeId ? "active" : "use"}</button>
                            <button type="button" onClick={() => removeCharacter(c.id)} className="rounded-lg px-2 py-1 text-[11px] text-[#6b6480] hover:text-[#ff5a3c]">remove</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Recycle bin */}
                <div className="mt-6 border-t border-[#2e2640] pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-bold text-[#fbf4e6]">Recycle bin ({deleted.length})</h3>
                    <button type="button" onClick={() => loadDeleted()} className="rounded-lg border border-[#2e2640] px-2 py-1 text-[11px] font-bold text-[#b3a7c4] hover:text-[#fbf4e6]">Refresh</button>
                  </div>
                  {deleted.length === 0 ? (
                    <p className="mt-2 text-xs text-[#6b6480]">Deleted heroes show up here and can be restored.</p>
                  ) : (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {deleted.map((c) => (
                        <div key={c.id} className="flex items-center gap-3 rounded-xl border border-[#2e2640] bg-[#0c0a12] p-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={c.referenceUrl} alt={c.name} className="h-12 w-12 flex-none rounded-lg border border-[#2e2640] object-cover opacity-70" />
                          <span className="flex-1 truncate text-sm text-[#b3a7c4]">{c.name}</span>
                          <button type="button" onClick={() => restoreCharacter(c.id)} className="rounded-lg bg-[#2ec4b6] px-2 py-1 text-[11px] font-bold text-[#05040a]">restore</button>
                          <button type="button" onClick={() => purgeCharacter(c.id)} className="rounded-lg px-2 py-1 text-[11px] text-[#6b6480] hover:text-[#ff5a3c]">forever</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
          ) : null}

          {/* SCENES */}
          {tab === "scenes" ? (
            <div className="grid gap-5 xl:grid-cols-12">
              <section className={`${panel} border-t-4 border-t-[#ff5a3c] p-6 xl:col-span-7`}>
                <h2 className="font-[family-name:var(--font-bricolage)] text-xl font-extrabold">Multi-shot scene</h2>
                <p className="mt-1 text-xs text-[#6b6480]">One beat becomes a coordinated shot sequence{activeCharacter ? `, locked to ${activeCharacter.name}` : ""}.</p>
                <div className="mt-4 grid gap-3">
                  <div className="grid gap-2"><label className={labelCls} htmlFor="st">Scene title</label><input id="st" value={sceneTitle} onChange={(e) => setSceneTitle(e.target.value)} placeholder="e.g. Rooftop standoff" className={field} /></div>
                  <div className="grid gap-2"><label className={labelCls} htmlFor="sb">Story beat</label><textarea id="sb" value={storyBeat} onChange={(e) => setStoryBeat(e.target.value)} placeholder="What happens in this scene?" className={`${field} min-h-24 py-2`} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2"><label className={labelCls} htmlFor="shots"># shots</label>
                      <select id="shots" value={shotCount} onChange={(e) => setShotCount(Number(e.target.value))} className={field}>{[2,3,4,5,6].map((n) => <option key={n} value={n}>{n}</option>)}</select>
                    </div>
                    <div className="grid gap-2"><label className={labelCls} htmlFor="vars"># variants</label>
                      <select id="vars" value={variantCount} onChange={(e) => setVariantCount(Number(e.target.value))} className={field}>{[2,3,4].map((n) => <option key={n} value={n}>{n}</option>)}</select>
                    </div>
                  </div>
                </div>
                <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs text-[#b3a7c4]">
                  <input type="checkbox" checked={useIdeoChar} onChange={(e) => setUseIdeoChar(e.target.checked)} className="h-3.5 w-3.5 accent-[#8a5cff]" />
                  Stronger consistency (Ideogram Character) — single active hero only
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={generateMultiShot} disabled={busy} className={`${btn} bg-[#ff5a3c] text-[#fbf4e6] hover:bg-[#ff7259]`}>Generate {shotCount} shots</button>
                  <button type="button" onClick={generateVariations} disabled={busy} className={`${btn} border border-[#2e2640] bg-transparent text-[#fbf4e6] hover:bg-[#181320]`}>{variantCount} variations</button>
                </div>
              </section>

              <section className={`${panel} border-t-4 border-t-[#ffd23f] p-6 xl:col-span-5`}>
                <h2 className="font-[family-name:var(--font-bricolage)] text-xl font-extrabold">Style presets</h2>
                <p className="mt-1 text-xs text-[#6b6480]">Active: <span className="font-bold text-[#ffd23f]">{activePreset?.name ?? "none"}</span></p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {presets.map((p) => (
                    <button key={p.id} type="button" onClick={() => setPresetId(p.id === presetId ? null : p.id)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${p.id === presetId ? "bg-[#ffd23f] text-[#05040a]" : "border border-[#2e2640] text-[#b3a7c4] hover:text-[#fbf4e6]"}`}>{p.name}</button>
                  ))}
                </div>
                <div className="mt-4 grid gap-2">
                  <input value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="Preset name" className={field} />
                  <input value={presetText} onChange={(e) => setPresetText(e.target.value)} placeholder="style words, e.g. watercolor, soft light" className={field} />
                  <button type="button" onClick={() => { addPreset(presetName, presetText); setPresetName(""); setPresetText(""); }} className={`${btn} border border-[#2e2640] bg-transparent text-[#fbf4e6] hover:bg-[#181320]`}>Add preset</button>
                </div>
              </section>

              {/* Any model (advanced) */}
              <section className={`${panel} border-t-4 border-t-[#8a5cff] p-6 xl:col-span-12`}>
                <h2 className="font-[family-name:var(--font-bricolage)] text-xl font-extrabold">Any model (advanced)</h2>
                <p className="mt-1 text-xs text-[#6b6480]">Run any Kie model by id. Optionally pass raw JSON params for that model. Find ids at docs.kie.ai.</p>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div className="grid gap-3">
                    <div className="grid gap-2"><label className={labelCls} htmlFor="am">Model id</label><input id="am" value={anyModel} onChange={(e) => setAnyModel(e.target.value)} placeholder="e.g. seedream-v4-text-to-image" className={field} /></div>
                    <div className="grid gap-2"><label className={labelCls} htmlFor="ap">Prompt</label><textarea id="ap" value={anyPrompt} onChange={(e) => setAnyPrompt(e.target.value)} placeholder="Prompt for the model" className={`${field} min-h-20 py-2`} /></div>
                    <button type="button" onClick={runAnyModel} disabled={busy} className={`${btn} bg-[#8a5cff] text-[#fbf4e6] hover:bg-[#9d75ff]`}>Run model</button>
                  </div>
                  <div className="grid gap-2">
                    <label className={labelCls} htmlFor="aj">Raw JSON params (optional)</label>
                    <textarea id="aj" value={anyParams} onChange={(e) => setAnyParams(e.target.value)} placeholder={'{\n  "image_size": "1024x1024",\n  "input_urls": ["https://..."]\n}'} className={`${field} min-h-32 py-2 font-mono`} />
                    <p className="text-[11px] text-[#6b6480]">Merged into the model&apos;s input. Use the exact param names from that model&apos;s doc page.</p>
                  </div>
                </div>
              </section>
            </div>
          ) : null}

          {/* FIGHT */}
          {tab === "fight" ? (
            <div className="grid gap-5 xl:grid-cols-12">
              <section className={`${panel} border-t-4 border-t-[#2ec4b6] p-6 xl:col-span-12`}>
                <h2 className="font-[family-name:var(--font-bricolage)] text-xl font-extrabold">Versus Builder</h2>
                <p className="mt-1 text-xs text-[#6b6480]">Pick two saved heroes. Heroframe builds intros + a 6-shot fight, keeping both consistent.</p>
                {characters.length < 2 ? (
                  <p className="mt-4 text-sm text-[#6b6480]">Create at least two heroes in Cast first.</p>
                ) : (
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="grid gap-2"><label className={labelCls} htmlFor="fa">Fighter A</label>
                      <select id="fa" value={fighterAId} onChange={(e) => setFighterAId(e.target.value)} className={field}><option value="">Select...</option>{characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                    </div>
                    <div className="grid gap-2"><label className={labelCls} htmlFor="fb">Fighter B</label>
                      <select id="fb" value={fighterBId} onChange={(e) => setFighterBId(e.target.value)} className={field}><option value="">Select...</option>{characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                    </div>
                    <div className="grid gap-2"><label className={labelCls} htmlFor="ar">Arena</label><input id="ar" value={arena} onChange={(e) => setArena(e.target.value)} placeholder="e.g. neon rooftop colosseum" className={field} /></div>
                  </div>
                )}
                <div className="mt-4">
                  <button type="button" onClick={generateFight} disabled={busy || !fighterA || !fighterB} className={`${btn} bg-[#2ec4b6] text-[#05040a] hover:bg-[#43d6c8]`}>Build the fight</button>
                </div>
              </section>
            </div>
          ) : null}

          {/* LIPSYNC */}
          {tab === "lipsync" ? (
            <section className={`${panel} border-t-4 border-t-[#ff8cc8] p-6 xl:max-w-2xl`}>
              <h2 className="font-[family-name:var(--font-bricolage)] text-xl font-extrabold">Lipsync</h2>
              <p className="mt-1 text-xs text-[#6b6480]">Pick a hero, type their line, choose a voice. Makes a talking clip (ElevenLabs voice → Infinitalk lipsync).</p>
              {characters.length === 0 ? (
                <p className="mt-4 text-sm text-[#6b6480]">Add a character in the Cast tab first.</p>
              ) : (
                <div className="mt-4 grid gap-3">
                  <div className="rounded-xl border border-[#2e2640] bg-[#0c0a12] p-3">
                    <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                      <input
                        type="password"
                        value={elevenLabsKeyInput}
                        onChange={(e) => setElevenLabsKeyInput(e.target.value)}
                        placeholder="Optional ElevenLabs API key"
                        className={field}
                      />
                      <button type="button" onClick={saveElevenLabsKey} className={`${btn} border border-[#2e2640] bg-transparent text-[#fbf4e6] hover:bg-[#181320]`}>
                        {hasElevenLabsKey ? "Update key" : "Save key"}
                      </button>
                      <button type="button" onClick={importElevenLabsVoices} disabled={importingVoices || !elevenLabsKeyInput.trim()} className={`${btn} bg-[#ff8cc8] text-[#05040a] hover:bg-[#ffa5d4]`}>
                        {importingVoices ? "Importing..." : "Import voices"}
                      </button>
                    </div>
                    <p className="mt-2 text-[11px] leading-4 text-[#6b6480]">Voice import only lists voices. Speech is generated later when you make a talking clip.</p>
                  </div>
                  <div className="grid gap-2">
                    <label className={labelCls} htmlFor="lipchar">Character</label>
                    <select id="lipchar" value={lipImageId || activeId || ""} onChange={(e) => setLipImageId(e.target.value)} className={field}>
                      {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <label className={labelCls} htmlFor="liptext">Line to speak</label>
                    <textarea id="liptext" value={lipText} onChange={(e) => setLipText(e.target.value)} placeholder="What should they say?" maxLength={5000} className={`${field} min-h-24 py-2`} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <label className={labelCls} htmlFor="lipvoice">Voice ({voiceOptions.length + 1})</label>
                      <select id="lipvoice" value={lipVoice} onChange={(e) => setLipVoice(e.target.value)} className={field}>
                        <optgroup label="Built in">
                          {voiceOptions.filter((v) => v.source === "built-in").map((v) => <option key={v.id} value={v.id}>{v.label} - {v.tone}</option>)}
                        </optgroup>
                        {importedVoices.length > 0 ? (
                          <optgroup label="Imported ElevenLabs">
                            {voiceOptions.filter((v) => v.source === "elevenlabs").map((v) => <option key={v.id} value={v.id}>{v.label} - {v.tone}</option>)}
                          </optgroup>
                        ) : null}
                        <option value={CUSTOM_VOICE_ID}>Custom voice ID...</option>
                      </select>
                      {selectedVoice ? <p className="text-[11px] text-[#6b6480]">{selectedVoice.source === "elevenlabs" ? "ElevenLabs direct" : "Kie voice"} / {selectedVoice.tone}</p> : null}
                      {lipVoice === CUSTOM_VOICE_ID ? <input value={customVoiceId} onChange={(e) => setCustomVoiceId(e.target.value)} placeholder="Paste ElevenLabs voice_id" className={field} /> : null}
                    </div>
                    <div className="grid gap-2">
                      <label className={labelCls} htmlFor="lipres">Resolution</label>
                      <select id="lipres" value={lipRes} onChange={(e) => setLipRes(e.target.value as "480p" | "720p")} className={field}>
                        <option value="480p">480p (faster)</option>
                        <option value="720p">720p</option>
                      </select>
                    </div>
                  </div>
                  <button type="button" onClick={runLipsync} disabled={busy} className={`${btn} bg-[#ff8cc8] text-[#05040a] hover:bg-[#ffa5d4]`}>Make talking clip</button>
                </div>
              )}
            </section>
          ) : null}

          {/* FRAMES */}
          {tab === "frames" ? (
            <section className={`${panel} border-t-4 border-t-[#ffd23f] p-6`}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-[family-name:var(--font-bricolage)] text-xl font-extrabold">Frames & clips ({frames.length})</h2>
                {frames.length > 0 ? <button type="button" onClick={clearFrames} className="rounded-full border border-[#2e2640] px-3 py-1 text-[11px] font-bold uppercase text-[#b3a7c4] hover:text-[#fbf4e6]">Clear</button> : null}
              </div>
              {frames.length === 0 ? (
                <div className="mt-4 flex min-h-64 items-center justify-center rounded-xl border border-dashed border-[#2e2640] bg-[#0c0a12] text-center">
                  <p className="px-6 text-sm text-[#6b6480]">Generate a scene or a fight, then animate any frame here.</p>
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                  {frames.map((frame) => (
                    <figure key={frame.id} className="overflow-hidden rounded-xl border border-[#2e2640] bg-[#0c0a12]">
                      {frame.type === "video" ? (
                        <video src={frame.url} controls className="aspect-square w-full bg-black object-contain" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={frame.url} alt={frame.prompt} className="aspect-square w-full object-cover" />
                      )}
                      <figcaption className="flex items-center justify-between gap-2 p-3">
                        <div className="flex min-w-0 flex-col">
                          {frame.shot ? <span className="truncate text-[11px] font-bold text-[#fbf4e6]">{frame.shot}</span> : null}
                          {frame.characterName ? <span className="truncate text-[10px] uppercase text-[#8a5cff]">{frame.characterName}</span> : null}
                        </div>
                        <div className="flex flex-none gap-2">
                          {frame.type === "image" ? (
                            <button type="button" onClick={() => animateFrame(frame)} disabled={busy} className="rounded-lg bg-[#ff5a3c] px-2 py-1 text-[11px] font-bold text-[#fbf4e6] disabled:opacity-40">Animate</button>
                          ) : null}
                          <button type="button" onClick={() => upscaleFrame(frame)} disabled={busy} className="rounded-lg border border-[#2e2640] px-2 py-1 text-[11px] font-bold text-[#b3a7c4] hover:text-[#fbf4e6] disabled:opacity-40">2x</button>
                          <a href={frame.url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-[#2ec4b6] hover:underline">Open</a>
                        </div>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {/* HISTORY — every generation, good or bad, from Convex */}
          {tab === "history" ? (
            <section className={`${panel} border-t-4 border-t-[#9aa6bd] p-6`}>
              <h2 className="font-[family-name:var(--font-bricolage)] text-xl font-extrabold">History ({history.length})</h2>
              <p className="mt-1 text-xs text-[#6b6480]">Every generation is stored in Convex — successes and failures, across devices.</p>
              <div className="mt-5 grid gap-3 rounded-xl border border-[#2e2640] bg-[#0c0a12] p-4 lg:grid-cols-[1.2fr_1.2fr_0.7fr_0.7fr_auto]">
                <div className="grid gap-2">
                  <label className={labelCls} htmlFor="recover-task">Task ID</label>
                  <input id="recover-task" value={recoverTaskId} onChange={(e) => setRecoverTaskId(e.target.value)} placeholder="task_xxx" className={field} />
                </div>
                <div className="grid gap-2">
                  <label className={labelCls} htmlFor="recover-prompt">Label</label>
                  <input id="recover-prompt" value={recoverPrompt} onChange={(e) => setRecoverPrompt(e.target.value)} placeholder="Recovered shot label" className={field} />
                </div>
                <div className="grid gap-2">
                  <label className={labelCls} htmlFor="recover-kind">Kind</label>
                  <select id="recover-kind" value={recoverKind} onChange={(e) => setRecoverKind(e.target.value as GenerationKind)} className={field}>
                    {["reference", "scene", "variation", "fight", "video", "adhoc"].map((kind) => <option key={kind} value={kind}>{kind}</option>)}
                  </select>
                </div>
                <div className="grid gap-2">
                  <label className={labelCls} htmlFor="recover-type">Type</label>
                  <select id="recover-type" value={recoverType} onChange={(e) => setRecoverType(e.target.value as "image" | "video")} className={field}>
                    <option value="image">image</option>
                    <option value="video">video</option>
                  </select>
                </div>
                <button type="button" onClick={recoverKieTask} disabled={busy || !hasKey} className={`${btn} self-end bg-[#9aa6bd] text-[#05040a] hover:bg-[#b4bed0]`}>Recover</button>
              </div>
              <div className="mt-3 flex justify-end">
                <a href="https://kie.ai/logs" target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-[#2ec4b6] hover:underline">Open Kie logs</a>
              </div>
              {history.length === 0 ? (
                <div className="mt-4 flex min-h-48 items-center justify-center rounded-xl border border-dashed border-[#2e2640] bg-[#0c0a12] text-center">
                  <p className="px-6 text-sm text-[#6b6480]">No generations logged yet.</p>
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {history.map((g) => (
                    <figure key={g._id} className="overflow-hidden rounded-xl border border-[#2e2640] bg-[#0c0a12]">
                      {g.status === "succeeded" && g.url ? (
                        g.type === "video" ? (
                          <video src={g.url} className="aspect-square w-full bg-black object-contain" />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={g.url} alt={g.prompt} className="aspect-square w-full object-cover" />
                        )
                      ) : (
                        <div className="flex aspect-square w-full items-center justify-center bg-[#15101a] text-center text-[10px] text-[#ff8c79]">
                          {g.status === "failed" ? "failed" : "no preview"}
                        </div>
                      )}
                      <figcaption className="flex items-center justify-between gap-2 p-2">
                        <span className="truncate text-[10px] uppercase text-[#7c8499]">{g.kind}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase ${g.status === "succeeded" ? "bg-[#4ade80] text-[#05040a]" : "bg-[#ff5a3c] text-[#fbf4e6]"}`}>{g.status}</span>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </section>
          ) : null}
        </div>
      </div>
      {previewCharacter ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#05040a]/90 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label={`${previewCharacter.name} reference preview`} onClick={() => setPreviewCharacter(null)}>
          <div className="grid max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-[#2e2640] bg-[#0c0a12] shadow-2xl shadow-black/50 lg:grid-cols-[minmax(0,1fr)_18rem]" onClick={(e) => e.stopPropagation()}>
            <div className="flex min-h-0 items-center justify-center bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewCharacter.referenceUrl} alt={previewCharacter.name} className="max-h-[72vh] w-full object-contain lg:max-h-[92vh]" />
            </div>
            <aside className="flex flex-col gap-4 border-t border-[#2e2640] p-5 lg:border-l lg:border-t-0">
              <div>
                <p className={labelCls}>Cast reference</p>
                <h2 className="mt-2 font-[family-name:var(--font-bricolage)] text-2xl font-black text-[#fbf4e6]">{previewCharacter.name}</h2>
                {previewCharacter.notes ? <p className="mt-2 text-sm leading-5 text-[#b3a7c4]">{previewCharacter.notes}</p> : null}
              </div>
              <div className="mt-auto grid gap-2">
                <button type="button" onClick={() => { setActiveId(previewCharacter.id); setPreviewCharacter(null); }} className={`${btn} bg-[#8a5cff] text-[#fbf4e6] hover:bg-[#9d75ff]`}>
                  Use this hero
                </button>
                <a href={previewCharacter.referenceUrl} target="_blank" rel="noopener noreferrer" className={`${btn} border border-[#2e2640] text-[#fbf4e6] hover:bg-[#181320]`}>
                  Open original
                </a>
                <button type="button" onClick={() => setPreviewCharacter(null)} className="rounded-xl px-4 py-2 text-sm font-bold text-[#b3a7c4] hover:text-[#fbf4e6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd23f]">
                  Close
                </button>
              </div>
            </aside>
          </div>
        </div>
      ) : null}
    </div>
  );
};
