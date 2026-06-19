import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

type CoachRequest = {
  message?: string;
  activeHero?: string;
  imageModel?: string;
  editModel?: string;
  videoModel?: string;
};

type CoachCard = {
  title: string;
  brief: string;
  prompt: string;
  modelHint: string;
};

type CoachPayload = {
  reply: string;
  card?: CoachCard;
};

type GlmChoice = {
  message?: {
    content?: unknown;
  };
};

type GlmResponse = {
  choices?: unknown;
  error?: unknown;
};

const resolveGlmKey = (request: NextRequest): string => {
  const key = request.headers.get("x-glm-key")?.trim();
  if (!key) throw new Error("No GLM API key provided.");
  return key;
};

const parseCoachPayload = (content: string): CoachPayload => {
  const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const parsed = JSON.parse(cleaned) as Partial<CoachPayload>;
  if (typeof parsed.reply !== "string") throw new Error("GLM reply was missing reply text.");
  const card = parsed.card && typeof parsed.card === "object"
    ? {
        title: typeof parsed.card.title === "string" ? parsed.card.title : "Cartoon shot",
        brief: typeof parsed.card.brief === "string" ? parsed.card.brief : "Generated art direction",
        prompt: typeof parsed.card.prompt === "string" ? parsed.card.prompt : parsed.reply,
        modelHint: typeof parsed.card.modelHint === "string" ? parsed.card.modelHint : "Coach recommendation",
      }
    : undefined;
  return { reply: parsed.reply, card };
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  let body: CoachRequest;
  try {
    body = (await request.json()) as CoachRequest;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message) return NextResponse.json({ ok: false, error: "message is required." }, { status: 400 });

  let apiKey: string;
  try {
    apiKey = resolveGlmKey(request);
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "No GLM API key." }, { status: 401 });
  }

  const system = [
    "You are HeroFrame Art Coach, a practical cartoon production art director.",
    "You know prompt craft, visual storytelling, character consistency, shot planning, and AI model selection.",
    "Give concise constructive direction. Favor actions the user can take before spending generation credits.",
    "Return only valid JSON with shape {\"reply\":\"...\",\"card\":{\"title\":\"...\",\"brief\":\"...\",\"prompt\":\"...\",\"modelHint\":\"...\"}}.",
    "Make card optional only when the user asks a pure question.",
  ].join(" ");

  try {
    const response = await fetch("https://api.z.ai/api/paas/v4/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "glm-5.2",
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: JSON.stringify({
              request: message,
              activeHero: body.activeHero ?? null,
              selectedModels: {
                image: body.imageModel,
                reference: body.editModel,
                video: body.videoModel,
              },
            }),
          },
        ],
        temperature: 0.7,
        thinking: { type: "disabled" },
      }),
    });

    const payload = (await response.json().catch(() => null)) as GlmResponse | null;
    if (!response.ok) {
      return NextResponse.json({ ok: false, error: payload?.error ?? "GLM request failed." }, { status: response.status });
    }

    const choices = Array.isArray(payload?.choices) ? payload.choices : [];
    const first = choices[0] as GlmChoice | undefined;
    const content = typeof first?.message?.content === "string" ? first.message.content : "";
    if (!content) throw new Error("GLM returned no message content.");
    return NextResponse.json({ ok: true, ...parseCoachPayload(content) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "GLM art coach failed." },
      { status: 502 },
    );
  }
};
