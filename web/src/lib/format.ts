// Display formatters: ARR strings ↔ numbers, score formatting, health bands.

import type { ComponentScore, HealthStatus } from "@/types/scorecard";

export function parseArr(display: string): number {
  const trimmed = display.trim();
  if (!trimmed) return 0;
  const match = trimmed.match(/^(-?[\d.]+)\s*([KMB]?)$/i);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const suffix = match[2].toUpperCase();
  const multiplier = suffix === "B" ? 1e9 : suffix === "M" ? 1e6 : suffix === "K" ? 1e3 : 1;
  return value * multiplier;
}

export function formatArr(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return `$${value.toFixed(0)}`;
}

export function formatComponentScore(score: ComponentScore): string {
  if (score === null || score === "NA") return "—";
  return String(Math.round(score));
}

export function healthFromCompositeScore(score: number): HealthStatus {
  if (score >= 75) return "Healthy";
  if (score >= 60) return "At Risk";
  return "Critical";
}
