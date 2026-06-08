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
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  let body: GenerateBody;
  try {
    body = (await request.json()) as GenerateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (!body.prompt?.trim()) {
    return NextResponse.json({ error: "prompt is required." }, { status: 400 });
  }
  if (body.prompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json({ error: "prompt exceeds max length." }, { status: 400 });
  }

  const mode: KieMode = body.mode ?? "image";
  const model = body.model?.trim() || resolveKieModel(mode, body.speed ?? "balanced");

  const prompt = body.styleHint?.trim() ? `${body.prompt.trim()}. Style: ${body.styleHint.trim()}` : body.prompt.trim();

  const input: Record<string, unknown> = { prompt };
  if (mode === "video") {
    // image-to-video (bytedance/v1-pro-image-to-video): single image_url + clip params.
    if (body.imageUrls?.length) input.image_url = body.imageUrls[0];
    input.resolution = body.resolution ?? "720p";
    input.duration = body.duration ?? "5";
  } else {
    if (body.imageSize) input.image_size = body.imageSize;
    // gpt-image-2-image-to-image expects `input_urls`; pass reference images there.
    if (body.imageUrls?.length) input.input_urls = body.imageUrls;
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
