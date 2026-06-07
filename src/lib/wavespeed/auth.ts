import { createHmac, timingSafeEqual } from "node:crypto";

export const getWaveSpeedAuthHeaders = (apiKey: string): HeadersInit => ({
  Authorization: `Bearer ${apiKey}`,
  "Content-Type": "application/json",
});

type ParsedSignature = {
  version: string;
  signature: string;
};

const parseSignatureHeader = (headerValue: string | null): ParsedSignature | null => {
  if (!headerValue) return null;
  const parts = headerValue.split(",");
  if (parts.length !== 2) return null;
  const version = parts[0]?.trim();
  const signature = parts[1]?.trim();
  if (!version || !signature) return null;
  return { version, signature };
};

const hexToBuffer = (value: string): Buffer | null => {
  try {
    return Buffer.from(value, "hex");
  } catch {
    return null;
  }
};

export const verifyWaveSpeedWebhookSignature = ({
  rawBody,
  signatureHeader,
  secret,
}: {
  rawBody: string;
  signatureHeader: string | null;
  secret: string;
}): boolean => {
  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const givenBuffer = hexToBuffer(parsed.signature);
  const expectedBuffer = hexToBuffer(expected);
  if (!givenBuffer || !expectedBuffer) return false;
  if (givenBuffer.length !== expectedBuffer.length) return false;

  return timingSafeEqual(givenBuffer, expectedBuffer);
};
