"use client";

import { ReactNode, useMemo, useState } from "react";
import { courseAssetIndex } from "@/lib/course-assets";
import { heroFightLeagueTemplate } from "@/lib/workflow-templates";

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
  workflowId: string;
  ownerId: string;
};

const surfaceClass =
  "rounded-2xl border border-[var(--border)] bg-[linear-gradient(180deg,var(--surface)_0%,var(--surface-2)_100%)]";

const formatDate = (value: number): string => {
  return new Date(value).toLocaleString();
};

const statusTone: Record<RunSummary["status"], string> = {
  queued: "text-[var(--muted)]",
  running: "text-[var(--accent)]",
  succeeded: "text-emerald-300",
  failed: "text-[var(--danger)]",
};

const SectionTitle = ({ children }: { children: ReactNode }) => (
  <h2 className="text-lg font-semibold tracking-wide text-[var(--foreground)]">{children}</h2>
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
  const [message, setMessage] = useState("Bootstrap the workspace to start runs.");

  const isReady = useMemo(() => bootstrap !== null, [bootstrap]);

  const bootstrapWorkspace = async () => {
    setStatus("loading");
    setMessage("Creating project and workflow in Convex...");
    try {
      const response = await fetch("/api/bootstrap", { method: "POST" });
      if (!response.ok) {
        throw new Error("Failed to bootstrap workspace.");
      }
      const payload = (await response.json()) as BootstrapPayload;
      setBootstrap(payload);
      setStatus("success");
      setMessage("Workspace ready. You can now queue runs.");
      await loadRuns(payload.projectId);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unknown bootstrap error.");
    }
  };

  const loadRuns = async (projectIdArg?: string) => {
    const projectId = projectIdArg ?? bootstrap?.projectId;
    if (!projectId) return;
    try {
      const response = await fetch(`/api/runs?projectId=${encodeURIComponent(projectId)}`);
      if (!response.ok) {
        throw new Error("Failed to load runs.");
      }
      const payload = (await response.json()) as { runs: RunSummary[] };
      setRuns(payload.runs);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unknown load error.");
    }
  };

  const queueRun = async () => {
    if (!bootstrap) return;
    setStatus("loading");
    setMessage("Queueing Hero Fight League run...");
    try {
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: bootstrap.projectId,
          workflowId: bootstrap.workflowId,
          triggeredBy: bootstrap.ownerId,
          title: sceneTitle,
          storyBeat,
          styleHint,
        }),
      });
      if (!response.ok) {
        throw new Error("Run creation failed.");
      }
      setStatus("success");
      setMessage("Run queued. Next phase is worker execution on Aytona.");
      await loadRuns();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unknown run error.");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-10 md:px-10">
      <header className={`${surfaceClass} p-6`}>
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Cartoon Hero Lab</p>
        <h1 className="mt-2 text-3xl font-bold leading-tight md:text-4xl">
          Build cinematic workflows, not one-off prompts.
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-[var(--muted)] md:text-base">
          This studio turns your course assets into repeatable pipelines. Start with Hero Fight League, then
          add modules as the course expands.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className={`${surfaceClass} p-6`}>
          <SectionTitle>Hero Fight League Pipeline</SectionTitle>
          <div className="mt-4 grid gap-3">
            <label className="text-sm font-medium text-[var(--foreground)]" htmlFor="scene-title">
              Scene title
            </label>
            <input
              id="scene-title"
              value={sceneTitle}
              onChange={(event) => setSceneTitle(event.target.value)}
              className="rounded-xl border bg-[#0b1533] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus-visible:border-[var(--accent)]"
            />

            <label className="text-sm font-medium text-[var(--foreground)]" htmlFor="story-beat">
              Story beat
            </label>
            <textarea
              id="story-beat"
              value={storyBeat}
              onChange={(event) => setStoryBeat(event.target.value)}
              className="min-h-24 rounded-xl border bg-[#0b1533] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus-visible:border-[var(--accent)]"
            />

            <label className="text-sm font-medium text-[var(--foreground)]" htmlFor="style-hint">
              Style hint (optional)
            </label>
            <input
              id="style-hint"
              value={styleHint}
              onChange={(event) => setStyleHint(event.target.value)}
              className="rounded-xl border bg-[#0b1533] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus-visible:border-[var(--accent)]"
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={bootstrapWorkspace}
              disabled={status === "loading"}
              className="rounded-xl border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#131313] hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Bootstrap Workspace
            </button>
            <button
              type="button"
              onClick={queueRun}
              disabled={!isReady || status === "loading"}
              className="rounded-xl border px-4 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-[#22366f44] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Queue Run
            </button>
            <button
              type="button"
              onClick={() => loadRuns()}
              disabled={!isReady || status === "loading"}
              className="rounded-xl border px-4 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-[#22366f44] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Refresh Runs
            </button>
          </div>

          <p className="mt-4 text-sm text-[var(--muted)]">{message}</p>
        </div>

        <div className={`${surfaceClass} p-6`}>
          <SectionTitle>Workflow Nodes</SectionTitle>
          <ol className="mt-4 space-y-2">
            {heroFightLeagueTemplate.steps.map((step) => (
              <li
                key={step.id}
                className="rounded-xl border bg-[#0b1533] px-3 py-2 text-sm text-[var(--foreground)]"
              >
                <p className="font-medium">{step.label}</p>
                <p className="mt-1 text-xs uppercase tracking-wider text-[var(--muted)]">
                  {step.kind} {step.required ? "| required" : "| optional"}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className={`${surfaceClass} p-6`}>
          <SectionTitle>Run Queue</SectionTitle>
          <div className="mt-4 space-y-2">
            {runs.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No runs yet. Bootstrap, then queue one.</p>
            ) : (
              runs.map((run) => (
                <div key={run._id} className="rounded-xl border bg-[#0b1533] px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-[var(--foreground)]">{run.input.title}</p>
                    <p className={`text-xs font-semibold uppercase tracking-wide ${statusTone[run.status]}`}>
                      {run.status}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)]">{run.input.storyBeat}</p>
                  <p className="mt-2 text-xs text-[var(--muted)]">{formatDate(run.createdAt)}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={`${surfaceClass} p-6`}>
          <SectionTitle>Course Asset Index</SectionTitle>
          <ul className="mt-4 space-y-2">
            {courseAssetIndex.map((assetPath) => (
              <li key={assetPath} className="rounded-xl border bg-[#0b1533] px-3 py-2 text-xs text-[var(--muted)]">
                {assetPath}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
};
