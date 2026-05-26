// Next.js 16 "proxy" — runs on every request matched by `config.matcher`
// before the route renders. Redirects unauthenticated users to /login;
// lets the auth-flow routes (/login, /api/auth/*) through unconditionally
// so the sign-in can complete.

import { auth } from "@/auth";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const path = req.nextUrl.pathname;
  const isAuthRoute = path.startsWith("/api/auth") || path === "/login";

  if (!isLoggedIn && !isAuthRoute) {
    const loginUrl = new URL("/login", req.nextUrl);
    return Response.redirect(loginUrl);
  }
});

// Match everything except Next.js static assets and the favicon. The auth
// routes are allowed through inside the handler above, not excluded here,
// so that `req.auth` is still populated for them.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
