import { NextRequest, NextResponse } from "next/server";
import { getKieEnv } from "@/lib/kie/env";

const UPLOAD_URL = "https://kieai.redpandaai.co/api/file-base64-upload";

export const maxDuration = 60;

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  let body: { base64Data?: string; fileName?: string };
  try {
    body = (await request.json()) as { base64Data?: string; fileName?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }
  if (!body.base64Data?.trim()) {
    return NextResponse.json({ error: "base64Data is required." }, { status: 400 });
  }

  let apiKey: string;
  try {
    apiKey = getKieEnv().apiKey;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Kie not configured." },
      { status: 500 },
    );
  }

  try {
    const response = await fetch(UPLOAD_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        base64Data: body.base64Data,
        uploadPath: "images/heroframe",
        fileName: body.fileName || `ref-${Date.now()}.png`,
      }),
    });
    const text = await response.text();
    const parsed = text ? (JSON.parse(text) as { data?: { downloadUrl?: string }; msg?: string }) : null;
    const url = parsed?.data?.downloadUrl;
    if (!response.ok || !url) {
      throw new Error(parsed?.msg ?? `Upload failed (HTTP ${response.status}).`);
    }
    return NextResponse.json({ ok: true, url });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Upload failed." },
      { status: 502 },
    );
  }
};
