// One of the big colored stat cards at the top of the dashboard.
// Renders as a <div> by default, but turns into a real <button> when an
// onClick is passed — that gives keyboard focus, hover feedback, etc. for free.

import { cn } from "@/lib/utils";

export type MetricVariant = "default" | "success" | "warning" | "danger";

const VARIANT_ACCENT: Record<MetricVariant, string> = {
  default: "var(--brand)",
  success: "var(--status-healthy)",
  warning: "var(--status-at-risk)",
  danger: "var(--status-critical)",
};

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  variant?: MetricVariant;
  onClick?: () => void;
  className?: string;
}

export function MetricCard({
  label,
  value,
  subtext,
  variant = "default",
  onClick,
  className,
}: MetricCardProps) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "rounded-lg bg-white p-6 text-center",
        onClick && "cursor-pointer transition-shadow hover:shadow-sm",
        className,
      )}
      style={{ borderTop: `4px solid ${VARIANT_ACCENT[variant]}` }}
    >
      <div className="text-sm font-bold uppercase tracking-wider text-black">
        {label}
      </div>
      <div className="mt-2 text-5xl font-bold text-black tabular-nums">{value}</div>
      {subtext ? <div className="mt-2 text-sm font-bold text-black">{subtext}</div> : null}
    </Tag>
  );
}
