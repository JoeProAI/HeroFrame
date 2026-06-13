"use client";

import { useEffect, useState } from "react";
import { runKieGeneration } from "@/lib/kie/run-client";
import { useCharacters } from "@/lib/use-characters";
import { useStylePresets } from "@/lib/use-style-presets";
import { useFrames, type Frame } from "@/lib/use-frames";
import { buildFightShots, expandShots } from "@/lib/shots";
import { modelCatalog, defaultModel } from "@/lib/kie/models";

type Status = "idle" | "loading" | "success" | "error";
type Speed = "fast" | "balanced" | "quality";
type Tab = "cast" | "scenes" | "fight" | "frames" | "history";

const panel = "rounded-2xl border border-[#2e2640] bg-[#181320]/70 backdrop-blur-sm";
const labelCls = "text-[11px] font-bold uppercase tracking-[0.16em] text-[#b3a7c4]";
const field =
  "min-h-11 w-full rounded-xl border border-[#2e2640] bg-[#0c0a12] px-3 text-sm text-[#fbf4e6] placeholder:text-[#6b6480] outline-none transition focus-visible:border-[#ffd23f] focus-visible:ring-1 focus-visible:ring-[#ffd23f]";
const btn =
  "inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-bold transition hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd23f] disabled:cursor-not-allowed disabled:opacity-40 disabled:translate-y-0";

const tabs: { id: Tab; label: string; dot: string }[] = [
  { id: "cast", label: "Cast", dot: "#8a5cff" },
  { id: "scenes", label: "Scenes", dot: "#ff5a3c" },
  { id: "fight", label: "Versus", dot: "#2ec4b6" },
  { id: "frames", label: "Frames", dot: "#ffd23f" },
  { id: "history", label: "History", dot: "#9aa6bd" },
];

const speeds: Speed[] = ["fast", "balanced", "quality"];

const isVideoUrl = (url: string): boolean => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);

export const AppShell = () => {
  const { characters, deleted, activeCharacter, activeId, setActiveId, addCharacter, removeCharacter, restoreCharacter, purgeCharacter, loadDeleted } = useCharacters();
  const { presets, activePreset, activeId: presetId, setActiveId: setPresetId, addPreset } = useStylePresets();
  const { frames, history, addFrame, clearFrames } = useFrames();

  const [tab, setTab] = useState<Tab>("cast");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [speed, setSpeed] = useState<Speed>("balanced");
  const [credits, setCredits] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

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

  // Fight
  const [fighterAId, setFighterAId] = useState<string>("");
  const [fighterBId, setFighterBId] = useState<string>("");
  const [arena, setArena] = useState("");

  const busy = status === "loading";
  const styleHint = activePreset?.text;

  const refreshCredits = async () => {
    try {
      const response = await fetch("/api/kie/credits");
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; credits?: number | null } | null;
      if (response.ok && payload?.ok) setCredits(payload.credits ?? null);
    } catch {
      // non-fatal
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshCredits();
  }, []);

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
      const response = await fetch("/api/kie/upload", {
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
  const generateImage = async (prompt: string, refs?: string[]) =>
    runKieGeneration({
      prompt: refs?.length ? `Keep the same character(s) from the reference image(s). ${prompt}` : prompt,
      styleHint,
      speed,
      mode: refs?.length ? "image-edit" : "image",
      model: refs?.length ? editModel : imageModel,
      imageUrls: refs,
      onProgress: (s) => setMessage(`Working... (${s})`),
    });

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
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Animation failed.");
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
        <nav className="mt-8 flex flex-col gap-1">
          {tabs.map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${tab === t.id ? "bg-[#181320] text-[#fbf4e6]" : "text-[#b3a7c4] hover:bg-[#181320] hover:text-[#fbf4e6]"}`}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.dot }} />
              {t.label}
            </button>
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
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-[#2e2640] bg-[#0c0a12]/85 px-5 py-3 backdrop-blur sm:px-8">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-[#ffd23f] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#05040a]">Ages of Cartoons</span>
            <h1 className="font-[family-name:var(--font-bricolage)] text-lg font-black uppercase tracking-tight sm:text-xl">Cartoon Studio</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Image model */}
            <select value={imageModel} onChange={(e) => setImageModel(e.target.value)} title="Text-to-image model" className="min-h-9 rounded-lg border border-[#2e2640] bg-[#0c0a12] px-2 text-xs text-[#fbf4e6]">
              {modelCatalog.image.map((m) => <option key={m.id} value={m.id}>img: {m.label}</option>)}
            </select>
            {/* Edit model */}
            <select value={editModel} onChange={(e) => setEditModel(e.target.value)} title="Character-reference (image-to-image) model" className="min-h-9 rounded-lg border border-[#2e2640] bg-[#0c0a12] px-2 text-xs text-[#fbf4e6]">
              {modelCatalog["image-edit"].map((m) => <option key={m.id} value={m.id}>ref: {m.label}</option>)}
            </select>
            {/* Video model */}
            <select value={videoModel} onChange={(e) => setVideoModel(e.target.value)} title="Image-to-video model" className="min-h-9 rounded-lg border border-[#2e2640] bg-[#0c0a12] px-2 text-xs text-[#fbf4e6]">
              {modelCatalog.video.map((m) => <option key={m.id} value={m.id}>vid: {m.label}</option>)}
            </select>
            {/* Style preset selector */}
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

        <div className="flex-1 p-5 sm:p-8">
          {message ? <div className={`mb-5 rounded-xl border px-3 py-2 text-sm font-medium ${feedbackColor}`} role="status">{message}</div> : null}

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
                          <img src={`/bg/${name}.png`} alt="Sample cartoon style" className="aspect-square w-full object-cover" />
                        </figure>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {characters.map((c) => (
                      <div key={c.id} className={`flex gap-3 rounded-xl border p-3 ${c.id === activeId ? "border-[#8a5cff] bg-[#8a5cff]/10" : "border-[#2e2640] bg-[#0c0a12]"}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={c.referenceUrl} alt={c.name} className="h-16 w-16 flex-none rounded-lg border border-[#2e2640] object-cover" />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-sm font-bold text-[#fbf4e6]">{c.name}</span>
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
                <div className="mt-4 flex flex-wrap gap-2">
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
    </div>
  );
};
