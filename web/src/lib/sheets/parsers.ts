// Turns raw cell rows from the Sheet into typed dashboard data.
// Each row is an array indexed by column position (col 0 = Client Name, etc.) —
// see parseRow() below for the full column → field mapping.

import { z } from "zod";
import { formatArr, parseArr } from "@/lib/format";
import type {
  Client,
  ClientType,
  ComponentScore,
  ComponentScores,
  DashboardData,
  HealthStatus,
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

// Sheet column layout (0-indexed):
//   0  Client Name           10 LEGO Adoption
//   1  Client Type           11 DAU/MAU
//   2  Stage                 12 SLA Compliance
//   3  ARR (display)         13 Project Delays
//   4  Goal Met              14 Composite Score
//   5  Exec Engagement       15 Health Status
//   6  Exec Sentiment        16 Last Updated
//   7  DM Engagement         17 Red Flags
//   8  DM Sentiment          18 Email Domains
//   9  WBR/QBR
export function parseRow(row: unknown[], rowIndex: number): Client {
  const get = (i: number): unknown => row[i] ?? "";

  const name = toStringField(get(0));
  if (!name) throw new Error(`Row ${rowIndex}: missing client name`);

  const clientType: ClientType = clientTypeSchema.parse(toStringField(get(1)));
  const stage: Stage = stageSchema.parse(toStringField(get(2)));
  const arrDisplay = toStringField(get(3));
  const healthStatus: HealthStatus = healthStatusSchema.parse(toStringField(get(15)));

  const components: ComponentScores = {
    goalMet: toComponentScore(get(4)),
    execEngagement: toComponentScore(get(5)),
    execSentiment: toComponentScore(get(6)),
    dmEngagement: toComponentScore(get(7)),
    dmSentiment: toComponentScore(get(8)),
    wbrQbr: toComponentScore(get(9)),
    legoAdoption: toComponentScore(get(10)),
    dauMau: toComponentScore(get(11)),
    slaCompliance: toComponentScore(get(12)),
    projectDelays: toComponentScore(get(13)),
  };

  return {
    name,
    clientType,
    stage,
    arrDisplay,
    arrNumeric: parseArr(arrDisplay),
    components,
    compositeScore: toCompositeScore(get(14)),
    healthStatus,
    redFlags: toStringField(get(17)),
    emailDomains: toEmailDomains(get(18)),
    lastUpdated: toLastUpdated(get(16)),
  };
}

// Top-level entry: raw rows → parsed clients → totals + per-segment summaries.
export function buildDashboardData(rows: unknown[][]): DashboardData {
  const clients: Client[] = rows
    // Skip empty rows (the Sheet may have trailing blanks).
    .filter((row) => Array.isArray(row) && toStringField(row[0]) !== "")
    // idx + 2 because the range starts at A2; row 0 here is sheet row 2.
    .map((row, idx) => parseRow(row, idx + 2));

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
