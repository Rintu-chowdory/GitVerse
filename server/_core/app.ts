import "dotenv/config";
import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerGithubAuthRoutes } from "../githubAuth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { registerOAuthRoutes } from "./oauth";
import { checkGithubRepositories } from "../scheduled";
import { registerScheduledRoutes } from "../scheduledSelfHosted";
import { registerSetupRoutes } from "../setupDatabase";
import { registerStorageProxy } from "./storageProxy";
import { serveStatic } from "./static";

/**
 * Build the Express app (routes + middleware) without opening a port.
 *
 * The app is created once per runtime:
 * - Locally / on a container host (Render etc.) `index.ts` calls createApp()
 *   and listens on PORT.
 * - On Vercel, `vercel.ts` calls createApp() inside a serverless function.
 */
export async function createApp(): Promise<{ app: Express; server: Server }> {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  // Self-hosted GitHub OAuth — works outside the Manus platform.
  registerGithubAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  app.post("/api/scheduled/check-github", checkGithubRepositories);
  // Self-hosted scheduled checks + one-time DB bootstrap (cron-secret protected)
  registerScheduledRoutes(app);
  registerSetupRoutes(app);
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    // Hidden dynamic import: `new Function` defeats static analysis, so
    // bundlers/serverless tracers (esbuild, Vercel nft) never follow this
    // into the Vite dev server and its optional native dependencies
    // (lightningcss, esbuild binaries) — those break serverless runtimes.
    // Resolved at runtime relative to this module.
    // Under tsx (dev) the module is vite.ts; compiled/bundled output is vite.js.
    const viteModuleBase = import.meta.url.replace(/\/[^/]*$/, "/vite");
    const dynamicImport = new Function("m", "return import(m);") as (
      m: string
    ) => Promise<typeof import("./vite")>;
    const viteModule = await dynamicImport(viteModuleBase + ".js").catch(() =>
      dynamicImport(viteModuleBase + ".ts")
    );
    await viteModule.setupVite(app, server);
  } else {
    serveStatic(app);
  }
  return { app, server };
}
