// Browser-side fetch wrapper. Calls our own /api/sheets route (not Google directly).
// The actual Sheets API call happens server-side inside that route.

import type { DashboardData } from "@/types/scorecard";

export async function fetchDashboardData(): Promise<DashboardData> {
  // cache: "no-store" stops the browser/Next from serving a stale response on refresh.
  const response = await fetch("/api/sheets", { cache: "no-store" });
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // Body wasn't JSON — keep the generic status-based message above.
    }
    throw new Error(message);
  }
  return (await response.json()) as DashboardData;
}
