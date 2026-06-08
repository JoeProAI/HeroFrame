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
  "relative overflow-hidden rounded-[24px] border border-[var(--color-border)] bg-[linear-gradient(160deg,#151b2b_0%,#101522_100%)] p-5";

const actionBaseClass =
  "inline-flex min-h-11 items-center justify-center rounded-full border px-4 text-sm font-semibold tracking-wide transition hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] disabled:cursor-not-allowed disabled:opacity-40";

const SectionTitle = ({ children }: { children: ReactNode }) => (
  <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-muted)]">{children}</h2>
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
    <div className="relative mx-auto flex w-full max-w-[1300px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <header className={`${panelClass} overflow-hidden`}>
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(to_right,#d6a85320_1px,transparent_1px),linear-gradient(to_bottom,#d6a85320_1px,transparent_1px)] [background-size:40px_40px]" />
        <div className="relative grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--color-accent)]">Heroframe Atelier</p>
            <h1 className="mt-3 text-4xl font-bold leading-[1.02] text-[var(--color-text)] sm:text-5xl">
              Epic production command for cinematic cartoon worlds.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--color-muted)] sm:text-base">
              Renaissance sketchbook discipline meets modern orchestration. You direct story, design, prompts, assets,
              and render execution from one surface.
            </p>
            <div className="mt-4 inline-flex items-center rounded-full border border-[var(--color-border)] bg-black/20 px-3 py-1 text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
              System status: <span className="ml-2 text-[var(--color-accent)]">{status}</span>
            </div>
          </div>
          <div className="relative flex items-center justify-center">
            <div className="relative h-64 w-64 rounded-full border border-[var(--color-accent)]/60">
              <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[var(--color-accent)]/30" />
              <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-[var(--color-accent)]/30" />
              <div className="absolute inset-5 rounded-full border border-[var(--color-border)]" />
              <div className="absolute inset-12 rounded-full border border-[var(--color-border)]/80" />
              <div className="absolute inset-0 animate-pulse rounded-full border border-[var(--color-accent)]/20" />
              <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-accent)]" />
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className={panelClass}>
          <SectionTitle>Composition Desk</SectionTitle>
          <div className="mt-4 grid gap-3">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]" htmlFor="scene-title">
              Scene Title
            </label>
            <input
              id="scene-title"
              value={sceneTitle}
              onChange={(event) => setSceneTitle(event.target.value)}
              className="min-h-11 rounded-xl border border-[var(--color-border)] bg-[#0c111e] px-3 text-sm text-[var(--color-text)] outline-none focus-visible:border-[var(--color-focus)]"
            />
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]" htmlFor="story-beat">
              Story Beat
            </label>
            <textarea
              id="story-beat"
              value={storyBeat}
              onChange={(event) => setStoryBeat(event.target.value)}
              className="min-h-32 rounded-xl border border-[var(--color-border)] bg-[#0c111e] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus-visible:border-[var(--color-focus)]"
            />
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]" htmlFor="style-hint">
              Visual Direction
            </label>
            <input
              id="style-hint"
              value={styleHint}
              onChange={(event) => setStyleHint(event.target.value)}
              className="min-h-11 rounded-xl border border-[var(--color-border)] bg-[#0c111e] px-3 text-sm text-[var(--color-text)] outline-none focus-visible:border-[var(--color-focus)]"
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={bootstrapWorkspace}
              disabled={status === "loading"}
              className={`${actionBaseClass} border-[var(--color-accent)] bg-[var(--color-accent)] text-[#14110d] hover:bg-[var(--color-accent-strong)] active:bg-[var(--color-accent)]`}
            >
              Bootstrap
            </button>
            <button
              type="button"
              onClick={queueRun}
              disabled={!isReady || status === "loading"}
              className={`${actionBaseClass} border-[var(--color-border)] text-[var(--color-text)] hover:bg-[#1a2136] active:bg-[#151b2d]`}
            >
              Queue Run
            </button>
            <button
              type="button"
              onClick={generateWithWaveSpeed}
              disabled={status === "loading"}
              className={`${actionBaseClass} border-[var(--color-border)] text-[var(--color-text)] hover:bg-[#1a2136] active:bg-[#151b2d]`}
            >
              Generate
            </button>
            <button
              type="button"
              onClick={() => loadRuns()}
              disabled={!isReady || status === "loading"}
              className={`${actionBaseClass} border-[var(--color-border)] text-[var(--color-text)] hover:bg-[#1a2136] active:bg-[#151b2d]`}
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
                  : "border-[var(--color-border)] bg-[#0f1525] text-[var(--color-muted)]"
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

        <div className={`${panelClass} grid gap-4`}>
          <SectionTitle>Run Ledger</SectionTitle>
          {runs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[#0d1220] px-3 py-8 text-center text-sm text-[var(--color-muted)]">
              Empty ledger. Bootstrap and launch your first run.
            </div>
          ) : (
            runs.map((run) => (
              <article key={run._id} className="rounded-2xl border border-[var(--color-border)] bg-[#0d1220] px-3 py-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[var(--color-text)]">{run.input.title}</h3>
                  <span className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${statusTone[run.status]}`}>
                    {run.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--color-muted)]">{run.input.storyBeat}</p>
                <p className="mt-2 font-mono text-[11px] text-[var(--color-muted)]">{formatDate(run.createdAt)}</p>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <WorkflowRail title="Hero Workflow" steps={heroFightLeagueTemplate.steps} />
        <WorkflowRail title="Front-End Design Workflow" steps={frontEndDesignTemplate.steps} />
      </section>

      <section className={panelClass}>
        <SectionTitle>Source Ledger</SectionTitle>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {courseAssetIndex.map((assetPath) => (
            <div
              key={assetPath}
              className="rounded-xl border border-[var(--color-border)] bg-[#0d1220] px-3 py-2 font-mono text-[11px] text-[var(--color-muted)]"
            >
              {assetPath}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
