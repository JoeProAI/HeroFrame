import { NextRequest, NextResponse } from "next/server";
import { getConvexClient } from "@/lib/convex";
import { convexFunctions } from "@/lib/convex-functions";
import { OWNER_ID } from "@/lib/owner";

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  const scope = request.nextUrl.searchParams.get("scope") ?? "active";
  try {
    const convex = getConvexClient();
    const fn = scope === "deleted" ? convexFunctions.characters.listDeleted : convexFunctions.characters.list;
    const characters = await convex.query(fn, { ownerId: OWNER_ID });
    return NextResponse.json({ ok: true, characters });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load characters." },
      { status: 502 },
    );
  }
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const body = (await request.json().catch(() => null)) as
    | { name?: string; referenceUrl?: string; notes?: string }
    | null;
  if (!body?.name?.trim() || !body.referenceUrl?.trim()) {
    return NextResponse.json({ error: "name and referenceUrl are required." }, { status: 400 });
  }
  try {
    const convex = getConvexClient();
    const id = await convex.mutation(convexFunctions.characters.create, {
      ownerId: OWNER_ID,
      name: body.name.trim(),
      referenceUrl: body.referenceUrl.trim(),
      notes: body.notes?.trim() || undefined,
    });
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to create character." },
      { status: 502 },
    );
  }
};

export const PATCH = async (request: NextRequest): Promise<NextResponse> => {
  const body = (await request.json().catch(() => null)) as
    | { id?: string; action?: "delete" | "restore" | "purge" }
    | null;
  if (!body?.id || !body.action) {
    return NextResponse.json({ error: "id and action are required." }, { status: 400 });
  }
  const fnByAction = {
    delete: convexFunctions.characters.softDelete,
    restore: convexFunctions.characters.restore,
    purge: convexFunctions.characters.purge,
  } as const;
  try {
    const convex = getConvexClient();
    await convex.mutation(fnByAction[body.action], { id: body.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to update character." },
      { status: 502 },
    );
  }
};
