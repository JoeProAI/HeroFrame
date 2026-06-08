"use client";

import { useMemo, useState } from "react";
import { frontEndDesignTemplate, heroFightLeagueTemplate } from "@/lib/workflow-templates";

type PipelineStatus = "idle" | "loading" | "success" | "error";

type RunSummary = {
  _id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  createdAt: number;
  input: { title: string; storyBeat: string; styleHint?: string };
};

type BootstrapPayload = {
  projectId: string;
  heroWorkflowId?: string;
  designWorkflowId?: string;
  workflowId?: string;
  ownerId: string;
};

const statusColor: Record<RunSummary["status"], string> = {
  queued: "bg-[#ffd23f] text-[#05040a]",
  running: "bg-[#2ec4b6] text-[#05040a]",
  succeeded: "bg-[#4ade80] text-[#05040a]",
  failed: "bg-[#ff5a3c] text-[#fbf4e6]",
};

const card = "rounded-2xl border border-[#2e2640] bg-[#181320] p-5";
const label = "text-[11px] font-bold uppercase tracking-[0.16em] text-[#b3a7c4]";
const field =
  "min-h-11 rounded-xl border border-[#2e2640] bg-[#0c0a12] px-3 text-sm text-[#fbf4e6] placeholder:text-[#6b6480] outline-none transition focus-visible:border-[#ffd23f] focus-visible:ring-1 focus-visible:ring-[#ffd23f]";

const btn =
  "inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-bold transition hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd23f] disabled:cursor-not-allowed disabled:opacity-40 disabled:translate-y-0";

const isImageUrl = (url: string): boolean => /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(url);

export const AppShell = () => {
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [sceneTitle, setSceneTitle] = useState("");
  const [storyBeat, setStoryBeat] = useState("");
  const [styleHint, setStyleHint] = useState("");
  const [status, setStatus] = useState<PipelineStatus>("idle");
  const [message, setMessage] = useState("");
  const [resultUrl, setResultUrl] = useState("");

  const isReady = useMemo(() => bootstrap !== null, [bootstrap]);
  const canQueue = isReady && sceneTitle.trim().length > 0 && storyBeat.trim().length > 0;

  const bootstrapWorkspace = async () => {
    setStatus("loading");
    setMessage("Creating project and workflows in Convex...");
    try {
      const response = await fetch("/api/bootstrap", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as
        | BootstrapPayload
        | { error?: string }
        | null;
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

  const queueRun = async () => {
    if (!bootstrap) return;
    const workflowId = bootstrap.heroWorkflowId ?? bootstrap.workflowId;
    if (!workflowId) {
      setStatus("error");
      setMessage("Workflow id missing. Re-run bootstrap.");
      return;
    }
    setStatus("loading");
    setMessage("Queueing run...");
    try {
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: bootstrap.projectId,
          workflowId,
          triggeredBy: bootstrap.ownerId,
          title: sceneTitle,
          storyBeat,
          styleHint: styleHint || undefined,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { runId?: string; error?: string } | null;
      if (!response.ok || !payload?.runId) {
        throw new Error(payload?.error ?? `Run creation failed (HTTP ${response.status}).`);
      }
      setStatus("success");
      setMessage(`Run created (${payload.runId}).`);
      await loadRuns();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Run creation failed.");
    }
  };

  const generateFrame = async () => {
    if (!sceneTitle.trim() || !storyBeat.trim()) {
      setStatus("error");
      setMessage("Add a scene title and story beat first.");
      return;
    }
    setStatus("loading");
    setMessage("Sending request to WaveSpeed...");
    setResultUrl("");
    try {
      const response = await fetch("/api/wavespeed/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "image",
          runId: bootstrap?.projectId ?? "adhoc",
          prompt: `${sceneTitle}. ${storyBeat}`,
          styleHint: styleHint || undefined,
          strategy: { speed: "balanced", async: true },
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: unknown; data?: { output?: string; data?: { outputs?: Array<{ url?: string }> } } }
        | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(
          typeof payload?.error === "string" ? payload.error : `WaveSpeed request failed (HTTP ${response.status}).`,
        );
      }
      const url = payload.data?.output ?? payload.data?.data?.outputs?.at(0)?.url ?? "";
      setResultUrl(url);
      setStatus("success");
      setMessage(url ? "Generation returned a preview." : "Request accepted. Result will arrive via webhook.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "WaveSpeed request failed.");
    }
  };

  const publishToGhost = async () => {
    if (!sceneTitle.trim()) {
      setStatus("error");
      setMessage("Add a title before publishing.");
      return;
    }
    setStatus("loading");
    setMessage("Publishing draft to Ghost...");
    setResultUrl("");
    try {
      const response = await fetch("/api/ghost/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: sceneTitle, storyBeat, styleHint: styleHint || undefined, status: "draft" }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; post?: { url: string }; error?: string }
        | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? `Ghost publish failed (HTTP ${response.status}).`);
      }
      setResultUrl(payload.post?.url ?? "");
      setStatus("success");
      setMessage("Draft published to Ghost.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Ghost publish failed.");
    }
  };

  const feedbackColor =
    status === "error"
      ? "border-[#ff5a3c] bg-[#ff5a3c]/12 text-[#ff8c79]"
      : status === "success"
        ? "border-[#4ade80] bg-[#4ade80]/12 text-[#86efac]"
        : "border-[#2e2640] bg-[#0c0a12] text-[#b3a7c4]";

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-8 sm:px-6 lg:py-12">
      {/* HERO — full width, asymmetric: bold type left, cel-stack graphic right */}
      <header className="grid items-stretch gap-5 lg:grid-cols-12">
        <div className="lg:col-span-8 overflow-hidden rounded-3xl border border-[#2e2640] bg-[#181320] p-7 sm:p-9">
          <span className="inline-block rounded-full bg-[#ffd23f] px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#05040a]">
            Ages of Cartoons
          </span>
          <h1 className="mt-5 font-[family-name:var(--font-bricolage)] text-5xl font-black uppercase leading-[0.88] tracking-tight sm:text-6xl lg:text-7xl">
            <span className="block text-[#fbf4e6]">Heroframe</span>
            <span className="block text-[#ff5a3c]">cartoon</span>
            <span className="block text-[#2ec4b6]">maker.</span>
          </h1>
          <p className="mt-5 max-w-lg text-sm leading-6 text-[#b3a7c4] sm:text-base">
            Compose a scene, push it through a workflow, generate a frame, or publish a draft. Every button hits a real
            backend route and tells you exactly what happened.
          </p>
        </div>

        {/* Decorative stacked cels + art slot */}
        <div className="lg:col-span-4 grid gap-5">
          <div className="relative h-44 overflow-hidden rounded-3xl border border-[#2e2640] bg-[#0c0a12]">
            <div className="absolute left-6 top-7 h-24 w-24 -rotate-6 rounded-2xl border-[3px] border-[#05040a] bg-[#8a5cff]" />
            <div className="absolute left-20 top-10 h-24 w-24 rotate-3 rounded-2xl border-[3px] border-[#05040a] bg-[#ff5a3c]" />
            <div className="absolute left-36 top-6 h-24 w-24 -rotate-3 rounded-2xl border-[3px] border-[#05040a] bg-[#2ec4b6]" />
            <div className="absolute bottom-3 right-4 rounded-full bg-[#ffd23f] px-2 py-0.5 text-[10px] font-black uppercase text-[#05040a]">
              cels
            </div>
          </div>
          <div className="relative flex h-44 items-center justify-center overflow-hidden rounded-3xl border border-[#2e2640] bg-[#0c0a12]">
            {resultUrl && isImageUrl(resultUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resultUrl} alt="Generated frame preview" className="h-full w-full object-cover" />
            ) : (
              <p className="px-4 text-center text-xs text-[#6b6480]">
                Art slot — generated frame previews appear here.
              </p>
            )}
          </div>
        </div>
      </header>

      {/* WORK ROW — Compose (wide) + Runs (narrow) */}
      <section className="grid gap-5 lg:grid-cols-12">
        <div className={`${card} lg:col-span-8 border-t-4 border-t-[#ff5a3c]`}>
          <h2 className="font-[family-name:var(--font-bricolage)] text-xl font-extrabold">Compose</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <label className={label} htmlFor="scene-title">Scene title</label>
              <input id="scene-title" value={sceneTitle} onChange={(e) => setSceneTitle(e.target.value)} placeholder="e.g. Rooftop duel at dusk" className={field} />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <label className={label} htmlFor="story-beat">Story beat</label>
              <textarea id="story-beat" value={storyBeat} onChange={(e) => setStoryBeat(e.target.value)} placeholder="What happens in this scene?" className={`${field} min-h-28 py-2`} />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <label className={label} htmlFor="style-hint">Style hint (optional)</label>
              <input id="style-hint" value={styleHint} onChange={(e) => setStyleHint(e.target.value)} placeholder="e.g. bold outlines, saturated color" className={field} />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={bootstrapWorkspace} disabled={status === "loading"} className={`${btn} bg-[#ffd23f] text-[#05040a] hover:bg-[#ffdd66]`}>
              {isReady ? "Re-bootstrap" : "Bootstrap workspace"}
            </button>
            <button type="button" onClick={queueRun} disabled={!canQueue || status === "loading"} className={`${btn} bg-[#2ec4b6] text-[#05040a] hover:bg-[#43d6c8]`}>
              Queue run
            </button>
            <button type="button" onClick={generateFrame} disabled={status === "loading"} className={`${btn} bg-[#ff5a3c] text-[#fbf4e6] hover:bg-[#ff7259]`}>
              Generate frame
            </button>
            <button type="button" onClick={publishToGhost} disabled={status === "loading"} className={`${btn} bg-[#8a5cff] text-[#fbf4e6] hover:bg-[#9d75ff]`}>
              Publish to Ghost
            </button>
            <button type="button" onClick={() => loadRuns()} disabled={!isReady || status === "loading"} className={`${btn} border border-[#2e2640] bg-transparent text-[#fbf4e6] hover:bg-[#1f1830]`}>
              Refresh
            </button>
          </div>

          {message ? (
            <div className={`mt-4 rounded-xl border px-3 py-2 text-sm font-medium ${feedbackColor}`} role="status">
              {message}
            </div>
          ) : null}

          {resultUrl ? (
            <a href={resultUrl} target="_blank" rel="noopener noreferrer" className="mt-2 block break-all text-sm font-medium text-[#2ec4b6] underline-offset-4 hover:underline">
              {resultUrl}
            </a>
          ) : null}
        </div>

        <aside className={`${card} lg:col-span-4 border-t-4 border-t-[#2ec4b6]`}>
          <h2 className="font-[family-name:var(--font-bricolage)] text-xl font-extrabold">Runs</h2>
          <div className="mt-4 space-y-2">
            {!isReady ? (
              <p className="text-sm text-[#6b6480]">Bootstrap the workspace to load runs.</p>
            ) : runs.length === 0 ? (
              <p className="text-sm text-[#6b6480]">No runs yet. Compose a scene and queue a run.</p>
            ) : (
              runs.map((run) => (
                <article key={run._id} className="rounded-xl border border-[#2e2640] bg-[#0c0a12] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-[#fbf4e6]">{run.input.title}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${statusColor[run.status]}`}>
                      {run.status}
                    </span>
                  </div>
                  {run.input.storyBeat ? <p className="mt-1 text-xs text-[#b3a7c4]">{run.input.storyBeat}</p> : null}
                  <p className="mt-2 text-[11px] text-[#6b6480]">{new Date(run.createdAt).toLocaleString()}</p>
                </article>
              ))
            )}
          </div>
        </aside>
      </section>

      {/* WORKFLOWS — two colored cards */}
      <section className="grid gap-5 lg:grid-cols-2">
        {[
          { title: "Hero workflow", accent: "#8a5cff", chip: "Production", steps: heroFightLeagueTemplate.steps },
          { title: "Front-end design workflow", accent: "#ffd23f", chip: "Design", steps: frontEndDesignTemplate.steps },
        ].map((workflow) => (
          <div key={workflow.title} className={`${card}`} style={{ borderTop: `4px solid ${workflow.accent}` }}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-[family-name:var(--font-bricolage)] text-xl font-extrabold">{workflow.title}</h2>
              <span className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase text-[#05040a]" style={{ background: workflow.accent }}>
                {workflow.chip}
              </span>
            </div>
            <ol className="mt-4 grid gap-1.5">
              {workflow.steps.map((step, index) => (
                <li key={step.id} className="flex items-center gap-3 rounded-lg border border-[#2e2640] bg-[#0c0a12] px-3 py-2">
                  <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[11px] font-black text-[#05040a]" style={{ background: workflow.accent }}>
                    {index + 1}
                  </span>
                  <span className="flex-1 text-sm text-[#fbf4e6]">{step.label}</span>
                  {!step.required ? <span className="text-[10px] uppercase text-[#6b6480]">optional</span> : null}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </section>
    </main>
  );
};
