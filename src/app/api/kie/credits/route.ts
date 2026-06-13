import { NextRequest, NextResponse } from "next/server";
import { getKieCredits } from "@/lib/kie/client";
import { resolveKieKey } from "@/lib/kie/env";

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  let apiKey: string;
  try {
    apiKey = resolveKieKey(request.headers.get("x-kie-key"));
  } catch {
    // No key yet — report null credits instead of erroring.
    return NextResponse.json({ ok: true, credits: null });
  }
  try {
    const credits = await getKieCredits(apiKey);
    return NextResponse.json({ ok: true, credits });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to read credits." },
      { status: 502 },
    );
  }
};
