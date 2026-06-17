# HeroFrame — Agent Handoff

This document is the full context for any coding agent (e.g. Codex) taking over
HeroFrame. Read it completely before changing code.

- Project root: `C:\Projects\AI_Projects\cartoon-hero-orchestrator`
- Repo (public): https://github.com/JoeProAI/HeroFrame
- Live: https://cartoon-hero-orchestrator.vercel.app

## Operating rules

- TypeScript strict, no `any`. Named exports, const arrow components. Comments
  explain "why", never "what". No emojis anywhere.
- Read `AGENTS.md` first: this Next.js has breaking changes; check
  `node_modules/next/dist/docs/` before changing any Next API.
- Before claiming done: `npm run typecheck`, `npm run lint`, `npm run build`
  must pass. Lint shows 4 warnings inside `convex/_generated`; those are
  expected, ignore them.
- This app is BYOK (bring your own key). NEVER add a server-side fallback to an
  env Kie key for generation/credits/upload. A shared public link must never
  spend the owner's credits.
- Do NOT run image/video/audio generations unless explicitly asked: each one
  spends real money on a user's kie.ai key.

## What it is

A BYOK cartoon-production studio. A user pastes their own kie.ai API key (stored
only in their browser), then creates reusable characters and generates
consistent scenes, versus matchups, talking (lipsync) clips, and animations.
Everything is logged to Convex.

## Stack

- Next.js 16 (App Router, TypeScript, Tailwind v4), React 19
- Convex (durable data + file storage), prod deployment `brilliant-lynx-274`
- Firebase Auth (client config wired, NOT currently gating anything)
- kie.ai unified `createTask` API for all generation (BYOK)
- WaveSpeed (alternate provider) and Ghost (publish) routes exist but secondary
- Hosted on Vercel (project `cartoon-hero-orchestrator`, deployment protection
  currently ON)

## BYOK + data scoping (core architecture)

- `src/lib/hf-client.ts` — client helpers. `getKieKey`/`setKieKey`
  (localStorage `heroframe.kieKey`), `getOwnerId` (per-browser id in
  `heroframe.owner`), and `hfFetch()` which injects headers `x-kie-key` and
  `x-hf-owner` on every API call.
- `src/lib/kie/env.ts` — `getKieConfig()` (baseUrl + callback, non-secret) and
  `resolveKieKey(headerKey)` which throws if no header key. STRICT: no env
  fallback.
- Server routes read `x-kie-key` for Kie auth and `x-hf-owner` to scope Convex
  rows. Each browser is its own tenant.

## Generation flow

- `src/lib/kie/client.ts` — `createKieTask({apiKey,model,input,callBackUrl})`,
  `getKieTask(taskId,apiKey)`, `getKieCredits(apiKey)`,
  `waitForKieTask(taskId,apiKey,budget)`. Every model is just `{model, input}`
  to `/api/v1/jobs/createTask`, then poll `recordInfo`.
- `src/lib/kie/run-client.ts` — `runKieGeneration({prompt, mode?, model?,
  input?, imageUrls?, resolution?, duration?, onProgress?})`. Returns the final
  result URL, polls `/api/kie/task` up to 300s. This is what the UI calls.
- `src/lib/kie/models.ts` — `modelCatalog` (image/image-edit/video picker
  lists), `defaultModel`, `resolveKieModel`, `pipelineModels`
  (tts/lipsync/characterImage/imageUpscale/videoUpscale), `ttsVoices`.

Pattern for adding a new model: use the raw `input` path. Pass `prompt: ""` and
put all fields inside `input`, so the route does not inject `prompt` into models
that reject unknown fields (which would 422).

## API routes (`src/app/api/`)

- `kie/generate` (POST) — builds `input` from `mode` OR passes raw `input`;
  resolves key from header; `createTask` + `waitForKieTask`. `maxDuration = 60`.
- `kie/task` (GET `?taskId`) — status, header key.
- `kie/credits` (GET) — returns `{credits}` or `null` if no key.
- `kie/upload` (POST `{base64Data}`) — stores upload in Convex storage (no Kie
  key needed). The old redpanda upload host was broken and removed.
- `kie/callback` (POST) — webhook receiver.
- `characters` (GET `?scope=active|deleted`, POST create, PATCH `{id, action:
  delete|restore|purge}`) — owner from header. Soft-delete = recycle bin.
- `generations` (GET list, POST log, DELETE clear) — POST re-hosts the result
  URL into Convex storage (permanent) before logging. Owner from header.
  `maxDuration = 60`.
- `bootstrap` / `projects` / `workflows` / `runs` — older Convex flow; still
  uses constant `OWNER_ID` ("joe") from `src/lib/owner.ts`, not per-browser.
- `wavespeed/*`, `ghost/publish` — secondary integrations.

## Convex (`convex/`)

- `schema.ts` — tables: `projects`, `workflows`, `runs`, `characters`
  (`ownerId,name,referenceUrl,notes?,deletedAt?,createdAt,updatedAt`, index
  `by_owner`), `generations`
  (`ownerId,kind,status,prompt,model?,url?,type?,characterName?,shot?,error?,createdAt`,
  index `by_owner`).
- `characters.ts` — list, listDeleted, create, softDelete, restore, purge.
- `generations.ts` — listByOwner (take 200), log, clear.
- `storage.ts` — `persistFromUrl` (fetch external URL -> store -> return
  permanent Convex URL) and `persistBase64` (decode data URL -> store). Actions.
- `_generated/` is committed.
- `src/lib/convex.ts` — `getConvexClient()` (ConvexHttpClient on
  `NEXT_PUBLIC_CONVEX_URL`). `src/lib/convex-functions.ts` —
  `makeFunctionReference` map for all functions.
- Deploy Convex: from project dir, set `CONVEX_DEPLOY_KEY`, then
  `npx convex deploy --yes`. The CLI does not accept `--cwd`.

## Client UI (`src/components/app-shell.tsx`, single large component)

- Tabs: `cast`, `scenes`, `fight` (labeled "Versus"), `lipsync`, `frames`,
  `history`.
- Hooks:
  - `src/lib/use-characters.ts` — Convex-backed cast via `hfFetch`. Returns
    characters, deleted, activeCharacter, addCharacter, removeCharacter (soft),
    restoreCharacter, purgeCharacter, loadDeleted.
  - `src/lib/use-frames.ts` — Convex generations. Returns `frames` (succeeded
    with url), `history` (all), `addFrame` (back-compat logger), `logGeneration`,
    `clearFrames`.
  - `src/lib/use-style-presets.ts` — local style presets.
- Sidebar has the BYOK key input + credits readout.
- Key handlers: `generateImage` (branches to Ideogram Character when consistency
  toggle + single ref), `generateMultiShot`, `generateVariations`,
  `generateFight`, `animateFrame`, `upscaleFrame` (Topaz), `runLipsync` (TTS then
  Infinitalk), `runAnyModel` (advanced raw model + JSON).

## Feature -> model mapping (verified against Kie docs)

- Image t2i: `gpt-image-2-text-to-image` default; picker adds nano-banana, grok,
  qwen2, seedream-4, ideogram/v3, flux-2, imagen4.
- Image ref/edit: `gpt-image-2-image-to-image`.
- Consistency: `ideogram/character`, input `{prompt, reference_image_urls:[url],
  rendering_speed, image_size:"square_hd"}` (1 ref only).
- Video (animate): `bytedance/v1-pro-*-image-to-video`, input `{image_url,
  prompt, resolution, duration}`.
- Lipsync: `elevenlabs/text-to-speech-turbo-2-5` input `{text, voice}` ->
  audio URL; then `infinitalk/from-audio` input `{image_url, audio_url, prompt,
  resolution:"480p"|"720p"}`.
- Upscale: `topaz/image-upscale` `{image_url, upscale_factor:"2"}`;
  `topaz/video-upscale` `{video_url, upscale_factor}`.

## Env vars (`.env.local`, git-ignored)

- `NEXT_PUBLIC_CONVEX_URL` (required at runtime)
- `NEXT_PUBLIC_FIREBASE_*` (client config)
- `KIE_API_BASE_URL` (optional, defaults to https://api.kie.ai),
  `KIE_CALLBACK_BASE_URL` (optional, enables webhook)
- `KIE_API_KEY` — NOT used at runtime anymore (BYOK). Only `scripts/*.ps1` use it.
- `WAVESPEED_API_KEY`, `WAVESPEED_CALLBACK_BASE_URL`; `GHOST_*` for those routes
- `CONVEX_DEPLOY_KEY` — deploy only, never commit, not needed in Vercel

## Commands

- Dev: `npm run dev`
- Verify: `npm run typecheck` ; `npm run lint` (4 expected warnings in
  `convex/_generated`) ; `npm run build`
- Deploy app: `git push` then `npx vercel --prod --yes`
- Deploy Convex: from project dir, set `CONVEX_DEPLOY_KEY`, then
  `npx convex deploy --yes`

## Gotchas

- Git working tree is CRLF; some edited files are LF. Large multi-line string
  edits can fail to match. Prefer small/unique edits or normalize a file to LF
  first.
- Kie result URLs expire ~24h. There is NO "list all my tasks" Kie API
  (confirmed 404 on every plausible endpoint). Permanence comes from re-hosting
  results to Convex storage in the generations POST.
- Generation requires a key header or 401. Keep it that way.

## Known issues / unverified

- Live generation runs have not been executed (credit cost). Wiring + input
  schemas are correct per docs, but a real run is unconfirmed. Failures surface
  the exact Kie error in the status bar.
- Vercel deployment protection is ON, so outside viewers of the live link hit an
  auth wall.
- `projects`/`runs` still use single `OWNER_ID = "joe"`; only
  `characters`/`generations` are per-browser. Firebase auth is not gating yet.

## Roadmap / parking lot

- Disable Vercel deployment protection for public sharing
- Map owner id to Firebase uid for true multi-user
- Log FAILED generations to History (table supports it; only successes logged)
- LICENSE + committed `env.sample` + README screenshots
- make.com automation hooks
- Rotate the Kie + Convex keys that appeared in earlier chat history
