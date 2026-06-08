"use client";

import { ReactNode, useMemo, useState } from "react";
import { courseAssetIndex } from "@/lib/course-assets";
import { frontEndDesignTemplate, heroFightLeagueTemplate } from "@/lib/workflow-templates";

type PipelineStatus = "idle" | "loading" | "success" | "error";

type RunSummary = {
  _id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  createdAt: number;
  input: {
    title: string;
    storyBeat: string;
    styleHint?: string;
  };
};

type BootstrapPayload = {
  projectId: string;
  heroWorkflowId?: string;
  designWorkflowId?: string;
  workflowId?: string;
  ownerId: string;
};

const formatDate = (value: number): string => new Date(value).toLocaleString();

const statusBadge: Record<RunSummary["status"], string> = {
  queued: "bg-[var(--color-accent-2)] text-[var(--color-ink)]",
  running: "bg-[var(--color-accent-3)] text-[var(--color-ink)]",
  succeeded: "bg-[var(--color-success)] text-[var(--color-ink)]",
  failed: "bg-[var(--color-accent)] text-[var(--color-ink)]",
};

// Sticker panel: thick ink outline + hard offset shadow. The core material.
const panel =
  "relative rounded-[22px] border-[3px] border-[var(--color-ink)] bg-[var(--color-surface)] p-5 shadow-[var(--ink-shadow)]";

const btn =
  "inline-flex min-h-11 items-center justify-center rounded-full border-[3px] border-[var(--color-ink)] px-4 text-sm font-bold uppercase tracking-wide shadow-[var(--ink-shadow)] transition hover:-translate-y-0.5 hover:translate-x-0 active:translate-x-1 active:translate-y-1 active:shadow-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-focus)] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0";

const field =
  "min-h-11 rounded-xl border-[3px] border-[var(--color-ink)] bg-[var(--color-bg-soft)] px-3 text-sm text-[var(--color-text)] outline-none transition focus-visible:border-[var(--color-accent-2)]";

const Eyebrow = ({ children }: { children: ReactNode }) => (
  <span className="inline-block rounded-full border-[3px] border-[var(--color-ink)] bg-[var(--color-accent-2)] px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-ink)] shadow-[var(--ink-shadow)]">
    {children}
  </span>
);

const PanelHeading = ({ children }: { children: ReactNode }) => (
  <h2 className="font-[family-name:var(--font-display)] text-lg font-extrabold tracking-tight text-[var(--color-text)]">
    {children}
  </h2>
);

// Signature element: a cartoon film strip with sprocket holes.
const FilmStrip = () => (
  <div className="relative w-full overflow-hidden rounded-2xl border-[3px] border-[var(--color-ink)] bg-[var(--color-ink)] shadow-[var(--ink-shadow)]">
    <div className="flex items-center justify-between px-3 py-1.5">
      {Array.from({ length: 9 }).map((_, index) => (
        <span key={index} className="h-2.5 w-2.5 rounded-[3px] bg-[var(--color-bg)]" />
      ))}
    </div>
    <div className="grid grid-cols-4">
      {[
        { tone: "var(--color-accent)", label: "INK" },
        { tone: "var(--color-accent-2)", label: "PAINT" },
        { tone: "var(--color-accent-3)", label: "MOVE" },
        { tone: "var(--color-accent-4)", label: "CUT" },
      ].map((cel) => (
        <div
          key={cel.label}
          className="flex aspect-square items-center justify-center border-l-[3px] border-[var(--color-ink)] first:border-l-0"
          style={{ background: cel.tone }}
        >
          <span className="font-[family-name:var(--font-display)] text-base font-black text-[var(--color-ink)]">
            {cel.label}
          </span>
        </div>
      ))}
    </div>
    <div className="flex items-center justify-between px-3 py-1.5">
      {Array.from({ length: 9 }).map((_, index) => (
        <span key={index} className="h-2.5 w-2.5 rounded-[3px] bg-[var(--color-bg)]" />
      ))}
    </div>
  </div>
);

type WorkflowRailProps = {
  badge: string;
  title: string;
  steps: { id: string; label: string; kind: string; required: boolean }[];
};

const WorkflowRail = ({ badge, title, steps }: WorkflowRailProps) => (
  <section className={panel}>
    <div className="flex items-center justify-between gap-3">
      <PanelHeading>{title}</PanelHeading>
      <Eyebrow>{badge}</Eyebrow>
    </div>
    <ol className="mt-4 grid gap-2">
      {steps.map((step, index) => (
        <li
          key={step.id}
          className="flex items-center gap-3 rounded-xl border-[3px] border-[var(--color-ink)] bg-[var(--color-panel)] px-3 py-2.5 transition hover:-translate-y-0.5"
        >
          <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full border-[3px] border-[var(--color-ink)] bg-[var(--color-accent)] font-[family-name:var(--font-display)] text-xs font-black text-[var(--color-ink)]">
            {index + 1}
          </span>
          <span className="flex-1 text-sm font-semibold text-[var(--color-text)]">{step.label}</span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
            {step.required ? step.kind : `${step.kind} · opt`}
          </span>
        </li>
      ))}
    </ol>
  </section>
);

export const AppShell = () => {
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [sceneTitle, setSceneTitle] = useState("The Last Throne - Rooftop Duel");
  const [storyBeat, setStoryBeat] = useState(
    "Hero arrives late, villain reveals a false prophecy, then both launch into a vertical fight arc.",
  );
  const [styleHint, setStyleHint] = useState("rubber-hose energy, bold ink outlines, saturated cel paint");
  const [status, setStatus] = useState<PipelineStatus>("idle");
  const [message, setMessage] = useState("Pull the lever to spin up your cartoon studio.");
  const [generatedAssetUrl, setGeneratedAssetUrl] = useState("");

  const isReady = useMemo(() => bootstrap !== null, [bootstrap]);

  const bootstrapWorkspace = async () => {
    setStatus("loading");
    setMessage("Inking the studio. Setting up workflows...");
    try {
      const response = await fetch("/api/bootstrap", { method: "POST" });
      if (!response.ok) throw new Error("Failed to bootstrap workspace.");
      const payload = (await response.json()) as BootstrapPayload;
      setBootstrap(payload);
      setStatus("success");
      setMessage("Studio is open. Hero and design workflows are loaded.");
      await loadRuns(payload.projectId);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unknown bootstrap error.");
    }
  };

  const loadRuns = async (projectIdArg?: string) => {
    const projectId = projectIdArg ?? bootstrap?.projectId;
    if (!projectId) {
      setStatus("error");
      setMessage("No project loaded yet. Open the studio first.");
      return;
    }
    try {
      const response = await fetch(`/api/runs?projectId=${encodeURIComponent(projectId)}`);
      if (!response.ok) throw new Error("Failed to load runs.");
      const payload = (await response.json()) as { runs: RunSummary[] };
      setRuns(payload.runs);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unknown load error.");
    }
  };

  const queueRun = async () => {
    if (!bootstrap) return;
    const workflowId = bootstrap.heroWorkflowId ?? bootstrap.workflowId;
    if (!workflowId) {
      setStatus("error");
      setMessage("Hero workflow id missing. Re-open the studio.");
      return;
    }
    setStatus("loading");
    setMessage("Rolling a new cartoon sequence...");
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
          styleHint,
        }),
      });
      if (!response.ok) throw new Error("Run creation failed.");
      setStatus("success");
      setMessage("Scene queued. It is on the animation table.");
      await loadRuns();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unknown queue error.");
    }
  };

  const generateWithWaveSpeed = async () => {
    setStatus("loading");
    setMessage("Sending frames to WaveSpeed...");
    try {
      const response = await fetch("/api/wavespeed/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "image",
          runId: bootstrap?.projectId ?? "adhoc-run",
          prompt: `${sceneTitle}. ${storyBeat}`,
          styleHint,
          strategy: { speed: "balanced", async: true },
        }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        data?: {
          output?: string;
          data?: { outputs?: Array<{ url?: string }> };
        };
      };
      if (!response.ok || !payload.ok) throw new Error("WaveSpeed request failed.");
      const maybeUrl = payload.data?.output ?? payload.data?.data?.outputs?.at(0)?.url ?? "";
      setGeneratedAssetUrl(maybeUrl);
      setStatus("success");
      setMessage(maybeUrl ? "Frame generated. Preview is ready." : "Frame accepted. Awaiting render webhook.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unknown generation error.");
    }
  };

  const publishToGhost = async () => {
    setStatus("loading");
    setMessage("Publishing draft to joepro-press...");
    try {
      const response = await fetch("/api/ghost/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: sceneTitle,
          storyBeat,
          styleHint,
          status: "draft",
        }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        post?: { url: string };
        error?: string;
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Ghost publish failed.");
      }
      setGeneratedAssetUrl(payload.post?.url ?? "");
      setStatus("success");
      setMessage("Draft published to Ghost. Open it from the link below.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unknown Ghost error.");
    }
  };

  const feedbackTone =
    status === "error"
      ? "border-[var(--color-accent)] bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
      : status === "loading"
        ? "border-[var(--color-accent-2)] bg-[var(--color-accent-2)]/15 text-[var(--color-accent-2)]"
        : "border-[var(--color-ink)] bg-[var(--color-panel)] text-[var(--color-muted)]";

  return (
    <main className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <header className={`${panel} overflow-hidden`}>
        <div className="grid items-center gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <div>
            <Eyebrow>Ages of Cartoons</Eyebrow>
            <h1 className="mt-4 font-[family-name:var(--font-display)] text-5xl font-black uppercase leading-[0.9] tracking-tight text-[var(--color-text)] sm:text-6xl lg:text-7xl">
              Heroframe
              <span className="mt-1 block text-[var(--color-accent)]">cartoon</span>
              <span className="block text-[var(--color-accent-3)]">maker.</span>
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-6 text-[var(--color-muted)] sm:text-base">
              From scribbled idea to inked-and-painted scene. Heroframe runs the whole studio line: story, style,
              frame generation, and quality gates, all on one animation table.
            </p>
            <div className="mt-5 inline-flex min-h-11 items-center rounded-full border-[3px] border-[var(--color-ink)] bg-[var(--color-bg-soft)] px-4 font-mono text-xs uppercase tracking-[0.2em] text-[var(--color-muted)] shadow-[var(--ink-shadow)]">
              status:&nbsp;<span className="text-[var(--color-accent-2)]">{status}</span>
            </div>
          </div>
          <FilmStrip />
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className={panel}>
          <PanelHeading>Animation Table</PanelHeading>
          <div className="mt-4 grid gap-3">
            <label className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-muted)]" htmlFor="scene-title">
              Scene title
            </label>
            <input id="scene-title" value={sceneTitle} onChange={(e) => setSceneTitle(e.target.value)} className={field} />

            <label className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-muted)]" htmlFor="story-beat">
              Story beat
            </label>
            <textarea
              id="story-beat"
              value={storyBeat}
              onChange={(e) => setStoryBeat(e.target.value)}
              className={`${field} min-h-32 py-2`}
            />

            <label className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-muted)]" htmlFor="style-hint">
              Style direction
            </label>
            <input id="style-hint" value={styleHint} onChange={(e) => setStyleHint(e.target.value)} className={field} />
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={bootstrapWorkspace} disabled={status === "loading"} className={`${btn} bg-[var(--color-accent-2)] text-[var(--color-ink)]`}>
              Open Studio
            </button>
            <button type="button" onClick={queueRun} disabled={!isReady || status === "loading"} className={`${btn} bg-[var(--color-accent-3)] text-[var(--color-ink)]`}>
              Queue Scene
            </button>
            <button type="button" onClick={generateWithWaveSpeed} disabled={status === "loading"} className={`${btn} bg-[var(--color-accent)] text-[var(--color-text)]`}>
              Generate Frame
            </button>
            <button type="button" onClick={publishToGhost} disabled={status === "loading"} className={`${btn} bg-[var(--color-accent-4)] text-[var(--color-text)]`}>
              Publish to Ghost
            </button>
            <button type="button" onClick={() => loadRuns()} disabled={!isReady || status === "loading"} className={`${btn} bg-[var(--color-panel)] text-[var(--color-text)]`}>
              Refresh
            </button>
          </div>

          <div className={`mt-4 rounded-xl border-[3px] px-3 py-2 text-sm font-semibold ${feedbackTone}`}>{message}</div>

          {generatedAssetUrl ? (
            <a
              href={generatedAssetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block break-all font-mono text-xs text-[var(--color-accent-2)] underline-offset-4 hover:underline"
            >
              {generatedAssetUrl}
            </a>
          ) : (
            <p className="mt-2 font-mono text-xs text-[var(--color-muted)]">No frame URL yet.</p>
          )}
        </div>

        <aside className={panel}>
          <PanelHeading>Reel</PanelHeading>
          <div className="mt-4 space-y-3">
            {runs.length === 0 ? (
              <div className="rounded-xl border-[3px] border-dashed border-[var(--color-ink)] bg-[var(--color-panel)] px-3 py-8 text-center text-sm text-[var(--color-muted)]">
                Empty reel. Open the studio and roll your first scene.
              </div>
            ) : (
              runs.map((run) => (
                <article key={run._id} className="rounded-xl border-[3px] border-[var(--color-ink)] bg-[var(--color-panel)] px-3 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-[var(--color-text)]">{run.input.title}</h3>
                    <span className={`rounded-full border-[3px] border-[var(--color-ink)] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${statusBadge[run.status]}`}>
                      {run.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">{run.input.storyBeat}</p>
                  <p className="mt-2 font-mono text-[11px] text-[var(--color-muted)]">{formatDate(run.createdAt)}</p>
                </article>
              ))
            )}
          </div>
        </aside>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <WorkflowRail badge="Production" title="Hero Workflow" steps={heroFightLeagueTemplate.steps} />
        <WorkflowRail badge="Design" title="Front-End Design" steps={frontEndDesignTemplate.steps} />
      </section>

      <section className={panel}>
        <PanelHeading>Source Archive</PanelHeading>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {courseAssetIndex.map((assetPath) => (
            <div
              key={assetPath}
              className="rounded-xl border-[3px] border-[var(--color-ink)] bg-[var(--color-panel)] px-3 py-2 font-mono text-[11px] text-[var(--color-muted)]"
            >
              {assetPath}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
};
