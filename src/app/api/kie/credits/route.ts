import { NextResponse } from "next/server";
import { getKieCredits } from "@/lib/kie/client";

export const GET = async (): Promise<NextResponse> => {
  try {
    const credits = await getKieCredits();
    return NextResponse.json({ ok: true, credits });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to read credits." },
      { status: 502 },
    );
  }
};
