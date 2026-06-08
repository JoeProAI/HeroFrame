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
  queued: "bg-amber-100 text-amber-800",
  running: "bg-sky-100 text-sky-800",
  succeeded: "bg-emerald-100 text-emerald-800",
  failed: "bg-rose-100 text-rose-800",
};

const card = "rounded-2xl border border-zinc-200 bg-white p-5";
const label = "text-xs font-semibold uppercase tracking-wide text-zinc-500";
const input =
  "min-h-11 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus-visible:border-zinc-900 focus-visible:ring-1 focus-visible:ring-zinc-900";
const primaryBtn =
  "inline-flex min-h-11 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white transition hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 disabled:cursor-not-allowed disabled:opacity-40";
const ghostBtn =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-300 px-4 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 disabled:cursor-not-allowed disabled:opacity-40";

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
      setMessage(url ? "Generation returned a preview URL." : "Request accepted. Result will arrive via webhook.");
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
      ? "border-rose-300 bg-rose-50 text-rose-700"
      : status === "success"
        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
        : "border-zinc-200 bg-zinc-50 text-zinc-600";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:py-12">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Heroframe</p>
        <h1 className="mt-1 font-[family-name:var(--font-bricolage)] text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">
          Cartoon production workspace
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600">
          Compose a scene, queue it through a workflow, generate a frame, or publish a draft. Each action calls a real
          backend route and reports exactly what happened.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <div className={card}>
          <h2 className="text-base font-bold text-zinc-900">Compose</h2>
          <div className="mt-4 grid gap-3">
            <label className={label} htmlFor="scene-title">
              Scene title
            </label>
            <input
              id="scene-title"
              value={sceneTitle}
              onChange={(e) => setSceneTitle(e.target.value)}
              placeholder="e.g. Rooftop duel at dusk"
              className={input}
            />

            <label className={label} htmlFor="story-beat">
              Story beat
            </label>
            <textarea
              id="story-beat"
              value={storyBeat}
              onChange={(e) => setStoryBeat(e.target.value)}
              placeholder="What happens in this scene?"
              className={`${input} min-h-28 py-2`}
            />

            <label className={label} htmlFor="style-hint">
              Style hint (optional)
            </label>
            <input
              id="style-hint"
              value={styleHint}
              onChange={(e) => setStyleHint(e.target.value)}
              placeholder="e.g. bold outlines, saturated color"
              className={input}
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={bootstrapWorkspace} disabled={status === "loading"} className={primaryBtn}>
              {isReady ? "Re-bootstrap" : "Bootstrap workspace"}
            </button>
            <button type="button" onClick={queueRun} disabled={!canQueue || status === "loading"} className={ghostBtn}>
              Queue run
            </button>
            <button type="button" onClick={generateFrame} disabled={status === "loading"} className={ghostBtn}>
              Generate frame
            </button>
            <button type="button" onClick={publishToGhost} disabled={status === "loading"} className={ghostBtn}>
              Publish to Ghost
            </button>
            <button type="button" onClick={() => loadRuns()} disabled={!isReady || status === "loading"} className={ghostBtn}>
              Refresh runs
            </button>
          </div>

          {message ? (
            <div className={`mt-4 rounded-lg border px-3 py-2 text-sm ${feedbackColor}`} role="status">
              {message}
            </div>
          ) : null}

          {resultUrl ? (
            <a
              href={resultUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block break-all text-sm font-medium text-sky-700 underline-offset-4 hover:underline"
            >
              {resultUrl}
            </a>
          ) : null}
        </div>

        <aside className={card}>
          <h2 className="text-base font-bold text-zinc-900">Runs</h2>
          <div className="mt-4 space-y-2">
            {!isReady ? (
              <p className="text-sm text-zinc-500">Bootstrap the workspace to load runs.</p>
            ) : runs.length === 0 ? (
              <p className="text-sm text-zinc-500">No runs yet. Compose a scene and queue a run.</p>
            ) : (
              runs.map((run) => (
                <article key={run._id} className="rounded-lg border border-zinc-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-zinc-900">{run.input.title}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusColor[run.status]}`}>
                      {run.status}
                    </span>
                  </div>
                  {run.input.storyBeat ? (
                    <p className="mt-1 text-xs text-zinc-600">{run.input.storyBeat}</p>
                  ) : null}
                  <p className="mt-2 text-[11px] text-zinc-400">{new Date(run.createdAt).toLocaleString()}</p>
                </article>
              ))
            )}
          </div>
        </aside>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        {[
          { title: "Hero workflow", steps: heroFightLeagueTemplate.steps },
          { title: "Front-end design workflow", steps: frontEndDesignTemplate.steps },
        ].map((workflow) => (
          <div key={workflow.title} className={card}>
            <h2 className="text-base font-bold text-zinc-900">{workflow.title}</h2>
            <ol className="mt-3 grid gap-1.5">
              {workflow.steps.map((step, index) => (
                <li key={step.id} className="flex items-center gap-2 text-sm text-zinc-700">
                  <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-zinc-900 text-[11px] font-semibold text-white">
                    {index + 1}
                  </span>
                  <span className="flex-1">{step.label}</span>
                  {!step.required ? <span className="text-[11px] text-zinc-400">optional</span> : null}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </section>
    </main>
  );
};
