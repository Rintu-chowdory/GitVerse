export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Start the sign-in flow. GitVerse signs in through GitHub OAuth
// (`/api/auth/github/start`), which works both on the original platform and
// on a self-hosted clone. The server redirects to GitHub's consent screen —
// or back home with a friendly `auth_error` query flag when GitHub OAuth
// credentials are not configured yet.
//
// It has SIDE EFFECTS (cookie + navigation), so call it from an event
// handler or effect — never during render.
export const startLogin = () => {
  window.location.href = `/api/auth/github/start`;
};
