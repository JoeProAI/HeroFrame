import { NextRequest, NextResponse } from "next/server";
import { getConvexClient } from "@/lib/convex";
import { convexFunctions } from "@/lib/convex-functions";
import { OWNER_ID } from "@/lib/owner";

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
    const id = await convex.mutation(convexFunctions.generations.log, {
      ownerId: OWNER_ID,
      kind: body.kind,
      status: body.status,
      prompt: body.prompt,
      model: body.model,
      url: body.url,
      type: body.type,
      characterName: body.characterName,
      shot: body.shot,
      error: body.error,
    });
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to log generation." },
      { status: 502 },
    );
  }
};
