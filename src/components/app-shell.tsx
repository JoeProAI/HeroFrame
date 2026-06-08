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

const panel = "rounded-2xl border border-[#2e2640] bg-[#181320]";
const label = "text-[11px] font-bold uppercase tracking-[0.16em] text-[#b3a7c4]";
const field =
  "min-h-11 w-full rounded-xl border border-[#2e2640] bg-[#0c0a12] px-3 text-sm text-[#fbf4e6] placeholder:text-[#6b6480] outline-none transition focus-visible:border-[#ffd23f] focus-visible:ring-1 focus-visible:ring-[#ffd23f]";
const btn =
  "inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-bold transition hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd23f] disabled:cursor-not-allowed disabled:opacity-40 disabled:translate-y-0";

const isImageUrl = (url: string): boolean => /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(url);

const navItems = [
  { id: "compose", label: "Compose", dot: "#ff5a3c" },
  { id: "runs", label: "Runs", dot: "#2ec4b6" },
  { id: "workflows", label: "Workflows", dot: "#8a5cff" },
  { id: "art", label: "Art", dot: "#ffd23f" },
];

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

  const pollKieTask = async (taskId: string) => {
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 3_000));
      try {
        const response = await fetch(`/api/kie/task?taskId=${encodeURIComponent(taskId)}`);
        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; state?: string; resultUrl?: string; failMsg?: string }
          | null;
        if (!response.ok || !payload?.ok) continue;
        if (payload.state === "success") {
          setResultUrl(payload.resultUrl ?? "");
          setStatus("success");
          setMessage(payload.resultUrl ? "Frame ready." : "Task finished without a result URL.");
          return;
        }
        if (payload.state === "fail") {
          setStatus("error");
          setMessage(payload.failMsg ?? "Generation failed.");
          return;
        }
        setMessage(`Generating frame... (${payload.state ?? "working"})`);
      } catch {
        // transient; keep polling until the deadline
      }
    }
    setStatus("error");
    setMessage("Timed out waiting for the frame. Try Refresh later.");
  };

  const generateFrame = async () => {
    if (!sceneTitle.trim() || !storyBeat.trim()) {
      setStatus("error");
      setMessage("Add a scene title and story beat first.");
      return;
    }
    setStatus("loading");
    setMessage("Sending request to Kie...");
    setResultUrl("");
    try {
      const response = await fetch("/api/kie/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "image",
          speed: "balanced",
          prompt: `${sceneTitle}. ${storyBeat}`,
          styleHint: styleHint || undefined,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; taskId?: string; state?: string; pending?: boolean; resultUrl?: string; failMsg?: string }
        | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? `Kie request failed (HTTP ${response.status}).`);
      }
      if (payload.state === "fail") {
        throw new Error(payload.failMsg ?? "Generation failed.");
      }
      if (payload.resultUrl) {
        setResultUrl(payload.resultUrl);
        setStatus("success");
        setMessage("Frame ready.");
        return;
      }
      if (payload.taskId) {
        setMessage("Generating frame...");
        await pollKieTask(payload.taskId);
      }
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Kie request failed.");
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

  const statusDot =
    status === "error" ? "#ff5a3c" : status === "success" ? "#4ade80" : status === "loading" ? "#ffd23f" : "#6b6480";

  return (
    <div className="flex min-h-screen w-full">
      {/* SIDEBAR */}
      <aside className="sticky top-0 hidden h-screen w-64 flex-none flex-col border-r border-[#2e2640] bg-[#0c0a12]/80 p-5 lg:flex">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ff5a3c] font-[family-name:var(--font-bricolage)] text-lg font-black text-[#05040a]">
            H
          </span>
          <div>
            <p className="font-[family-name:var(--font-bricolage)] text-base font-black leading-none">Heroframe</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#6b6480]">Cartoon maker</p>
          </div>
        </div>

        <nav className="mt-8 flex flex-col gap-1">
          {navItems.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#b3a7c4] transition hover:bg-[#181320] hover:text-[#fbf4e6]"
            >
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
            {isReady ? "Workspace connected." : "Not bootstrapped yet."}
          </p>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* TOP BAR */}
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[#2e2640] bg-[#0c0a12]/85 px-5 py-3 backdrop-blur sm:px-8">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-[#ffd23f] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#05040a]">
              Ages of Cartoons
            </span>
            <h1 className="font-[family-name:var(--font-bricolage)] text-lg font-black uppercase tracking-tight sm:text-xl">
              Production Workspace
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={bootstrapWorkspace} disabled={status === "loading"} className={`${btn} bg-[#ffd23f] text-[#05040a] hover:bg-[#ffdd66]`}>
              {isReady ? "Re-bootstrap" : "Bootstrap"}
            </button>
            <button type="button" onClick={() => loadRuns()} disabled={!isReady || status === "loading"} className={`${btn} border border-[#2e2640] bg-transparent text-[#fbf4e6] hover:bg-[#181320]`}>
              Refresh
            </button>
          </div>
        </header>

        {/* CONTENT — full width 12-col grid */}
        <div className="grid flex-1 grid-cols-1 gap-5 p-5 sm:p-8 xl:grid-cols-12">
          {/* Compose */}
          <section id="compose" className={`${panel} border-t-4 border-t-[#ff5a3c] p-6 xl:col-span-5`}>
            <h2 className="font-[family-name:var(--font-bricolage)] text-xl font-extrabold">Compose</h2>
            <div className="mt-4 grid gap-3">
              <div className="grid gap-2">
                <label className={label} htmlFor="scene-title">Scene title</label>
                <input id="scene-title" value={sceneTitle} onChange={(e) => setSceneTitle(e.target.value)} placeholder="e.g. Rooftop duel at dusk" className={field} />
              </div>
              <div className="grid gap-2">
                <label className={label} htmlFor="story-beat">Story beat</label>
                <textarea id="story-beat" value={storyBeat} onChange={(e) => setStoryBeat(e.target.value)} placeholder="What happens in this scene?" className={`${field} min-h-36 py-2`} />
              </div>
              <div className="grid gap-2">
                <label className={label} htmlFor="style-hint">Style hint (optional)</label>
                <input id="style-hint" value={styleHint} onChange={(e) => setStyleHint(e.target.value)} placeholder="e.g. bold outlines, saturated color" className={field} />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" onClick={queueRun} disabled={!canQueue || status === "loading"} className={`${btn} bg-[#2ec4b6] text-[#05040a] hover:bg-[#43d6c8]`}>
                Queue run
              </button>
              <button type="button" onClick={generateFrame} disabled={status === "loading"} className={`${btn} bg-[#ff5a3c] text-[#fbf4e6] hover:bg-[#ff7259]`}>
                Generate frame
              </button>
              <button type="button" onClick={publishToGhost} disabled={status === "loading"} className={`${btn} bg-[#8a5cff] text-[#fbf4e6] hover:bg-[#9d75ff]`}>
                Publish to Ghost
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
          </section>

          {/* Art preview */}
          <section id="art" className={`${panel} overflow-hidden border-t-4 border-t-[#ffd23f] xl:col-span-4`}>
            <div className="flex items-center justify-between p-6 pb-3">
              <h2 className="font-[family-name:var(--font-bricolage)] text-xl font-extrabold">Art preview</h2>
              <span className="rounded-full bg-[#ffd23f] px-2 py-0.5 text-[10px] font-black uppercase text-[#05040a]">frame</span>
            </div>
            <div className="relative flex h-[calc(100%-72px)] min-h-64 items-center justify-center border-t border-[#2e2640] bg-[#0c0a12]">
              {resultUrl && isImageUrl(resultUrl) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resultUrl} alt="Generated frame preview" className="h-full w-full object-cover" />
              ) : (
                <div className="px-6 text-center">
                  <div className="mx-auto flex h-28 w-44 items-center justify-center">
                    <span className="h-20 w-20 -rotate-6 rounded-2xl border-[3px] border-[#05040a] bg-[#8a5cff]" />
                    <span className="-ml-8 h-20 w-20 rotate-3 rounded-2xl border-[3px] border-[#05040a] bg-[#ff5a3c]" />
                    <span className="-ml-8 h-20 w-20 -rotate-3 rounded-2xl border-[3px] border-[#05040a] bg-[#2ec4b6]" />
                  </div>
                  <p className="mt-4 text-xs text-[#6b6480]">Generate a frame to preview it here.</p>
                </div>
              )}
            </div>
          </section>

          {/* Runs */}
          <aside id="runs" className={`${panel} border-t-4 border-t-[#2ec4b6] p-6 xl:col-span-3`}>
            <h2 className="font-[family-name:var(--font-bricolage)] text-xl font-extrabold">Runs</h2>
            <div className="mt-4 space-y-2">
              {!isReady ? (
                <p className="text-sm text-[#6b6480]">Bootstrap to load runs.</p>
              ) : runs.length === 0 ? (
                <p className="text-sm text-[#6b6480]">No runs yet.</p>
              ) : (
                runs.map((run) => (
                  <article key={run._id} className="rounded-xl border border-[#2e2640] bg-[#0c0a12] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold text-[#fbf4e6]">{run.input.title}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${statusColor[run.status]}`}>
                        {run.status}
                      </span>
                    </div>
                    {run.input.storyBeat ? <p className="mt-1 line-clamp-2 text-xs text-[#b3a7c4]">{run.input.storyBeat}</p> : null}
                    <p className="mt-2 text-[11px] text-[#6b6480]">{new Date(run.createdAt).toLocaleString()}</p>
                  </article>
                ))
              )}
            </div>
          </aside>

          {/* Workflows — span full width */}
          <section id="workflows" className="grid gap-5 xl:col-span-12 xl:grid-cols-2">
            {[
              { title: "Hero workflow", accent: "#8a5cff", chip: "Production", steps: heroFightLeagueTemplate.steps },
              { title: "Front-end design workflow", accent: "#ffd23f", chip: "Design", steps: frontEndDesignTemplate.steps },
            ].map((workflow) => (
              <div key={workflow.title} className={`${panel} p-6`} style={{ borderTop: `4px solid ${workflow.accent}` }}>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-[family-name:var(--font-bricolage)] text-xl font-extrabold">{workflow.title}</h2>
                  <span className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase text-[#05040a]" style={{ background: workflow.accent }}>
                    {workflow.chip}
                  </span>
                </div>
                <ol className="mt-4 grid gap-1.5 sm:grid-cols-2">
                  {workflow.steps.map((step, index) => (
                    <li key={step.id} className="flex items-center gap-3 rounded-lg border border-[#2e2640] bg-[#0c0a12] px-3 py-2">
                      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[11px] font-black text-[#05040a]" style={{ background: workflow.accent }}>
                        {index + 1}
                      </span>
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
