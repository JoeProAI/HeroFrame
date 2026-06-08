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

export const getKieEnv = () => ({
  apiKey: requiredServerEnv(process.env.KIE_API_KEY, "KIE_API_KEY"),
  baseUrl: (optionalServerEnv(process.env.KIE_API_BASE_URL) ?? "https://api.kie.ai").replace(/\/$/, ""),
  callbackBaseUrl: optionalServerEnv(process.env.KIE_CALLBACK_BASE_URL),
});
