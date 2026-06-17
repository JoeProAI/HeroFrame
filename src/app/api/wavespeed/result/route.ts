import { NextRequest, NextResponse } from "next/server";
import { getWaveSpeedPrediction } from "@/lib/wavespeed/client";

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  const predictionId = request.nextUrl.searchParams.get("id")?.trim();
  if (!predictionId) {
    return NextResponse.json({ ok: false, error: "id is required." }, { status: 400 });
  }

  try {
    const response = await getWaveSpeedPrediction(predictionId);
    const text = await response.text();
    let payload: unknown = null;
    try {
      payload = text ? (JSON.parse(text) as unknown) : null;
    } catch {
      payload = { raw: text };
    }

    if (!response.ok) {
      return NextResponse.json({ ok: false, status: response.status, error: payload }, { status: response.status });
    }

    return NextResponse.json({ ok: true, data: payload });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "WaveSpeed prediction lookup failed." },
      { status: 502 },
    );
  }
};
