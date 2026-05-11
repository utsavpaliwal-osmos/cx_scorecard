// Builds an authenticated Google Sheets API client using a service-account JWT.
// Server-only — never import from a client component (would leak the private key).

import { sheets, auth as googleAuth, type sheets_v4 } from "@googleapis/sheets";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

// Cache one client per Node process so we don't recreate the JWT on every request.
let cachedClient: sheets_v4.Sheets | null = null;

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

export function getSheetsClient(): sheets_v4.Sheets {
  if (cachedClient) return cachedClient;

  const email = requireEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const rawKey = requireEnv("GOOGLE_PRIVATE_KEY");
  // .env files often store the PEM as a single line with literal "\n".
  // Convert those back to real newlines so OpenSSL can parse the key.

  const privateKey = rawKey.replace(/\\n/g, "\n");

  const jwt = new googleAuth.JWT({
    email,
    key: privateKey,
    scopes: [SHEETS_SCOPE],
  });

  cachedClient = sheets({ version: "v4", auth: jwt });
  return cachedClient;
}

export function getSheetId(): string {
  return requireEnv("GOOGLE_SHEETS_ID");
}
