# Cartoon Hero Orchestrator

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
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `WAVEFORM_API_KEY`

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

## Suggested next build steps

1. Add Firebase login gate and persist user identity into Convex.
2. Add Waveform adapter route to generate voice jobs from run inputs.
3. Add Aytona worker integration for render execution and status callbacks.
4. Add provider-level retries and failure reasons on each workflow step.
