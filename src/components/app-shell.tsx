"use client";

import { useState } from "react";
import { frontEndDesignTemplate, heroFightLeagueTemplate } from "@/lib/workflow-templates";
import { runKieGeneration } from "@/lib/kie/run-client";
import { useCharacters } from "@/lib/use-characters";

type PipelineStatus = "idle" | "loading" | "success" | "error";
type Speed = "fast" | "balanced" | "quality";

type RunSummary = {
  _id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  createdAt: number;
  input: { title: string; storyBeat: string; styleHint?: string };
};

type Frame = {
  id: string;
  url: string;
  prompt: string;
  characterName?: string;
  createdAt: number;
};

type BootstrapPayload = {
  projectId: string;
  heroWorkflowId?: string;
  workflowId?: string;
  ownerId: string;
};

const statusColor: Record<RunSummary["status"], string> = {
  queued: "bg-[#ffd23f] text-[#05040a]",
  running: "bg-[#2ec4b6] text-[#05040a]",
  succeeded: "bg-[#4ade80] text-[#05040a]",
  failed: "bg-[#ff5a3c] text-[#fbf4e6]",
};

const panel = "rounded-2xl border border-[#2e2640] bg-[#181320]";
const labelCls = "text-[11px] font-bold uppercase tracking-[0.16em] text-[#b3a7c4]";
const field =
  "min-h-11 w-full rounded-xl border border-[#2e2640] bg-[#0c0a12] px-3 text-sm text-[#fbf4e6] placeholder:text-[#6b6480] outline-none transition focus-visible:border-[#ffd23f] focus-visible:ring-1 focus-visible:ring-[#ffd23f]";
const btn =
  "inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-bold transition hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd23f] disabled:cursor-not-allowed disabled:opacity-40 disabled:translate-y-0";

const navItems = [
  { id: "cast", label: "Cast", dot: "#8a5cff" },
  { id: "compose", label: "Compose", dot: "#ff5a3c" },
  { id: "frames", label: "Frames", dot: "#ffd23f" },
  { id: "workflows", label: "Workflows", dot: "#2ec4b6" },
];

const speeds: Speed[] = ["fast", "balanced", "quality"];

export const AppShell = () => {
  const { characters, activeCharacter, activeId, setActiveId, addCharacter, removeCharacter } = useCharacters();

  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);

  // Character creation
  const [charName, setCharName] = useState("");
  const [charPrompt, setCharPrompt] = useState("");
  const [charUrl, setCharUrl] = useState("");

  // Scene composition
  const [sceneTitle, setSceneTitle] = useState("");
  const [storyBeat, setStoryBeat] = useState("");
  const [styleHint, setStyleHint] = useState("");
  const [speed, setSpeed] = useState<Speed>("balanced");

  const [status, setStatus] = useState<PipelineStatus>("idle");
  const [message, setMessage] = useState("");
  const [frames, setFrames] = useState<Frame[]>([]);

  const isReady = bootstrap !== null;
  const canScene = sceneTitle.trim().length > 0 && storyBeat.trim().length > 0;

  const addFrame = (url: string, prompt: string, characterName?: string) => {
    setFrames((prev) => [
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, url, prompt, characterName, createdAt: Date.now() },
      ...prev,
    ]);
  };

  // ---- Character creation -------------------------------------------------
  const createCharacterFromUrl = () => {
    if (!charName.trim() || !charUrl.trim()) {
      setStatus("error");
      setMessage("Give the character a name and a reference image URL.");
      return;
    }
    addCharacter(charName, charUrl.trim());
    setCharName("");
    setCharUrl("");
    setStatus("success");
    setMessage("Character saved from URL.");
  };

  const createCharacterFromPrompt = async () => {
    if (!charName.trim() || !charPrompt.trim()) {
      setStatus("error");
      setMessage("Give the character a name and a reference prompt.");
      return;
    }
    setStatus("loading");
    setMessage(`Generating reference for ${charName.trim()}...`);
    try {
      const url = await runKieGeneration({
        prompt: `Full-body character reference sheet, single character, neutral background: ${charPrompt.trim()}`,
        styleHint: styleHint || undefined,
        speed,
        mode: "image",
        onProgress: (state) => setMessage(`Generating reference... (${state})`),
      });
      addCharacter(charName, url, charPrompt.trim());
      setCharName("");
      setCharPrompt("");
      setStatus("success");
      setMessage("Reference generated and character saved.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Reference generation failed.");
    }
  };

  // ---- Scene generation (character-aware) ---------------------------------
  const generateScene = async () => {
    if (!canScene) {
      setStatus("error");
      setMessage("Add a scene title and story beat first.");
      return;
    }
    const prompt = [sceneTitle.trim(), storyBeat.trim()].filter(Boolean).join(". ");
    setStatus("loading");
    setMessage(
      activeCharacter
        ? `Generating scene with ${activeCharacter.name}...`
        : "Generating scene (no character selected)...",
    );
    try {
      const url = await runKieGeneration({
        prompt: activeCharacter
          ? `Keep the same character from the reference image. New scene: ${prompt}`
          : prompt,
        styleHint: styleHint || undefined,
        speed,
        mode: activeCharacter ? "image-edit" : "image",
        imageUrls: activeCharacter ? [activeCharacter.referenceUrl] : undefined,
        onProgress: (state) => setMessage(`Generating scene... (${state})`),
      });
      addFrame(url, prompt, activeCharacter?.name);
      setStatus("success");
      setMessage(activeCharacter ? `Scene generated with ${activeCharacter.name}.` : "Scene generated.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Scene generation failed.");
    }
  };

  // ---- Convex-backed workspace (optional) ---------------------------------
  const bootstrapWorkspace = async () => {
    setStatus("loading");
    setMessage("Creating project and workflows in Convex...");
    try {
      const response = await fetch("/api/bootstrap", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as BootstrapPayload | { error?: string } | null;
      if (!response.ok || !payload || "error" in payload) {
        throw new Error((payload as { error?: string })?.error ?? `Bootstrap failed (HTTP ${response.status}).`);
      }
      setBootstrap(payload as BootstrapPayload);
      setStatus("success");
      setMessage("Workspace ready.");
      await loadRuns((payload as BootstrapPayload).projectId);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Bootstrap failed.");
    }
  };

  const loadRuns = async (projectIdArg?: string) => {
    const projectId = projectIdArg ?? bootstrap?.projectId;
    if (!projectId) return;
    try {
      const response = await fetch(`/api/runs?projectId=${encodeURIComponent(projectId)}`);
      const payload = (await response.json().catch(() => null)) as { runs?: RunSummary[]; error?: string } | null;
      if (!response.ok || !payload || payload.error) {
        throw new Error(payload?.error ?? `Failed to load runs (HTTP ${response.status}).`);
      }
      setRuns(payload.runs ?? []);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Failed to load runs.");
    }
  };

  const feedbackColor =
    status === "error"
      ? "border-[#ff5a3c] bg-[#ff5a3c]/12 text-[#ff8c79]"
      : status === "success"
        ? "border-[#4ade80] bg-[#4ade80]/12 text-[#86efac]"
        : "border-[#2e2640] bg-[#0c0a12] text-[#b3a7c4]";

  const statusDot =
    status === "error" ? "#ff5a3c" : status === "success" ? "#4ade80" : status === "loading" ? "#ffd23f" : "#6b6480";

  return (
    <div className="flex min-h-screen w-full">
      <aside className="sticky top-0 hidden h-screen w-60 flex-none flex-col border-r border-[#2e2640] bg-[#0c0a12]/80 p-5 lg:flex">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ff5a3c] font-[family-name:var(--font-bricolage)] text-lg font-black text-[#05040a]">H</span>
          <div>
            <p className="font-[family-name:var(--font-bricolage)] text-base font-black leading-none">Heroframe</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#6b6480]">Cartoon maker</p>
          </div>
        </div>
        <nav className="mt-8 flex flex-col gap-1">
          {navItems.map((item) => (
            <a key={item.id} href={`#${item.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#b3a7c4] transition hover:bg-[#181320] hover:text-[#fbf4e6]">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.dot }} />
              {item.label}
            </a>
          ))}
        </nav>
        <div className="mt-auto rounded-xl border border-[#2e2640] bg-[#181320] p-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: statusDot }} />
            <p className="text-xs font-semibold text-[#fbf4e6]">{status}</p>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-[#6b6480]">
            {characters.length} cast · {frames.length} frame{frames.length === 1 ? "" : "s"}
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[#2e2640] bg-[#0c0a12]/85 px-5 py-3 backdrop-blur sm:px-8">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-[#ffd23f] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#05040a]">Ages of Cartoons</span>
            <h1 className="font-[family-name:var(--font-bricolage)] text-lg font-black uppercase tracking-tight sm:text-xl">Character Studio</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-[#6b6480] sm:inline">Active hero:</span>
            <span className="rounded-full border border-[#2e2640] px-3 py-1 text-xs font-bold text-[#fbf4e6]">
              {activeCharacter ? activeCharacter.name : "none"}
            </span>
          </div>
        </header>

        <div className="grid flex-1 grid-cols-1 gap-5 p-5 sm:p-8 xl:grid-cols-12">
          {/* CAST — character library + creation */}
          <section id="cast" className={`${panel} border-t-4 border-t-[#8a5cff] p-6 xl:col-span-4`}>
            <h2 className="font-[family-name:var(--font-bricolage)] text-xl font-extrabold">Cast</h2>
            <p className="mt-1 text-xs text-[#6b6480]">Save a hero once. Reuse the same look across every scene.</p>

            <div className="mt-4 grid gap-3 rounded-xl border border-[#2e2640] bg-[#0c0a12] p-4">
              <div className="grid gap-2">
                <label className={labelCls} htmlFor="char-name">Character name</label>
                <input id="char-name" value={charName} onChange={(e) => setCharName(e.target.value)} placeholder="e.g. Captain Rook" className={field} />
              </div>
              <div className="grid gap-2">
                <label className={labelCls} htmlFor="char-prompt">Describe the hero (to generate a reference)</label>
                <textarea id="char-prompt" value={charPrompt} onChange={(e) => setCharPrompt(e.target.value)} placeholder="e.g. stocky knight, copper armor, scar over left eye, teal cape" className={`${field} min-h-20 py-2`} />
              </div>
              <button type="button" onClick={createCharacterFromPrompt} disabled={status === "loading"} className={`${btn} bg-[#8a5cff] text-[#fbf4e6] hover:bg-[#9d75ff]`}>
                Generate reference + save
              </button>
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[#6b6480]">
                <span className="h-px flex-1 bg-[#2e2640]" /> or paste a URL <span className="h-px flex-1 bg-[#2e2640]" />
              </div>
              <input value={charUrl} onChange={(e) => setCharUrl(e.target.value)} placeholder="https://image-url..." className={field} />
              <button type="button" onClick={createCharacterFromUrl} disabled={status === "loading"} className={`${btn} border border-[#2e2640] bg-transparent text-[#fbf4e6] hover:bg-[#181320]`}>
                Save from URL
              </button>
            </div>

            <div className="mt-4 grid gap-2">
              {characters.length === 0 ? (
                <p className="text-sm text-[#6b6480]">No characters yet. Create your first hero above.</p>
              ) : (
                characters.map((character) => (
                  <button
                    key={character.id}
                    type="button"
                    onClick={() => setActiveId(character.id)}
                    className={`flex items-center gap-3 rounded-xl border p-2 text-left transition ${
                      character.id === activeId ? "border-[#8a5cff] bg-[#8a5cff]/10" : "border-[#2e2640] bg-[#0c0a12] hover:border-[#8a5cff]"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={character.referenceUrl} alt={character.name} className="h-12 w-12 flex-none rounded-lg border border-[#2e2640] object-cover" />
                    <span className="flex-1 text-sm font-bold text-[#fbf4e6]">{character.name}</span>
                    {character.id === activeId ? <span className="rounded-full bg-[#8a5cff] px-2 py-0.5 text-[10px] font-black uppercase text-[#fbf4e6]">active</span> : null}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); removeCharacter(character.id); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); removeCharacter(character.id); } }}
                      className="rounded-lg px-2 py-1 text-xs text-[#6b6480] transition hover:text-[#ff5a3c]"
                    >
                      remove
                    </span>
                  </button>
                ))
              )}
            </div>
          </section>

          {/* COMPOSE — scene generation */}
          <section id="compose" className={`${panel} border-t-4 border-t-[#ff5a3c] p-6 xl:col-span-4`}>
            <h2 className="font-[family-name:var(--font-bricolage)] text-xl font-extrabold">Compose scene</h2>
            <div className="mt-4 grid gap-3">
              <div className="grid gap-2">
                <label className={labelCls} htmlFor="scene-title">Scene title</label>
                <input id="scene-title" value={sceneTitle} onChange={(e) => setSceneTitle(e.target.value)} placeholder="e.g. Rooftop standoff" className={field} />
              </div>
              <div className="grid gap-2">
                <label className={labelCls} htmlFor="story-beat">Story beat</label>
                <textarea id="story-beat" value={storyBeat} onChange={(e) => setStoryBeat(e.target.value)} placeholder="What happens in this scene?" className={`${field} min-h-24 py-2`} />
              </div>
              <div className="grid gap-2">
                <label className={labelCls} htmlFor="style-hint">Style hint (optional)</label>
                <input id="style-hint" value={styleHint} onChange={(e) => setStyleHint(e.target.value)} placeholder="e.g. bold outlines, saturated color" className={field} />
              </div>
              <div className="grid gap-2">
                <span className={labelCls}>Quality / speed</span>
                <div className="flex gap-2">
                  {speeds.map((s) => (
                    <button key={s} type="button" onClick={() => setSpeed(s)} className={`flex-1 rounded-xl border px-3 py-2 text-xs font-bold capitalize transition ${speed === s ? "border-[#2ec4b6] bg-[#2ec4b6] text-[#05040a]" : "border-[#2e2640] bg-[#0c0a12] text-[#b3a7c4] hover:text-[#fbf4e6]"}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-[#2e2640] bg-[#0c0a12] p-3 text-xs text-[#b3a7c4]">
              {activeCharacter ? (
                <>Scene will keep <span className="font-bold text-[#8a5cff]">{activeCharacter.name}</span> consistent via the saved reference.</>
              ) : (
                <>No active character — this generates a fresh image. Select a hero in Cast for consistency.</>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={generateScene} disabled={!canScene || status === "loading"} className={`${btn} bg-[#ff5a3c] text-[#fbf4e6] hover:bg-[#ff7259]`}>
                Generate scene
              </button>
            </div>

            {message ? <div className={`mt-4 rounded-xl border px-3 py-2 text-sm font-medium ${feedbackColor}`} role="status">{message}</div> : null}
          </section>

          {/* ACTIVE REFERENCE preview */}
          <aside className={`${panel} overflow-hidden border-t-4 border-t-[#2ec4b6] xl:col-span-4`}>
            <div className="flex items-center justify-between p-6 pb-3">
              <h2 className="font-[family-name:var(--font-bricolage)] text-xl font-extrabold">Reference</h2>
              <span className="rounded-full bg-[#2ec4b6] px-2 py-0.5 text-[10px] font-black uppercase text-[#05040a]">model sheet</span>
            </div>
            <div className="relative flex min-h-64 items-center justify-center border-t border-[#2e2640] bg-[#0c0a12]">
              {activeCharacter ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={activeCharacter.referenceUrl} alt={activeCharacter.name} className="h-full w-full object-contain" />
              ) : (
                <p className="px-6 text-center text-xs text-[#6b6480]">Select or create a character to lock a reference.</p>
              )}
            </div>
          </aside>

          {/* FRAMES */}
          <section id="frames" className={`${panel} border-t-4 border-t-[#ffd23f] p-6 xl:col-span-8`}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-[family-name:var(--font-bricolage)] text-xl font-extrabold">Frames</h2>
              {frames.length > 0 ? (
                <button type="button" onClick={() => setFrames([])} className="rounded-full border border-[#2e2640] px-3 py-1 text-[11px] font-bold uppercase text-[#b3a7c4] transition hover:text-[#fbf4e6]">Clear</button>
              ) : null}
            </div>
            {frames.length === 0 ? (
              <div className="mt-4 flex min-h-64 items-center justify-center rounded-xl border border-dashed border-[#2e2640] bg-[#0c0a12] text-center">
                <p className="px-6 text-sm text-[#6b6480]">Generated scenes land here, tagged with the character used.</p>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                {frames.map((frame) => (
                  <figure key={frame.id} className="overflow-hidden rounded-xl border border-[#2e2640] bg-[#0c0a12]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={frame.url} alt={frame.prompt} className="aspect-square w-full object-cover" />
                    <figcaption className="flex items-center justify-between gap-2 p-3">
                      {frame.characterName ? (
                        <span className="rounded-full bg-[#8a5cff] px-2 py-0.5 text-[10px] font-black uppercase text-[#fbf4e6]">{frame.characterName}</span>
                      ) : (
                        <span className="rounded-full bg-[#2e2640] px-2 py-0.5 text-[10px] font-black uppercase text-[#b3a7c4]">no char</span>
                      )}
                      <div className="flex gap-2">
                        <a href={frame.url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-[#2ec4b6] hover:underline">Open</a>
                        <a href={frame.url} download className="text-xs font-bold text-[#ffd23f] hover:underline">Download</a>
                      </div>
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </section>

          {/* WORKSPACE (Convex-backed, optional) */}
          <aside className={`${panel} border-t-4 border-t-[#2ec4b6] p-6 xl:col-span-4`}>
            <h2 className="font-[family-name:var(--font-bricolage)] text-xl font-extrabold">Workspace</h2>
            <p className="mt-1 text-xs text-[#6b6480]">Optional Convex-backed run log.</p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={bootstrapWorkspace} disabled={status === "loading"} className={`${btn} bg-[#ffd23f] text-[#05040a] hover:bg-[#ffdd66]`}>{isReady ? "Re-bootstrap" : "Bootstrap"}</button>
              <button type="button" onClick={() => loadRuns()} disabled={!isReady || status === "loading"} className={`${btn} border border-[#2e2640] bg-transparent text-[#fbf4e6] hover:bg-[#181320]`}>Refresh</button>
            </div>
            <div className="mt-4 space-y-2">
              {!isReady ? (
                <p className="text-sm text-[#6b6480]">Not connected.</p>
              ) : runs.length === 0 ? (
                <p className="text-sm text-[#6b6480]">No runs yet.</p>
              ) : (
                runs.map((run) => (
                  <article key={run._id} className="rounded-xl border border-[#2e2640] bg-[#0c0a12] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold text-[#fbf4e6]">{run.input.title}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${statusColor[run.status]}`}>{run.status}</span>
                    </div>
                    <p className="mt-2 text-[11px] text-[#6b6480]">{new Date(run.createdAt).toLocaleString()}</p>
                  </article>
                ))
              )}
            </div>
          </aside>

          {/* WORKFLOWS */}
          <section id="workflows" className="grid gap-5 xl:col-span-12 xl:grid-cols-2">
            {[
              { title: "Hero workflow", accent: "#8a5cff", chip: "Production", steps: heroFightLeagueTemplate.steps },
              { title: "Front-end design workflow", accent: "#ffd23f", chip: "Design", steps: frontEndDesignTemplate.steps },
            ].map((workflow) => (
              <div key={workflow.title} className={`${panel} p-6`} style={{ borderTop: `4px solid ${workflow.accent}` }}>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-[family-name:var(--font-bricolage)] text-lg font-extrabold">{workflow.title}</h2>
                  <span className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase text-[#05040a]" style={{ background: workflow.accent }}>{workflow.chip}</span>
                </div>
                <ol className="mt-4 grid gap-1.5">
                  {workflow.steps.map((step, index) => (
                    <li key={step.id} className="flex items-center gap-3 rounded-lg border border-[#2e2640] bg-[#0c0a12] px-3 py-2">
                      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[11px] font-black text-[#05040a]" style={{ background: workflow.accent }}>{index + 1}</span>
                      <span className="flex-1 text-sm text-[#fbf4e6]">{step.label}</span>
                      {!step.required ? <span className="text-[10px] uppercase text-[#6b6480]">opt</span> : null}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
};
