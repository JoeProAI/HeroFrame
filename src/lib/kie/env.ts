const optionalServerEnv = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

// Non-secret config (base URL + callback). No API key here — BYOK supplies it.
export const getKieConfig = () => ({
  baseUrl: (optionalServerEnv(process.env.KIE_API_BASE_URL) ?? "https://api.kie.ai").replace(/\/$/, ""),
  callbackBaseUrl: optionalServerEnv(process.env.KIE_CALLBACK_BASE_URL),
});

// Strict BYOK: the key must come from the request header. No env fallback, so a
// shared deployment never spends the owner's credits.
export const resolveKieKey = (headerKey: string | null | undefined): string => {
  const key = headerKey?.trim();
  if (!key) {
    throw new Error("No Kie API key provided. Add your key in Settings.");
  }
  return key;
};
