// Modal that opens when a number on the dashboard is clicked.
// Two layouts:
//   - "table"  → wide horizontal grid (used for the top 4 metric cards)
//   - "card"   → vertical "label : value" stack (used for per-client clicks)
// The metric columns and labels come from `metrics` (discovered from the
// Sheet header row), so the modal reflects whatever score columns currently
// live in the Sheet without any code changes.
// Built on @base-ui/react's Dialog primitive — accessible focus trap, ESC to
// close, and click-outside dismiss come for free.
"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  Client,
  ComponentScore,
  HealthStatus,
  MetricDefinition,
} from "@/types/scorecard";

const HEALTH_COLOR: Record<HealthStatus, string> = {
  Healthy: "var(--status-healthy)",
  "At Risk": "var(--status-at-risk)",
  Critical: "var(--status-critical)",
};

export type ModalLayout = "table" | "card";

interface ClientDetailsModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  clients: Client[];
  metrics: MetricDefinition[];
  layout?: ModalLayout;
  // Fired when the user clicks a numeric score cell. Non-numeric cells
  // (null / "NA") stay inert.
  onScoreClick?: (client: Client, metric: MetricDefinition) => void;
}

function formatScore(s: ComponentScore): string {
  if (s === null || s === undefined) return "—";
  if (s === "NA") return "NA";
  return String(s);
}

export function ClientDetailsModal({
  open,
  onClose,
  title,
  clients,
  metrics,
  layout = "card",
  onScoreClick,
}: ClientDetailsModalProps) {
  const popupWidth = layout === "table" ? "min(95vw,1400px)" : "min(95vw,720px)";

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity" />
        <Dialog.Popup
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg bg-background shadow-xl"
          style={{ width: popupWidth }}
        >
          <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
            <Dialog.Title className="text-lg font-bold text-black">{title}</Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-auto px-6 py-4">
            {clients.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No clients to show.</p>
            ) : layout === "table" ? (
              <ClientTable clients={clients} metrics={metrics} onScoreClick={onScoreClick} />
            ) : (
              <div className="space-y-6">
                {clients.map((c) => (
                  <ClientCard
                    key={c.name}
                    client={c}
                    metrics={metrics}
                    onScoreClick={onScoreClick}
                  />
                ))}
              </div>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// A numeric score becomes a clickable button (drill into reason); "NA" / null
// render as plain text since there's nothing to explain.
function ScoreButton({
  value,
  onClick,
}: {
  value: ComponentScore | number | undefined;
  onClick?: () => void;
}) {
  const text = typeof value === "number" ? String(value) : formatScore(value ?? null);
  if (!onClick || value === null || value === undefined || value === "NA") return <>{text}</>;
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer rounded px-1 font-bold tabular-nums underline-offset-2 hover:bg-muted hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {text}
    </button>
  );
}

function ClientTable({
  clients,
  metrics,
  onScoreClick,
}: {
  clients: Client[];
  metrics: MetricDefinition[];
  onScoreClick?: (client: Client, metric: MetricDefinition) => void;
}) {
  return (
    <Table className="[&_th]:border-r [&_th]:border-border [&_th:last-child]:border-r-0 [&_th]:font-bold [&_th]:text-black [&_td]:border-r [&_td]:border-border [&_td:last-child]:border-r-0 [&_td]:font-bold [&_td]:text-black">
      <TableHeader>
        <TableRow>
          <TableHead>Client</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Stage</TableHead>
          <TableHead>ARR</TableHead>
          {metrics.map((m) => (
            <TableHead key={m.key} className="text-center">
              {m.label}
            </TableHead>
          ))}
          <TableHead>Health</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clients.map((c) => (
          <TableRow key={c.name}>
            <TableCell>{c.name}</TableCell>
            <TableCell>{c.clientType}</TableCell>
            <TableCell>{c.stage}</TableCell>
            <TableCell className="tabular-nums">{c.arrDisplay}</TableCell>
            {metrics.map((m) => (
              <TableCell key={m.key} className="text-center tabular-nums">
                <ScoreButton
                  value={c.scores[m.key]}
                  onClick={onScoreClick ? () => onScoreClick(c, m) : undefined}
                />
              </TableCell>
            ))}
            <TableCell>
              <span
                className="inline-block rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
                style={{ backgroundColor: HEALTH_COLOR[c.healthStatus] }}
              >
                {c.healthStatus}
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ClientCard({
  client,
  metrics,
  onScoreClick,
}: {
  client: Client;
  metrics: MetricDefinition[];
  onScoreClick?: (client: Client, metric: MetricDefinition) => void;
}) {
  // Plain rows (no drill-down) shown first, then the scored rows that route
  // into the reason popup when clicked.
  const plainRows: Array<[string, string]> = [
    ["Type", client.clientType],
    ["Stage", client.stage],
    ["ARR", client.arrDisplay],
  ];

  return (
    <div className="rounded-lg border border-border bg-white">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h3 className="text-base font-bold text-black">{client.name}</h3>
        <span
          className="inline-block rounded-full px-3 py-1 text-xs font-bold text-white"
          style={{ backgroundColor: HEALTH_COLOR[client.healthStatus] }}
        >
          {client.healthStatus}
        </span>
      </div>
      <dl className="divide-y divide-border">
        {plainRows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between px-5 py-2.5 text-sm">
            <dt className="font-bold text-black">{label}</dt>
            <dd className="font-bold text-black tabular-nums">{value}</dd>
          </div>
        ))}
        {metrics.map((m) => (
          <div key={m.key} className="flex items-center justify-between px-5 py-2.5 text-sm">
            <dt className="font-bold text-black">{m.label}</dt>
            <dd className="font-bold text-black tabular-nums">
              <ScoreButton
                value={client.scores[m.key]}
                onClick={onScoreClick ? () => onScoreClick(client, m) : undefined}
              />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
