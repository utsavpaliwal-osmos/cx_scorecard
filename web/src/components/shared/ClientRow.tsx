// One row inside a segment block: client name on the left, score badge on the right.
// onScoreClick is forwarded to <ScoreBadge> so the parent can open a modal for
// that single client when the score is clicked.

import type { Client } from "@/types/scorecard";
import { ScoreBadge } from "./ScoreBadge";

interface ClientRowProps {
  client: Client;
  onScoreClick?: (client: Client) => void;
}

export function ClientRow({ client, onScoreClick }: ClientRowProps) {
  return (
    <li className="flex items-center justify-between py-3 text-base">
      <span className="font-bold text-black">{client.name}</span>
      <ScoreBadge
        score={client.compositeScore}
        health={client.healthStatus}
        onClick={onScoreClick ? () => onScoreClick(client) : undefined}
      />
    </li>
  );
}
