// A1 notation for the Sheets API. "Scorecard!A1:S" means:
//   - tab named "Scorecard"
//   - rows from A1 (header included) through column S
//   - no row limit (all rows downward).
// The parser uses the header row to map columns by name, so column order
// in the Sheet can change without breaking parsing.

export const SCORECARD_TAB = "Scorecard";
export const SCORECARD_DETAILS_TAB = "Scorecard Details";

export const SCORECARD_DATA_RANGE = `${SCORECARD_TAB}!A1:S`;
// Each metric cell holds the prose explanation for that score rather than
// the number itself. Columns are matched by header name, not position.
export const SCORECARD_DETAILS_DATA_RANGE = `${SCORECARD_DETAILS_TAB}!A1:S`;
