import express, { type Express, type Request, type Response } from "express";
import { createApp } from "./app";

/**
 * Vercel serverless entry point.
 *
 * vercel.json rewrites every /api/* request to this function (bundled by
 * esbuild into api/index.js during the Vercel build step). The Express app is
 * created lazily on the first request and reused across warm invocations.
 */
let app: Express | null = null;

async function handler(req: Request, res: Response): Promise<void> {
  if (!app) {
    const created = await createApp();
    app = created.app;
  }
  // Express is itself a request handler.
  return void app(req, res);
}

export default handler;
