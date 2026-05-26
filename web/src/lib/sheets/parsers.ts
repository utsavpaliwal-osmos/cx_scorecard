// Turns raw cell rows from the Sheet into typed dashboard data.
//
// The parser is header-driven:
//   - The first row of each input is treated as the header.
//   - "Metadata" columns (client name, type, stage, ARR, health status, etc.)
//     are matched via small alias lists below, so cosmetic header variations
//     like "ARR" vs "ARR($)" are tolerated without code changes.
//   - Everything else in the header row is a dynamic metric column. Its
//     display label is the literal header text; its lookup key is the
//     normalized (lowercased) header. The UI iterates over whatever
//     metrics were discovered, so adding/renaming/reordering score columns
//     in the Sheet flows through automatically.

import { z } from "zod";
import { formatArr, parseArr } from "@/lib/format";
import { SCORECARD_DETAILS_TAB, SCORECARD_TAB } from "./ranges";
import type {
  Client,
  ClientType,
  ComponentScore,
  DashboardData,
  HealthStatus,
  MetricDefinition,
  SegmentSummary,
  Stage,
} from "@/types/scorecard";

// Zod enums act as both runtime validation and type narrowing — if the Sheet
// has an unexpected value (e.g. "core" lowercase), parsing throws loudly.

const clientTypeSchema = z.enum(["Strategic", "Named", "Core"]);
const stageSchema = z.enum(["Validation", "Steady", "Growth"]);
const healthStatusSchema = z.enum(["Healthy", "At Risk", "Critical"]);

function toComponentScore(raw: unknown): ComponentScore {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (trimmed.toUpperCase() === "NA") return "NA";
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  return null;
}

function toCompositeScore(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const parsed = Number(raw.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  throw new Error(`Invalid composite score: ${String(raw)}`);
}

function toStringField(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  return String(raw).trim();
}

function toEmailDomains(raw: unknown): string[] {
  return toStringField(raw)
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
}

function toLastUpdated(raw: unknown): string | null {
  const value = toStringField(raw);
  return value === "" ? null : value;
}

// Aliases for the well-known "metadata" columns. Each field accepts any of
// the listed header texts (case-insensitive). The first alias is the
// canonical name used in error messages. Add a new alias if the Sheet
// header changes; no other code needs to know about it.
const META_HEADERS = {
  name: ["Client Name", "Client", "Name"],
  clientType: ["Client Type", "Type", "Segment"],
  stage: ["Stage"],
  arr: ["ARR($)", "ARR ($)", "ARR (USD)", "ARR"],
  healthStatus: ["Health Status", "Health"],
  lastUpdated: ["Last Updated", "Updated"],
  redFlags: ["Red Flags", "Risks"],
  emailDomains: ["Email Domains", "Domains"],
} as const;

// Aliases for the composite column. Composite is also a metric (it appears
// in `DashboardData.metrics`), but the parser needs to identify it so it
// can populate `Client.compositeScore` for sorting and the score badge.
const COMPOSITE_HEADERS = ["Composite Score", "Composite", "Overall Score"] as const;

// Headers present in the Sheet that should not appear as score columns in
// the dashboard UI. Non-score data (contact info, segmentation attributes)
// the dashboard doesn't surface. Add headers here to hide them from the
// table/popup without further code changes.
const IGNORED_HEADERS = ["Email Domain", "Geography", "Vertical"] as const;

// Pre-computed set of every header (lowercased) that discoverMetrics should
// skip — metadata columns the app reads as typed fields, plus columns we
// explicitly choose not to expose in the UI.
const NON_METRIC_HEADER_SET = new Set<string>(
  [...Object.values(META_HEADERS).flat(), ...IGNORED_HEADERS].map((h) => h.toLowerCase()),
);

// Looks up a column index by header text. `find` accepts a list of aliases
// and returns the first one present; throws if none match.
class HeaderIndex {
  private readonly columns: Map<string, number>;

  constructor(
    headerRow: unknown[],
    private readonly tabName: string,
  ) {
    this.columns = new Map();
    headerRow.forEach((cell, i) => {
      const key = toStringField(cell).toLowerCase();
      // First-write-wins so duplicate headers don't shift the canonical column.
      if (key && !this.columns.has(key)) this.columns.set(key, i);
    });
  }

  has(name: string): boolean {
    return this.columns.has(name.toLowerCase());
  }

  find(aliases: readonly string[]): number {
    const i = this.findOptional(aliases);
    if (i === null) {
      throw new Error(
        `${this.tabName}: missing required column "${aliases[0]}" (tried: ${aliases.join(", ")})`,
      );
    }
    return i;
  }

  findOptional(aliases: readonly string[]): number | null {
    for (const alias of aliases) {
      const i = this.columns.get(alias.toLowerCase());
      if (i !== undefined) return i;
    }
    return null;
  }
}

interface DiscoveredMetrics {
  metrics: MetricDefinition[];
  // metric key → column index in the header row
  columnByKey: Map<string, number>;
  compositeKey: string;
}

// Walks the Scorecard header row and returns one MetricDefinition for every
// non-metadata column, in Sheet order. Also identifies which metric is the
// composite (required — `Client.compositeScore` depends on it).
function discoverMetrics(headerRow: unknown[]): DiscoveredMetrics {
  const metrics: MetricDefinition[] = [];
  const columnByKey = new Map<string, number>();
  const compositeAliasesLower = COMPOSITE_HEADERS.map((a) => a.toLowerCase());
  let compositeKey: string | null = null;

  headerRow.forEach((cell, i) => {
    const label = toStringField(cell);
    if (!label) return;
    const keyLower = label.toLowerCase();
    if (NON_METRIC_HEADER_SET.has(keyLower)) return;
    if (columnByKey.has(keyLower)) return; // duplicate header, first wins
    metrics.push({ key: keyLower, label });
    columnByKey.set(keyLower, i);
    if (compositeKey === null && compositeAliasesLower.includes(keyLower)) {
      compositeKey = keyLower;
    }
  });

  if (compositeKey === null) {
    throw new Error(
      `${SCORECARD_TAB}: missing composite score column (tried: ${COMPOSITE_HEADERS.join(", ")})`,
    );
  }
  return { metrics, columnByKey, compositeKey };
}

function parseRow(
  row: unknown[],
  rowIndex: number,
  headers: HeaderIndex,
  discovered: DiscoveredMetrics,
): Client {
  const cellAt = (col: number): unknown => row[col] ?? "";
  const meta = (aliases: readonly string[]): unknown => cellAt(headers.find(aliases));
  // Returns "" when the column is absent — used for metadata fields that
  // aren't critical to the dashboard (last updated, red flags, email domains).
  const optMeta = (aliases: readonly string[]): unknown => {
    const col = headers.findOptional(aliases);
    return col === null ? "" : cellAt(col);
  };

  const name = toStringField(meta(META_HEADERS.name));
  if (!name) throw new Error(`Row ${rowIndex}: missing client name`);

  const clientType: ClientType = clientTypeSchema.parse(toStringField(meta(META_HEADERS.clientType)));
  const stage: Stage = stageSchema.parse(toStringField(meta(META_HEADERS.stage)));
  const arrDisplay = toStringField(meta(META_HEADERS.arr));
  const healthStatus: HealthStatus = healthStatusSchema.parse(
    toStringField(meta(META_HEADERS.healthStatus)),
  );

  const scores: Record<string, ComponentScore> = {};
  for (const m of discovered.metrics) {
    const col = discovered.columnByKey.get(m.key);
    if (col === undefined) continue;
    scores[m.key] = toComponentScore(cellAt(col));
  }

  const compositeCol = discovered.columnByKey.get(discovered.compositeKey);
  if (compositeCol === undefined) {
    throw new Error(`${SCORECARD_TAB}: composite column index missing after discovery`);
  }
  const compositeScore = toCompositeScore(cellAt(compositeCol));

  return {
    name,
    clientType,
    stage,
    arrDisplay,
    arrNumeric: parseArr(arrDisplay),
    scores,
    reasons: {},
    compositeScore,
    healthStatus,
    redFlags: toStringField(optMeta(META_HEADERS.redFlags)),
    emailDomains: toEmailDomains(optMeta(META_HEADERS.emailDomains)),
    lastUpdated: toLastUpdated(optMeta(META_HEADERS.lastUpdated)),
  };
}

// Joins each Scorecard metric to its prose explanation in the Scorecard
// Details tab by matching header text. Metrics whose label isn't present
// in the Details tab are skipped (no reason text — the popup falls back to
// a "no explanation" message). Returns map keyed by lowercased client name.
function parseDetailsRows(
  rows: unknown[][],
  detailsHeaders: HeaderIndex,
  metrics: MetricDefinition[],
): Map<string, Record<string, string>> {
  const nameCol = detailsHeaders.find(META_HEADERS.name);
  const metricColumns = metrics
    .filter((m) => detailsHeaders.has(m.label))
    .map((m) => ({ key: m.key, col: detailsHeaders.find([m.label]) }));

  const result = new Map<string, Record<string, string>>();
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const name = toStringField(row[nameCol]);
    if (!name) continue;
    const reasons: Record<string, string> = {};
    for (const { col, key } of metricColumns) {
      const value = toStringField(row[col]);
      if (value) reasons[key] = value;
    }
    result.set(name.toLowerCase(), reasons);
  }
  return result;
}

// Top-level entry: raw rows → parsed clients → totals + per-segment summaries.
// The first row of each input is the header; remaining rows are data.
export function buildDashboardData(
  scorecardRows: unknown[][],
  detailsRows: unknown[][] = [],
): DashboardData {
  const [scorecardHeaderRow = [], ...scorecardDataRows] = scorecardRows;
  const [detailsHeaderRow = [], ...detailsDataRows] = detailsRows;

  const scorecardHeaders = new HeaderIndex(scorecardHeaderRow, SCORECARD_TAB);
  const detailsHeaders = new HeaderIndex(detailsHeaderRow, SCORECARD_DETAILS_TAB);

  const discovered = discoverMetrics(scorecardHeaderRow);
  const reasonsByName = parseDetailsRows(detailsDataRows, detailsHeaders, discovered.metrics);
  const nameCol = scorecardHeaders.find(META_HEADERS.name);

  const clients: Client[] = scorecardDataRows
    // Skip empty rows (the Sheet may have trailing blanks).
    .filter((row) => Array.isArray(row) && toStringField(row[nameCol]) !== "")
    // idx + 2 because row 1 is the header and row 0 here is sheet row 2.
    .map((row, idx) => {
      const client = parseRow(row, idx + 2, scorecardHeaders, discovered);
      const reasons = reasonsByName.get(client.name.toLowerCase());
      if (reasons) client.reasons = reasons;
      return client;
    });

  const byType: Record<ClientType, Client[]> = {
    Strategic: [],
    Named: [],
    Core: [],
  };
  for (const client of clients) byType[client.clientType].push(client);

  const segments: SegmentSummary[] = (["Strategic", "Named", "Core"] as const).map(
    (clientType) => buildSegment(clientType, byType[clientType]),
  );

  return {
    totals: {
      total: clients.length,
      healthy: clients.filter((c) => c.healthStatus === "Healthy").length,
      atRisk: clients.filter((c) => c.healthStatus === "At Risk").length,
      critical: clients.filter((c) => c.healthStatus === "Critical").length,
    },
    metrics: discovered.metrics,
    compositeKey: discovered.compositeKey,
    segments,
    generatedAt: new Date().toISOString(),
  };
}

function buildSegment(clientType: ClientType, clients: Client[]): SegmentSummary {
  const totalArr = clients.reduce((sum, c) => sum + c.arrNumeric, 0);
  return {
    clientType,
    clientCount: clients.length,
    totalArr,
    arrDisplay: formatArr(totalArr),
    clients: [...clients].sort((a, b) => b.compositeScore - a.compositeScore),
  };
}
