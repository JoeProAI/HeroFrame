import { NextRequest, NextResponse } from "next/server";
import { getConvexClient } from "@/lib/convex";
import { convexFunctions } from "@/lib/convex-functions";

export const maxDuration = 60;

type SpeechBody = {
  voiceId?: string;
  text?: string;
};

const resolveElevenLabsKey = (request: NextRequest): string => {
  const key = request.headers.get("x-elevenlabs-key")?.trim();
  if (!key) throw new Error("No ElevenLabs API key provided.");
  return key;
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  let body: SpeechBody;
  try {
    body = (await request.json()) as SpeechBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const voiceId = body.voiceId?.trim();
  const text = body.text?.trim();
  if (!voiceId || !text) {
    return NextResponse.json({ ok: false, error: "voiceId and text are required." }, { status: 400 });
  }

  let apiKey: string;
  try {
    apiKey = resolveElevenLabsKey(request);
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "No ElevenLabs API key." }, { status: 401 });
  }

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2_5",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return NextResponse.json({ ok: false, error: errorText || "ElevenLabs speech generation failed." }, { status: response.status });
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    const base64Data = `data:audio/mpeg;base64,${bytes.toString("base64")}`;
    const convex = getConvexClient();
    const url = (await convex.action(convexFunctions.storage.persistBase64, { base64Data })) as string | null;
    if (!url) {
      return NextResponse.json({ ok: false, error: "Could not store generated audio." }, { status: 502 });
    }

    return NextResponse.json({ ok: true, url });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "ElevenLabs speech generation failed." },
      { status: 502 },
    );
  }
};
