import { NextRequest, NextResponse } from "next/server";
import { verifyWaveSpeedWebhookSignature } from "@/lib/wavespeed/auth";
import { getWaveSpeedEnv } from "@/lib/wavespeed/env";
import type { WaveSpeedWebhookEvent } from "@/types/wavespeed";

const toStatus = (status: string | undefined): "queued" | "running" | "succeeded" | "failed" | "unknown" => {
  const normalized = status?.toLowerCase();
  if (!normalized) return "unknown";
  if (normalized.includes("success") || normalized.includes("completed")) return "succeeded";
  if (normalized.includes("fail") || normalized.includes("error")) return "failed";
  if (normalized.includes("run") || normalized.includes("process")) return "running";
  if (normalized.includes("queue") || normalized.includes("pending")) return "queued";
  return "unknown";
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const wavespeedEnv = getWaveSpeedEnv();
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("webhook-signature");

  if (wavespeedEnv.webhookSigningSecret) {
    const valid = verifyWaveSpeedWebhookSignature({
      rawBody,
      signatureHeader,
      secret: wavespeedEnv.webhookSigningSecret,
    });
    if (!valid) {
      return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
    }
  }

  let event: WaveSpeedWebhookEvent;
  try {
    event = JSON.parse(rawBody) as WaveSpeedWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  const mappedStatus = toStatus(event.status);
  const runId = event.metadata?.runId ?? null;
  const fingerprint = event.metadata?.fingerprint ?? null;

  return NextResponse.json({
    ok: true,
    runId,
    fingerprint,
    mappedStatus,
  });
};
