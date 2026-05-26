// Auth.js (NextAuth v5) configuration.
//
// Access is restricted to users whose Google account email belongs to one
// of the listed Workspace domains. Google verifies the email cryptographically
// during the OAuth flow — the signIn callback simply gates on the verified
// `profile.email` value and rejects everything else.

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const ALLOWED_DOMAINS = ["onlinesales.ai", "osmos.ai"];

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  pages: { signIn: "/login" },
  callbacks: {
    // Runs on every sign-in attempt. Returning false aborts the flow and
    // bounces the user back to /login?error=AccessDenied.
    signIn({ profile }) {
      // `email_verified` is set by Google for any properly-provisioned
      // Workspace account; the extra check is belt-and-suspenders.
      if (!profile?.email || profile.email_verified !== true) return false;
      // Exact-match on the part after "@" — `endsWith` would let
      // "@evil-onlinesales.ai" through.
      const domain = profile.email.split("@")[1]?.toLowerCase();
      return !!domain && ALLOWED_DOMAINS.includes(domain);
    },
  },
});
