import { NextRequest, NextResponse } from "next/server";
import { createKieTask, waitForKieTask } from "@/lib/kie/client";
import { getKieEnv } from "@/lib/kie/env";
import { resolveKieModel, type KieMode, type KieSpeed } from "@/lib/kie/models";

export const maxDuration = 60;

const MAX_PROMPT_LENGTH = 4000;

type GenerateBody = {
  mode?: KieMode;
  speed?: KieSpeed;
  model?: string;
  prompt?: string;
  styleHint?: string;
  imageUrls?: string[];
  imageSize?: string;
  resolution?: string;
  duration?: string;
  // Advanced: raw input object passed straight to Kie for any model.
  input?: Record<string, unknown>;
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  let body: GenerateBody;
  try {
    body = (await request.json()) as GenerateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const hasRawInput = body.input && typeof body.input === "object" && Object.keys(body.input).length > 0;

  if (!hasRawInput && !body.prompt?.trim()) {
    return NextResponse.json({ error: "prompt is required." }, { status: 400 });
  }
  if (body.prompt && body.prompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json({ error: "prompt exceeds max length." }, { status: 400 });
  }

  const mode: KieMode = body.mode ?? "image";
  const model = body.model?.trim() || resolveKieModel(mode, body.speed ?? "balanced");

  let input: Record<string, unknown>;
  if (hasRawInput) {
    // Advanced "any model" path: trust the caller's input, but inject the
    // prompt if they provided one separately and didn't include it.
    input = { ...(body.input as Record<string, unknown>) };
    if (body.prompt?.trim() && !("prompt" in input)) input.prompt = body.prompt.trim();
  } else {
    const prompt = body.styleHint?.trim()
      ? `${body.prompt!.trim()}. Style: ${body.styleHint.trim()}`
      : body.prompt!.trim();
    input = { prompt };
    if (mode === "video") {
      if (body.imageUrls?.length) input.image_url = body.imageUrls[0];
      input.resolution = body.resolution ?? "720p";
      input.duration = body.duration ?? "5";
    } else {
      if (body.imageSize) input.image_size = body.imageSize;
      if (body.imageUrls?.length) input.input_urls = body.imageUrls;
    }
  }

  let callBackUrl: string | undefined;
  try {
    const env = getKieEnv();
    callBackUrl = env.callbackBaseUrl
      ? `${env.callbackBaseUrl.replace(/\/$/, "")}/api/kie/callback`
      : undefined;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Kie is not configured." },
      { status: 500 },
    );
  }

  try {
    const taskId = await createKieTask({ model, input, callBackUrl });
    const record = await waitForKieTask(taskId);
    return NextResponse.json({
      ok: true,
      model,
      taskId,
      state: record.state,
      pending: record.state !== "success" && record.state !== "fail",
      resultUrl: record.resultUrls.at(0) ?? "",
      resultUrls: record.resultUrls,
      failMsg: record.failMsg,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Kie generation failed." },
      { status: 502 },
    );
  }
};
