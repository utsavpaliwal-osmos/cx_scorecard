// Single source of truth for the dashboard data shape.
// Both the parser (writes these) and the UI (reads them) import from here.

export type ClientType = "Strategic" | "Named" | "Core";

export type Stage = "Validation" | "Steady" | "Growth";

export type HealthStatus = "Healthy" | "At Risk" | "Critical";

export type ComponentScore = number | "NA" | null;

export interface ComponentScores {
  goalMet: ComponentScore;
  execEngagement: ComponentScore;
  execSentiment: ComponentScore;
  dmEngagement: ComponentScore;
  dmSentiment: ComponentScore;
  wbrQbr: ComponentScore;
  legoAdoption: ComponentScore;
  dauMau: ComponentScore;
  slaCompliance: ComponentScore;
  projectDelays: ComponentScore;
}

export interface Client {
  name: string;
  clientType: ClientType;
  stage: Stage;
  arrDisplay: string;
  arrNumeric: number;
  components: ComponentScores;
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
  segments: SegmentSummary[];
  generatedAt: string;
}
