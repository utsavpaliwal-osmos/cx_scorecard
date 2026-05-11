// Server-only API route at GET /api/sheets.
// Reads the Google Sheet via the service account and returns dashboard JSON.
// Browser code never imports this — it lives only on the server.

import { NextResponse } from "next/server";
import { loadDashboardData } from "@/lib/sheets/load";

// Disable Next's route cache so every browser refresh hits the Sheet live.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const data = await loadDashboardData();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[/api/sheets] failed to load dashboard data", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
