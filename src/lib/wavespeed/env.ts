const requiredServerEnv = (value: string | undefined, key: string): string => {
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value.trim();
};

const optionalServerEnv = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export const wavespeedEnv = {
  apiKey: requiredServerEnv(process.env.WAVESPEED_API_KEY, "WAVESPEED_API_KEY"),
  baseUrl: optionalServerEnv(process.env.WAVESPEED_API_BASE_URL) ?? "https://api.wavespeed.ai",
  webhookSigningSecret: optionalServerEnv(process.env.WAVESPEED_WEBHOOK_SECRET),
  callbackBaseUrl: optionalServerEnv(process.env.WAVESPEED_CALLBACK_BASE_URL),
};
