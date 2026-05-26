// Nested dialog that explains a single score. Opens when the user clicks
// any number (component score or composite) inside the ClientDetailsModal
// table or card. The label is the Sheet's header text for that column and
// the reason comes verbatim from the matching cell in "Scorecard Details",
// joined to the client by name.
"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { Client, MetricDefinition } from "@/types/scorecard";

interface ScoreReasonPopupProps {
  open: boolean;
  onClose: () => void;
  client: Client | null;
  metric: MetricDefinition | null;
}

export function ScoreReasonPopup({ open, onClose, client, metric }: ScoreReasonPopupProps) {
  const label = metric?.label ?? "";
  const score = client && metric ? client.scores[metric.key] : null;
  const reason = client && metric ? client.reasons[metric.key] : undefined;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity" />
        <Dialog.Popup
          className="fixed left-1/2 top-1/2 z-[70] flex max-h-[85vh] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg bg-background shadow-xl"
          style={{ width: "min(95vw,640px)" }}
        >
          <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
            <Dialog.Title className="text-lg font-bold text-black">
              {client?.name ?? ""} — {label}
            </Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-auto px-6 py-5">
            <div className="mb-4 text-4xl font-bold text-black tabular-nums">
              {formatScore(score)}
            </div>
            {reason ? (
              <p className="whitespace-pre-wrap text-sm font-bold leading-relaxed text-black">
                {reason}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No explanation provided yet for this score.
              </p>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function formatScore(s: number | "NA" | null | undefined): string {
  if (s === null || s === undefined) return "—";
  if (s === "NA") return "NA";
  return String(s);
}
