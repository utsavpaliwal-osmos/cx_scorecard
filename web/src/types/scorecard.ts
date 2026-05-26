// Single source of truth for the dashboard data shape.
// Both the parser (writes these) and the UI (reads them) import from here.
//
// The data model is header-driven: the parser discovers score columns from
// the Sheet's header row at parse time. UI components iterate over the
// resulting `DashboardData.metrics` list rather than referring to fixed
// metric names, so adding/renaming/reordering score columns in the Sheet
// flows through automatically.

export type ClientType = "Strategic" | "Named" | "Core";

export type Stage = "Validation" | "Steady" | "Growth";

export type HealthStatus = "Healthy" | "At Risk" | "Critical";

export type ComponentScore = number | "NA" | null;

// One score column discovered in the Sheet. `label` is the literal header
// text (used as a display label); `key` is the normalized lookup key used
// to index into `Client.scores` and `Client.reasons`.
export interface MetricDefinition {
  key: string;
  label: string;
}

export interface Client {
  name: string;
  clientType: ClientType;
  stage: Stage;
  arrDisplay: string;
  arrNumeric: number;
  // Keyed by MetricDefinition.key. Includes every score column, with the
  // composite column appearing as just another entry.
  scores: Record<string, ComponentScore>;
  // Reason text from the Scorecard Details tab. Sparse — only metrics
  // whose Details cell has prose appear here.
  reasons: Record<string, string>;
  // Numeric form of scores[compositeKey]. Extracted at parse time so
  // sorting and the score badge don't have to re-resolve it.
  compositeScore: number;
  healthStatus: HealthStatus;
  redFlags: string;
  emailDomains: string[];
  lastUpdated: string | null;
}

export interface SegmentSummary {
  clientType: ClientType;
  clientCount: number;
  totalArr: number;
  arrDisplay: string;
  clients: Client[];
}

export interface DashboardData {
  totals: {
    total: number;
    healthy: number;
    atRisk: number;
    critical: number;
  };
  // Score columns from the Sheet in column order. Drives the table layout
  // in ClientDetailsModal and the per-client card rows.
  metrics: MetricDefinition[];
  // Which entry in `metrics` is the composite. UI code that treats the
  // composite specially (sort, score badge) keys off this.
  compositeKey: string;
  segments: SegmentSummary[];
  generatedAt: string;
}
