import { NextRequest, NextResponse } from "next/server";
import { callWaveSpeed } from "@/lib/wavespeed/client";
import { buildWaveSpeedPayload, createPromptFingerprint, resolveWaveSpeedModelPath } from "@/lib/wavespeed/strategy";
import { wavespeedEnv } from "@/lib/wavespeed/env";
import type { WaveSpeedOrchestrateRequest } from "@/types/wavespeed";

const MAX_PROMPT_LENGTH = 4000;

const badRequest = (message: string) => NextResponse.json({ error: message }, { status: 400 });

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  let body: WaveSpeedOrchestrateRequest;
  try {
    body = (await request.json()) as WaveSpeedOrchestrateRequest;
  } catch {
    return badRequest("Invalid JSON payload.");
  }

  if (!body.mode) return badRequest("mode is required.");
  if (!body.prompt?.trim()) return badRequest("prompt is required.");
  if (body.prompt.length > MAX_PROMPT_LENGTH) return badRequest("prompt exceeds max length.");

  const modelPath = resolveWaveSpeedModelPath(body);
  const payload = buildWaveSpeedPayload(body);
  const fingerprint = createPromptFingerprint(body);

  const webhookUrl = wavespeedEnv.callbackBaseUrl
    ? `${wavespeedEnv.callbackBaseUrl.replace(/\/$/, "")}/api/wavespeed/webhook`
    : undefined;

  const response = await callWaveSpeed({ modelPath, payload, webhookUrl });
  const responseText = await response.text();

  let parsed: unknown = null;
  try {
    parsed = responseText ? (JSON.parse(responseText) as unknown) : null;
  } catch {
    parsed = { raw: responseText };
  }

  if (!response.ok) {
    return NextResponse.json(
      {
        ok: false,
        status: response.status,
        modelPath,
        fingerprint,
        error: parsed,
      },
      { status: response.status },
    );
  }

  return NextResponse.json({
    ok: true,
    modelPath,
    fingerprint,
    data: parsed,
  });
};
