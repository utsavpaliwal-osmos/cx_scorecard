// Auth.js route handler. Auth.js generates GET/POST endpoints for the
// OAuth flow (sign-in redirect, provider callback, session lookup, sign-out)
// under /api/auth/*; this file exposes them to Next.js.

import { handlers } from "@/auth";

export const { GET, POST } = handlers;
