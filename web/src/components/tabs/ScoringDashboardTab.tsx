// Presentational dashboard. Receives parsed data as a prop and renders:
//   - 4 top metric cards (Total / Healthy / At Risk / Critical)
//   - 3 segment blocks (Strategic / Named / Core), each listing its clients
// Owns the modal-open state: clicking any number sets `modal`, which renders
// <ClientDetailsModal /> with the relevant filtered client list.
"use client";

import { useMemo, useState } from "react";
import { ClientDetailsModal, type ModalLayout } from "@/components/shared/ClientDetailsModal";
import { ClientRow } from "@/components/shared/ClientRow";
import { MetricCard } from "@/components/shared/MetricCard";
import { ScoreReasonPopup } from "@/components/shared/ScoreReasonPopup";
import type {
  Client,
  ClientType,
  DashboardData,
  MetricDefinition,
  SegmentSummary,
} from "@/types/scorecard";

const SEGMENT_BORDER: Record<ClientType, string> = {
  Strategic: "var(--segment-strategic)",
  Named: "var(--segment-named)",
  Core: "var(--segment-core)",
};

const SEGMENT_HEADING: Record<ClientType, string> = {
  Strategic: "Strategic Clients (High-touch)",
  Named: "Named Clients (Medium-touch)",
  Core: "Core Clients (Self-service)",
};

interface ScoringDashboardTabProps {
  data: DashboardData;
}

interface ModalState {
  title: string;
  clients: Client[];
  layout: ModalLayout;
}

interface ReasonState {
  client: Client;
  metric: MetricDefinition;
}

export function ScoringDashboardTab({ data }: ScoringDashboardTabProps) {
  const { totals, segments, metrics } = data;
  const [modal, setModal] = useState<ModalState | null>(null);
  const [reason, setReason] = useState<ReasonState | null>(null);

  // Flatten all clients across segments once — used for the top 4 cards
  // which filter by health status across the whole portfolio.
  const allClients = useMemo(() => segments.flatMap((s) => s.clients), [segments]);
  const open = (title: string, clients: Client[], layout: ModalLayout) =>
    setModal({ title, clients, layout });

  return (
    <section>
      <div className="mb-8 grid grid-cols-2 gap-6 md:grid-cols-4">
        <MetricCard
          label="Total Clients"
          value={totals.total}
          subtext="Portfolio size"
          onClick={() => open("Total Clients", allClients, "table")}
        />
        <MetricCard
          label="Healthy (≥75)"
          value={totals.healthy}
          subtext={percent(totals.healthy, totals.total)}
          variant="success"
          onClick={() =>
            open(
              "Healthy Clients (≥75)",
              allClients.filter((c) => c.healthStatus === "Healthy"),
              "table",
            )
          }
        />
        <MetricCard
          label="At Risk (60–74)"
          value={totals.atRisk}
          subtext={percent(totals.atRisk, totals.total)}
          variant="warning"
          onClick={() =>
            open(
              "At Risk Clients (60–74)",
              allClients.filter((c) => c.healthStatus === "At Risk"),
              "table",
            )
          }
        />
        <MetricCard
          label="Critical (<60)"
          value={totals.critical}
          subtext={percent(totals.critical, totals.total)}
          variant="danger"
          onClick={() =>
            open(
              "Critical Clients (<60)",
              allClients.filter((c) => c.healthStatus === "Critical"),
              "table",
            )
          }
        />
      </div>

      <div className="space-y-6">
        {segments.map((segment) => (
          <SegmentBlock
            key={segment.clientType}
            segment={segment}
            onClientClick={(client) => open(client.name, [client], "card")}
          />
        ))}
      </div>

      <ClientDetailsModal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal?.title ?? ""}
        clients={modal?.clients ?? []}
        metrics={metrics}
        layout={modal?.layout ?? "card"}
        onScoreClick={(client, metric) => setReason({ client, metric })}
      />
      <ScoreReasonPopup
        open={reason !== null}
        onClose={() => setReason(null)}
        client={reason?.client ?? null}
        metric={reason?.metric ?? null}
      />
    </section>
  );
}

function SegmentBlock({
  segment,
  onClientClick,
}: {
  segment: SegmentSummary;
  onClientClick: (client: Client) => void;
}) {
  return (
    <div>
      <h3 className="mb-3 text-xl font-bold text-black">{SEGMENT_HEADING[segment.clientType]}</h3>
      <div
        className="rounded-lg bg-white p-6"
        style={{ borderTop: `3px solid ${SEGMENT_BORDER[segment.clientType]}` }}
      >
        <h4 className="mb-4 text-base font-bold text-black">
          {segment.clientCount} Clients | {segment.arrDisplay} Total ARR
        </h4>
        <ul>
          {segment.clients.map((client) => (
            <ClientRow key={client.name} client={client} onScoreClick={onClientClick} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function percent(part: number, whole: number): string {
  if (whole === 0) return "0%";
  return `${((part / whole) * 100).toFixed(1)}%`;
}
