import { NextRequest, NextResponse } from "next/server";

type ElevenLabsVoice = {
  voice_id?: unknown;
  name?: unknown;
  category?: unknown;
  description?: unknown;
  preview_url?: unknown;
  labels?: unknown;
};

type ElevenLabsVoiceResponse = {
  voices?: unknown;
};

const resolveElevenLabsKey = (request: NextRequest): string => {
  const key = request.headers.get("x-elevenlabs-key")?.trim();
  if (!key) throw new Error("No ElevenLabs API key provided.");
  return key;
};

const labelFrom = (voice: ElevenLabsVoice): string => {
  const labels = voice.labels;
  if (!labels || typeof labels !== "object") return "";
  const values = Object.values(labels).filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  return values.slice(0, 2).join(", ");
};

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  let apiKey: string;
  try {
    apiKey = resolveElevenLabsKey(request);
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "No ElevenLabs API key." }, { status: 401 });
  }

  const search = request.nextUrl.searchParams.get("search")?.trim();
  const url = new URL("https://api.elevenlabs.io/v2/voices");
  url.searchParams.set("page_size", "100");
  if (search) url.searchParams.set("search", search);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "xi-api-key": apiKey },
    });
    const payload = (await response.json().catch(() => null)) as ElevenLabsVoiceResponse | null;
    if (!response.ok) {
      return NextResponse.json({ ok: false, error: payload ?? "ElevenLabs voice import failed." }, { status: response.status });
    }
    const voices = Array.isArray(payload?.voices)
      ? payload.voices
          .filter((voice): voice is ElevenLabsVoice => Boolean(voice) && typeof voice === "object")
          .map((voice) => ({
            id: typeof voice.voice_id === "string" ? voice.voice_id : "",
            label: typeof voice.name === "string" ? voice.name : "Untitled voice",
            category: typeof voice.category === "string" ? voice.category : "voice",
            tone: labelFrom(voice) || (typeof voice.description === "string" ? voice.description : "ElevenLabs voice"),
            source: "elevenlabs",
            previewUrl: typeof voice.preview_url === "string" ? voice.preview_url : undefined,
          }))
          .filter((voice) => voice.id)
      : [];
    return NextResponse.json({ ok: true, voices });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "ElevenLabs voice import failed." },
      { status: 502 },
    );
  }
};
