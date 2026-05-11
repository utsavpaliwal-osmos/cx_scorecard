// A1 notation for the Sheets API. "Scorecard!A2:S" means:
//   - tab named "Scorecard"
//   - rows from A2 (skipping the header row) through column S
//   - no row limit (all rows downward).

export const SCORECARD_TAB = "Scorecard";

export const SCORECARD_DATA_RANGE = `${SCORECARD_TAB}!A2:S`;
