import { NextRequest, NextResponse } from "next/server";
import { getConvexClient } from "@/lib/convex";
import { convexFunctions } from "@/lib/convex-functions";
import { OWNER_ID } from "@/lib/owner";

export const maxDuration = 60;

export const GET = async (): Promise<NextResponse> => {
  try {
    const convex = getConvexClient();
    const generations = await convex.query(convexFunctions.generations.listByOwner, { ownerId: OWNER_ID });
    return NextResponse.json({ ok: true, generations });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load generations." },
      { status: 502 },
    );
  }
};

export const DELETE = async (): Promise<NextResponse> => {
  try {
    const convex = getConvexClient();
    await convex.mutation(convexFunctions.generations.clear, { ownerId: OWNER_ID });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to clear generations." },
      { status: 502 },
    );
  }
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body?.kind || !body?.status || !body?.prompt) {
    return NextResponse.json({ error: "kind, status and prompt are required." }, { status: 400 });
  }
  try {
    const convex = getConvexClient();

    // Re-host the provider's temporary URL into permanent Convex storage so the
    // record keeps working after the source link expires. Best-effort.
    let url = body.url as string | undefined;
    if (typeof url === "string" && url.startsWith("http") && !url.includes(".convex.")) {
      try {
        const permanent = (await convex.action(convexFunctions.storage.persistFromUrl, { url })) as string | null;
        if (permanent) url = permanent;
      } catch {
        // keep original url if persistence fails
      }
    }

    const id = await convex.mutation(convexFunctions.generations.log, {
      ownerId: OWNER_ID,
      kind: body.kind,
      status: body.status,
      prompt: body.prompt,
      model: body.model,
      url,
      type: body.type,
      characterName: body.characterName,
      shot: body.shot,
      error: body.error,
    });
    return NextResponse.json({ ok: true, id, url });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to log generation." },
      { status: 502 },
    );
  }
};
