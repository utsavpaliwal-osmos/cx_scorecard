// Reads rows from the Sheet and hands them to the parser. Server-only.

import { getSheetId, getSheetsClient } from "./client";
import { buildDashboardData } from "./parsers";
import { SCORECARD_DATA_RANGE } from "./ranges";
import type { DashboardData } from "@/types/scorecard";

export async function loadDashboardData(): Promise<DashboardData> {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: getSheetId(),
    range: SCORECARD_DATA_RANGE,
    // Use what the user sees in the cell (e.g. "$2.5M") instead of raw numbers.
    valueRenderOption: "FORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });

  const rows = (response.data.values ?? []) as unknown[][];
  return buildDashboardData(rows);
}
