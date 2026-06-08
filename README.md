# Heroframe

Workflow orchestration studio for the Cartoon Hero course. This app is built to convert course assets into repeatable production pipelines for prompt generation, voice, render queueing, and quality review.

## Stack

- Next.js 16 (App Router, TypeScript, Tailwind v4)
- Firebase Auth (client auth provider)
- Convex (workflow data model + run state)
- Vercel (deployment target)

## What ships in v0

- Hero Fight League workflow template
- Convex schema for projects, workflows, and runs
- API routes for bootstrap, project listing, workflows, and run queueing
- Dashboard UI for:
  - workspace bootstrap
  - run creation
  - run queue visibility
  - course asset index linkage

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment template:

```bash
copy .env.example .env.local
```

3. Fill `.env.local`:

- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `WAVESPEED_API_KEY`
- `WAVESPEED_API_BASE_URL` (optional, defaults to `https://api.wavespeed.ai`)
- `WAVESPEED_CALLBACK_BASE_URL` (optional but recommended, used to attach webhook URL)
- `WAVESPEED_WEBHOOK_SECRET` (optional, recommended for webhook signature verification)
- `GHOST_API_URL` (e.g. `https://joepro-press.ghost.io`)
- `GHOST_ADMIN_API_KEY` (server-only, `id:secret` format)
- `GHOST_CONTENT_API_KEY` (optional, read-only)
- `KIE_API_KEY` (server-only; image/video generation via kie.ai)
- `KIE_API_BASE_URL` (optional, defaults to `https://api.kie.ai`)
- `KIE_CALLBACK_BASE_URL` (optional; enables Kie completion webhooks)

## Kie.ai image/video generation

- `POST /api/kie/generate`: creates a unified Kie task (`/api/v1/jobs/createTask`), waits briefly, returns a result URL or a `taskId`.
- `GET /api/kie/task?taskId=`: polls task state (`/api/v1/jobs/recordInfo`).
- `POST /api/kie/callback`: receives Kie completion webhooks.
- Model routing lives in `src/lib/kie/models.ts` (swap models by id, no rebuild). Default image model: `gpt-image-2-text-to-image`.
- The Generate button in the UI uses Kie; it server-waits ~7s then client-polls the Art panel until the frame is ready.

4. Run Convex dev backend:

```bash
npm run convex:dev
```

5. In a second terminal, run app:

```bash
npm run dev
```

## Deployment

1. Push repo to GitHub.
2. Import repo into Vercel.
3. Add env vars from `.env.example` in Vercel Project Settings.
4. Deploy.

## WaveSpeed architecture edge

This repo now includes a WaveSpeed integration that most teams skip:

- `POST /api/wavespeed/orchestrate`: server-only auth gateway for Bearer token usage
- strategy-based model routing by mode + speed tier
- prompt fingerprinting (`sha256`) for dedupe and traceability
- retry and timeout control for transient `429/5xx` failures
- `POST /api/wavespeed/webhook`: signature-aware callback endpoint (`webhook-signature`)

This gives you an edge because you are not making raw provider calls from the browser. You get deterministic orchestration, better failure handling, and a structure that can scale into multi-provider routing.

## Windsurf design workflow

- The front-end workflow has been upgraded to a stricter Windsurf-ready process in:
  - `src/lib/workflow-templates.ts` (`heroframe-ui-system` v2)
  - `WINDSURF_WORKFLOW_FRONTEND_DESIGN.md`
- Use this workflow for every significant UI pass to enforce:
  - one radical art direction
  - signature element requirement
  - token-first implementation
  - full interaction + failure states
  - narrative consistency quality gate

## Suggested next build steps

1. Persist WaveSpeed job IDs + outputs on run records in Convex.
2. Add Firebase login gate and map user IDs to project ownership.
3. Add Aytona worker fan-out to process batches and callbacks.
4. Add per-model cost and latency analytics for automatic strategy switching.
