export const ENV = {
  // Falls back to a static id when unset: this self-hosted deployment has no
  // Manus platform to assign one, but session tokens still require a
  // non-empty appId field (see sdk.ts SessionPayload) for GitHub-based auth.
  appId: process.env.VITE_APP_ID || "gitverse",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  githubToken: process.env.GITHUB_TOKEN ?? "",
  githubClientId: process.env.GITHUB_CLIENT_ID ?? "",
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
  cronSecret: process.env.CRON_SECRET ?? "",
};
