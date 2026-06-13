import { NextRequest, NextResponse } from "next/server";
import { getConvexClient } from "@/lib/convex";
import { convexFunctions } from "@/lib/convex-functions";

export const maxDuration = 60;

// Uploads a user's reference image straight into Convex storage and returns a
// permanent URL. No third-party key required.
export const POST = async (request: NextRequest): Promise<NextResponse> => {
  let body: { base64Data?: string };
  try {
    body = (await request.json()) as { base64Data?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }
  if (!body.base64Data?.trim()) {
    return NextResponse.json({ error: "base64Data is required." }, { status: 400 });
  }

  try {
    const convex = getConvexClient();
    const url = (await convex.action(convexFunctions.storage.persistBase64, {
      base64: body.base64Data,
    })) as string | null;
    if (!url) throw new Error("Storage returned no URL.");
    return NextResponse.json({ ok: true, url });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Upload failed." },
      { status: 502 },
    );
  }
};
