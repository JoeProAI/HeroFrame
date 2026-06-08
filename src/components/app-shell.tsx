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

const statusTone: Record<RunSummary["status"], string> = {
  queued: "text-[var(--color-warning)]",
  running: "text-[var(--color-accent)]",
  succeeded: "text-[var(--color-success)]",
  failed: "text-[var(--color-danger)]",
};

const panelClass =
  "relative overflow-hidden rounded-[28px] border border-[var(--color-border)] bg-[var(--color-surface)]/70 p-5 backdrop-blur-xl";

const actionBaseClass =
  "inline-flex min-h-11 items-center justify-center rounded-full border px-4 text-sm font-semibold tracking-wide transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] disabled:cursor-not-allowed disabled:opacity-40";

const SectionTitle = ({ children }: { children: ReactNode }) => (
  <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--color-muted)]">{children}</h2>
);

type WorkflowRailProps = {
  title: string;
  steps: { id: string; label: string; kind: string; required: boolean }[];
};

const WorkflowRail = ({ title, steps }: WorkflowRailProps) => (
  <div className={`${panelClass} h-full`}>
    <SectionTitle>{title}</SectionTitle>
    <ol className="mt-4 grid gap-2">
      {steps.map((step, index) => (
        <li
          key={step.id}
          className="group rounded-2xl border border-[var(--color-border)] bg-[#141c3a]/70 px-3 py-3 transition hover:border-[var(--color-accent)]"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold text-[var(--color-text)]">
              {String(index + 1).padStart(2, "0")} {step.label}
            </p>
            <span className="rounded-full border border-[var(--color-border)] px-2 py-1 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
              {step.kind}
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            {step.required ? "Required in pipeline" : "Optional enhancement pass"}
          </p>
        </li>
      ))}
    </ol>
  </div>
);

export const AppShell = () => {
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [sceneTitle, setSceneTitle] = useState("The Last Throne - Rooftop Duel");
  const [storyBeat, setStoryBeat] = useState(
    "Hero arrives late, villain reveals a false prophecy, then both launch into a vertical fight arc.",
  );
  const [styleHint, setStyleHint] = useState("anime kinetic camera, cinematic moonlight");
  const [status, setStatus] = useState<PipelineStatus>("idle");
  const [message, setMessage] = useState("Bootstrap Heroframe to activate both production and design workflows.");
  const [generatedAssetUrl, setGeneratedAssetUrl] = useState("");

  const isReady = useMemo(() => bootstrap !== null, [bootstrap]);

  const bootstrapWorkspace = async () => {
    setStatus("loading");
    setMessage("Initializing Heroframe workflows...");
    try {
      const response = await fetch("/api/bootstrap", { method: "POST" });
      if (!response.ok) throw new Error("Failed to bootstrap workspace.");
      const payload = (await response.json()) as BootstrapPayload;
      setBootstrap(payload);
      setStatus("success");
      setMessage("Workspace ready. Hero pipeline and design workflow are live.");
      await loadRuns(payload.projectId);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unknown bootstrap error.");
    }
  };

  const loadRuns = async (projectIdArg?: string) => {
    const projectId = projectIdArg ?? bootstrap?.projectId;
    if (!projectId) {
      setMessage("Create a workspace before loading runs.");
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
      setMessage("Hero workflow id is missing. Re-bootstrap workspace.");
      return;
    }

    setStatus("loading");
    setMessage("Queueing Hero workflow run...");
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
      setMessage("Run queued. Next stage is provider dispatch and webhook completion.");
      await loadRuns();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unknown run error.");
    }
  };

  const generateWithWaveSpeed = async () => {
    setStatus("loading");
    setMessage("Submitting generation to WaveSpeed...");
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
          data?: {
            outputs?: Array<{ url?: string }>;
          };
        };
      };
      if (!response.ok || !payload.ok) throw new Error("WaveSpeed request failed.");

      const maybeUrl = payload.data?.output ?? payload.data?.data?.outputs?.at(0)?.url ?? "";
      setGeneratedAssetUrl(maybeUrl);
      setStatus("success");
      setMessage(
        maybeUrl ? "Generation accepted with preview URL." : "Generation accepted. Waiting for async webhook completion.",
      );
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unknown WaveSpeed error.");
    }
  };

  return (
    <div className="relative mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <header className={`${panelClass} before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[linear-gradient(90deg,transparent,var(--color-accent),transparent)]`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--color-accent)]">Heroframe</p>
            <h1 className="mt-3 text-3xl font-bold leading-[1.05] text-[var(--color-text)] sm:text-4xl lg:text-5xl">
              Director-grade workflow orchestration for cartoon production.
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--color-muted)] sm:text-base">
              Built to run your full sequence from story beat to final output, with a dedicated front-end design
              workflow baked into the same operational rail.
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--color-border)] bg-[#11193a]/80 px-3 py-2 text-xs text-[var(--color-muted)]">
            <p className="font-semibold text-[var(--color-text)]">Status</p>
            <p className="mt-1">{status.toUpperCase()}</p>
          </div>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <div className={panelClass}>
          <SectionTitle>Run Composer</SectionTitle>
          <div className="mt-4 grid gap-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]" htmlFor="scene-title">
              Scene title
            </label>
            <input
              id="scene-title"
              value={sceneTitle}
              onChange={(event) => setSceneTitle(event.target.value)}
              className="min-h-11 rounded-xl border border-[var(--color-border)] bg-[#0e1635] px-3 text-sm text-[var(--color-text)] outline-none transition focus-visible:border-[var(--color-focus)]"
            />

            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]" htmlFor="story-beat">
              Story beat
            </label>
            <textarea
              id="story-beat"
              value={storyBeat}
              onChange={(event) => setStoryBeat(event.target.value)}
              className="min-h-28 rounded-xl border border-[var(--color-border)] bg-[#0e1635] px-3 py-2 text-sm text-[var(--color-text)] outline-none transition focus-visible:border-[var(--color-focus)]"
            />

            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]" htmlFor="style-hint">
              Style hint
            </label>
            <input
              id="style-hint"
              value={styleHint}
              onChange={(event) => setStyleHint(event.target.value)}
              className="min-h-11 rounded-xl border border-[var(--color-border)] bg-[#0e1635] px-3 text-sm text-[var(--color-text)] outline-none transition focus-visible:border-[var(--color-focus)]"
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={bootstrapWorkspace}
              disabled={status === "loading"}
              className={`${actionBaseClass} border-[var(--color-accent)] bg-[var(--color-accent)] text-[#111] hover:bg-[var(--color-accent-strong)]`}
            >
              Bootstrap
            </button>
            <button
              type="button"
              onClick={queueRun}
              disabled={!isReady || status === "loading"}
              className={`${actionBaseClass} border-[var(--color-border)] text-[var(--color-text)] hover:bg-[#21306866]`}
            >
              Queue Run
            </button>
            <button
              type="button"
              onClick={generateWithWaveSpeed}
              disabled={status === "loading"}
              className={`${actionBaseClass} border-[var(--color-border)] text-[var(--color-text)] hover:bg-[#21306866]`}
            >
              Generate
            </button>
            <button
              type="button"
              onClick={() => loadRuns()}
              disabled={!isReady || status === "loading"}
              className={`${actionBaseClass} border-[var(--color-border)] text-[var(--color-text)] hover:bg-[#21306866]`}
            >
              Refresh
            </button>
          </div>

          <div
            className={`mt-4 rounded-xl border px-3 py-2 text-sm ${
              status === "error"
                ? "border-[var(--color-danger)]/70 bg-[var(--color-danger)]/10 text-[var(--color-danger)]"
                : status === "loading"
                  ? "border-[var(--color-warning)]/70 bg-[var(--color-warning)]/10 text-[var(--color-warning)]"
                  : "border-[var(--color-border)] bg-[#11193a]/70 text-[var(--color-muted)]"
            }`}
          >
            {message}
          </div>

          {generatedAssetUrl ? (
            <a
              href={generatedAssetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block break-all text-xs text-[var(--color-accent)] underline-offset-4 hover:underline"
            >
              {generatedAssetUrl}
            </a>
          ) : (
            <p className="mt-2 text-xs text-[var(--color-muted)]">No generated output URL yet.</p>
          )}
        </div>

        <div className={panelClass}>
          <SectionTitle>Live Queue</SectionTitle>
          <div className="mt-4 space-y-2">
            {runs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[#0f1736] px-3 py-5 text-sm text-[var(--color-muted)]">
                Queue is empty. Bootstrap the workspace, then run your first sequence.
              </div>
            ) : (
              runs.map((run) => (
                <article key={run._id} className="rounded-2xl border border-[var(--color-border)] bg-[#0f1736] px-3 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-[var(--color-text)]">{run.input.title}</h3>
                    <span className={`text-xs font-semibold uppercase tracking-wide ${statusTone[run.status]}`}>
                      {run.status}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--color-muted)]">{run.input.storyBeat}</p>
                  <p className="mt-2 font-mono text-[11px] text-[var(--color-muted)]">{formatDate(run.createdAt)}</p>
                </article>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <WorkflowRail title="Hero Pipeline" steps={heroFightLeagueTemplate.steps} />
        <WorkflowRail title="Front-End Design Workflow" steps={frontEndDesignTemplate.steps} />
      </section>

      <section className={panelClass}>
        <SectionTitle>Course Asset Index</SectionTitle>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {courseAssetIndex.map((assetPath) => (
            <div
              key={assetPath}
              className="rounded-xl border border-[var(--color-border)] bg-[#0f1736] px-3 py-2 font-mono text-[11px] text-[var(--color-muted)]"
            >
              {assetPath}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
