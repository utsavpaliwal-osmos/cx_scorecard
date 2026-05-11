// Modal that opens when a number on the dashboard is clicked.
// Two layouts:
//   - "table"  → wide horizontal grid (used for the top 4 metric cards)
//   - "card"   → vertical "label : value" stack (used for per-client clicks)
// Excludes Last Updated, Red Flags, and Email Domains in both layouts.
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
import type { Client, ComponentScore, ComponentScores, HealthStatus } from "@/types/scorecard";

const COMPONENT_FIELDS: Array<{ key: keyof ComponentScores; label: string }> = [
  { key: "goalMet", label: "Goal Met" },
  { key: "execEngagement", label: "Exec Engagement" },
  { key: "execSentiment", label: "Exec Sentiment" },
  { key: "dmEngagement", label: "DM Engagement" },
  { key: "dmSentiment", label: "DM Sentiment" },
  { key: "wbrQbr", label: "WBR/QBR" },
  { key: "legoAdoption", label: "LEGO Adoption" },
  { key: "dauMau", label: "DAU/MAU" },
  { key: "slaCompliance", label: "SLA Compliance" },
  { key: "projectDelays", label: "Project Delays" },
];

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
  layout?: ModalLayout;
}

function formatScore(s: ComponentScore): string {
  if (s === null) return "—";
  if (s === "NA") return "NA";
  return String(s);
}

export function ClientDetailsModal({
  open,
  onClose,
  title,
  clients,
  layout = "card",
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
              <ClientTable clients={clients} />
            ) : (
              <div className="space-y-6">
                {clients.map((c) => (
                  <ClientCard key={c.name} client={c} />
                ))}
              </div>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ClientTable({ clients }: { clients: Client[] }) {
  return (
    <Table className="[&_th]:border-r [&_th]:border-border [&_th:last-child]:border-r-0 [&_th]:font-bold [&_th]:text-black [&_td]:border-r [&_td]:border-border [&_td:last-child]:border-r-0 [&_td]:font-bold [&_td]:text-black">
      <TableHeader>
        <TableRow>
          <TableHead>Client</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Stage</TableHead>
          <TableHead>ARR</TableHead>
          {COMPONENT_FIELDS.map((c) => (
            <TableHead key={c.key} className="text-center">
              {c.label}
            </TableHead>
          ))}
          <TableHead className="text-center">Composite</TableHead>
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
            {COMPONENT_FIELDS.map((col) => (
              <TableCell key={col.key} className="text-center tabular-nums">
                {formatScore(c.components[col.key])}
              </TableCell>
            ))}
            <TableCell className="text-center tabular-nums">{c.compositeScore}</TableCell>
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

function ClientCard({ client }: { client: Client }) {
  const rows: Array<[string, string | number]> = [
    ["Type", client.clientType],
    ["Stage", client.stage],
    ["ARR", client.arrDisplay],
    ...COMPONENT_FIELDS.map(
      (r): [string, string] => [r.label, formatScore(client.components[r.key])],
    ),
    ["Composite Score", client.compositeScore],
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
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between px-5 py-2.5 text-sm">
            <dt className="font-bold text-black">{label}</dt>
            <dd className="font-bold text-black tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
