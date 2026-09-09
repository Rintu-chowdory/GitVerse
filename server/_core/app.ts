import "dotenv/config";
import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerGithubAuthRoutes } from "../githubAuth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { registerOAuthRoutes } from "./oauth";
import { checkGithubRepositories } from "../scheduled";
import { registerStorageProxy } from "./storageProxy";
import { serveStatic, setupVite } from "./vite";

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
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  return { app, server };
}
