// The colored composite score number shown next to each client name.
// Color (green/yellow/red) reflects health band; renders as a <button> with
// hover-underline when clickable, otherwise a plain <span>.

import { cn } from "@/lib/utils";
import type { HealthStatus } from "@/types/scorecard";

export function bandFromScore(score: number): HealthStatus {
  if (score >= 75) return "Healthy";
  if (score >= 60) return "At Risk";
  return "Critical";
}

const HEALTH_CLASS: Record<HealthStatus, string> = {
  Healthy: "text-status-healthy",
  "At Risk": "text-status-at-risk",
  Critical: "text-status-critical",
};

interface ScoreBadgeProps {
  score: number;
  health?: HealthStatus;
  onClick?: () => void;
  className?: string;
}

export function ScoreBadge({ score, health, onClick, className }: ScoreBadgeProps) {
  const band = health ?? bandFromScore(score);
  const classes = cn("font-bold tabular-nums", HEALTH_CLASS[band], className);

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(classes, "cursor-pointer hover:underline")}
      >
        {score}
      </button>
    );
  }

  return <span className={classes}>{score}</span>;
}
