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

export const getGhostEnv = () => ({
  apiUrl: requiredServerEnv(process.env.GHOST_API_URL, "GHOST_API_URL").replace(/\/$/, ""),
  adminApiKey: requiredServerEnv(process.env.GHOST_ADMIN_API_KEY, "GHOST_ADMIN_API_KEY"),
  contentApiKey: optionalServerEnv(process.env.GHOST_CONTENT_API_KEY),
});
