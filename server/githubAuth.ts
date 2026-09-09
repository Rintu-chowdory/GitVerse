import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import * as db from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";

/**
 * Self-hosted GitHub OAuth (web application flow).
 *
 * The Manus OAuth portal is not available outside the original platform, so
 * "Connect your GitHub workspace" is wired directly to GitHub. Requires:
 *   - GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET (GitHub OAuth app credentials)
 *   - JWT_SECRET (session signing)
 *   - DATABASE_URL (MySQL, to persist users + monitoring preferences)
 * When not configured the routes redirect home with a friendly error flag
 * instead of crashing or dead-ending the user.
 */

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_USER_URL = "https://api.github.com/user";

// Read-only scopes — matches the app's "read-only connection" promise.
const GITHUB_SCOPES = ["read:user", "read:org"];

const STATE_COOKIE_NAME = "gitverse_oauth_state";

function redirectHome(res: Response, params: Record<string, string>) {
  // Express resolves relative redirects against the request host.
  const search = new URLSearchParams(params).toString();
  res.redirect(302, search ? `/?${search}` : "/");
}

function originFrom(req: Request): string {
  // Behind proxies (Render/Railway/nginx) the original protocol/host is
  // forwarded in headers; fall back to direct request values.
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "http";
  const forwardedHost = req.headers["x-forwarded-host"] as string | undefined;
  const host = forwardedHost || req.headers.host || `localhost:${req.socket.localPort || 3000}`;
  return `${proto}://${host}`;
}

function isGithubConfigured(): boolean {
  return Boolean(ENV.githubClientId && ENV.githubClientSecret);
}

export function registerGithubAuthRoutes(app: Express) {
  // Step 1: send the user to GitHub's consent screen.
  app.get("/api/auth/github/start", (req: Request, res: Response) => {
    if (!isGithubConfigured()) {
      return redirectHome(res, { auth_error: "github_not_configured" });
    }
    if (!ENV.cookieSecret) {
      return redirectHome(res, { auth_error: "server_not_configured" });
    }

    const nonce = randomUUID();
    const redirectUri = `${originFrom(req)}/api/auth/github/callback`;
    const authorizeUrl = new URL(GITHUB_AUTHORIZE_URL);
    authorizeUrl.searchParams.set("client_id", ENV.githubClientId);
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("scope", GITHUB_SCOPES.join(" "));
    authorizeUrl.searchParams.set("state", nonce);

    res.setHeader(
      "Set-Cookie",
      `${STATE_COOKIE_NAME}=${encodeURIComponent(nonce)}; Path=/; Max-Age=600; SameSite=Lax; HttpOnly${protoIsSecure(req) ? "; Secure" : ""}`
    );
    res.redirect(302, authorizeUrl.toString());
  });

  // Step 2: GitHub redirects back with ?code=...&state=...
  app.get("/api/auth/github/callback", async (req: Request, res: Response) => {
    const { code, state } = req.query;
    if (typeof code !== "string" || typeof state !== "string") {
      return redirectHome(res, { auth_error: "missing_code" });
    }

    // CSRF guard: state must match the cookie set in /start.
    const cookies = parseCookieHeader(req.headers.cookie ?? "");
    const expectedState = cookies[STATE_COOKIE_NAME];
    if (!expectedState || expectedState !== state) {
      return redirectHome(res, { auth_error: "invalid_state" });
    }
    res.setHeader("Set-Cookie", `${STATE_COOKIE_NAME}=; Path=/; Max-Age=0`);

    try {
      if (!isGithubConfigured() || !ENV.cookieSecret) {
        return redirectHome(res, { auth_error: "github_not_configured" });
      }

      // Exchange the authorization code for an access token.
      const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: ENV.githubClientId,
          client_secret: ENV.githubClientSecret,
          code,
          redirect_uri: `${originFrom(req)}/api/auth/github/callback`,
        }),
      });
      if (!tokenResponse.ok) {
        console.error("[GitHub Auth] Token exchange failed:", tokenResponse.status);
        return redirectHome(res, { auth_error: "token_exchange_failed" });
      }
      const tokenData = (await tokenResponse.json()) as { access_token?: string; error?: string };
      if (!tokenData.access_token) {
        console.error("[GitHub Auth] No access token:", tokenData.error);
        return redirectHome(res, { auth_error: "token_exchange_failed" });
      }

      // Read-only lookup of the signed-in GitHub user.
      const userResponse = await fetch(GITHUB_USER_URL, {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "GitVerse",
        },
      });
      if (!userResponse.ok) {
        console.error("[GitHub Auth] User lookup failed:", userResponse.status);
        return redirectHome(res, { auth_error: "user_lookup_failed" });
      }
      const githubUser = (await userResponse.json()) as {
        id: number;
        login: string;
        name: string | null;
        email: string | null;
      };

      const openId = `github:${githubUser.id}`;
      const displayName = githubUser.name || githubUser.login;

      // Persist the user (no-op without DATABASE_URL — session still works).
      await db.upsertUser({
        openId,
        name: displayName,
        email: githubUser.email ?? null,
        loginMethod: "github",
        lastSignedIn: new Date(),
      });

      // Sign a session with the same mechanism the rest of the app verifies.
      const sessionToken = await sdk.createSessionToken(openId, {
        name: displayName,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      return redirectHome(res, { auth_success: "1" });
    } catch (error) {
      console.error("[GitHub Auth] Callback failed", error);
      return redirectHome(res, { auth_error: "callback_failed" });
    }
  });
}

function protoIsSecure(req: Request): boolean {
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "http";
  return proto === "https";
}

// Re-exported so index.ts registers both auth systems; the Manus portal route
// stays for platforms where it exists, GitHub OAuth works everywhere.
export const GITHUB_AUTH_PATHS = ["/api/auth/github/start", "/api/auth/github/callback"];
