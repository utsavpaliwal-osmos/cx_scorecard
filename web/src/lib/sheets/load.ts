// Reads rows from the Sheet and hands them to the parser. Server-only.

import { getSheetId, getSheetsClient } from "./client";
import { buildDashboardData } from "./parsers";
import { SCORECARD_DATA_RANGE, SCORECARD_DETAILS_DATA_RANGE } from "./ranges";
import type { DashboardData } from "@/types/scorecard";

export async function loadDashboardData(): Promise<DashboardData> {
  const sheets = getSheetsClient();
  // batchGet fetches both tabs in a single round trip. Order of `ranges` is
  // preserved in `valueRanges`, so [0] = Scorecard, [1] = Scorecard Details.
  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: getSheetId(),
    ranges: [SCORECARD_DATA_RANGE, SCORECARD_DETAILS_DATA_RANGE],
    valueRenderOption: "FORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });

  const valueRanges = response.data.valueRanges ?? [];
  const rows = (valueRanges[0]?.values ?? []) as unknown[][];
  const detailsRows = (valueRanges[1]?.values ?? []) as unknown[][];
  return buildDashboardData(rows, detailsRows);
}
