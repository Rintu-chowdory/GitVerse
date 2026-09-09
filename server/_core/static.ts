import express, { type Express } from "express";
import fs from "fs";
import path from "path";

/**
 * Serve the built client (dist/public) in production mode.
 *
 * Kept in its own module — separate from the Vite dev-server code — so that
 * serverless bundles (Vercel) never trace into Vite's optional native
 * dependencies (lightningcss, esbuild binaries), which are not available in
 * the serverless runtime.
 */
export function serveStatic(app: Express) {
  // import.meta is empty in CJS bundles (e.g. some serverless entries),
  // so fall back to cwd instead of throwing on undefined.
  const baseDir = import.meta.dirname ?? process.cwd();
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(baseDir, "../..", "dist", "public")
      : path.resolve(baseDir, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
