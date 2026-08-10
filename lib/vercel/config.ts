export class VercelNotConfiguredError extends Error {
  constructor() {
    super("Integração Vercel não configurada no servidor.");
    this.name = "VercelNotConfiguredError";
  }
}

export class VercelApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "VercelApiError";
    this.status = status;
  }
}

export function getVercelConfig() {
  const token = process.env.VERCEL_API_TOKEN ?? process.env.VERCEL_TOKEN ?? "";
  const projectId = process.env.VERCEL_PROJECT_ID ?? "";
  const teamId = process.env.VERCEL_TEAM_ID ?? "";

  return {
    token,
    projectId,
    teamId,
    configured: Boolean(token && projectId),
  };
}

export function assertVercelConfigured() {
  const config = getVercelConfig();
  if (!config.configured) {
    throw new VercelNotConfiguredError();
  }
  return config;
}
