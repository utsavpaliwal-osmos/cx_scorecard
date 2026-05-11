# Osmos CX Scorecard — Next.js Dashboard

A production-grade dashboard mirroring the v2 HTML mockup (`osmos_cx_scorecard_complete_system_v2.html`), powered by Google Sheets as the source of truth.

## 1. Tech Stack

| Layer            | Choice                                  | Why                                                              |
| ---------------- | --------------------------------------- | ---------------------------------------------------------------- |
| Framework        | **Next.js 15** (App Router)             | Server components, API routes, file-based routing, SSR/ISR.      |
| Language         | **TypeScript (strict)**                 | Type-safe data contracts between Sheets ↔ UI.                    |
| Styling          | **Tailwind CSS v4**                     | Utility-first, matches HTML mockup's design tokens.              |
| UI primitives    | **shadcn/ui** (Radix + Tailwind)        | Accessible Tabs, Cards, Tables — needed for the 6-tab layout.    |
| Icons            | **lucide-react**                        | Consistent SVG icon set.                                         |
| Data fetching    | **TanStack Query** (client cache)       | Background refresh, retries, optimistic UI.                      |
| Sheets API       | **`googleapis`** (Node SDK)             | Official, supports service-account auth.                         |
| Validation       | **Zod**                                 | Runtime-validate sheet rows before they hit React.               |
| Lint / Format    | **ESLint + Prettier + Tailwind plugin** | Industry baseline.                                               |
| Testing          | **Vitest + React Testing Library**      | Fast unit tests for parsers and components.                      |
| Pkg manager      | **pnpm**                                | Fast, disk-efficient. (npm is fine if preferred.)                |

## 2. Directory Structure

```
cx_dashboard/
├── osmos_cx_scorecard_complete_system_v2.html   # design reference (kept)
├── PROJECT_PLAN.md                              # this file
├── README.md
├── .env                                         # (gitignored) real secrets
├── .gitignore
├── .eslintrc.json
├── .prettierrc
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── src/
    ├── app/
    │   ├── layout.tsx                           # root layout, providers
    │   ├── page.tsx                             # dashboard entry (tabs)
    │   ├── globals.css                          # Tailwind directives + tokens
    │   ├── providers.tsx                        # TanStack Query provider
    │   └── api/
    │       └── sheets/
    │           └── route.ts                     # GET → returns parsed sheet data
    │
    ├── components/
    │   ├── layout/
    │   │   ├── Header.tsx                       # gradient header
    │   │   ├── Footer.tsx
    │   │   └── DashboardTabs.tsx                # tab nav wrapper
    │   ├── tabs/
    │   │   ├── ScoringDefinitionsTab.tsx        # 10 component cards (A–J)
    │   │   ├── WeightagesTab.tsx                # weights matrix table
    │   │   ├── CommunicationFrequencyTab.tsx    # cadence matrix table
    │   │   ├── DataSourcesTab.tsx               # source cards
    │   │   ├── ScoringDashboardTab.tsx          # KPIs + per-segment client lists
    │   │   └── ClientSegmentationTab.tsx        # segment + lifecycle definitions
    │   ├── shared/
    │   │   ├── DefinitionCard.tsx
    │   │   ├── MetricCard.tsx                   # KPI tile (default/success/warning/danger)
    │   │   ├── ClientRow.tsx                    # name + colored score
    │   │   ├── SegmentCard.tsx
    │   │   ├── StageCard.tsx
    │   │   ├── SourceCard.tsx
    │   │   └── ScoreBadge.tsx                   # green/yellow/red threshold logic
    │   └── ui/                                  # shadcn-generated primitives
    │       ├── tabs.tsx
    │       ├── card.tsx
    │       └── table.tsx
    │
    ├── lib/
    │   ├── sheets/
    │   │   ├── client.ts                        # googleapis auth + Sheets client
    │   │   ├── parsers.ts                       # row → typed object (Zod-validated)
    │   │   └── ranges.ts                        # named A1 ranges per sheet tab
    │   ├── scoring/
    │   │   └── thresholds.ts                    # ≥75 healthy, 60–74 at-risk, <60 critical
    │   ├── api.ts                               # client-side fetch wrappers
    │   └── utils.ts                             # cn() classname helper, formatters
    │
    ├── hooks/
    │   ├── useDashboardData.ts                  # TanStack Query hook for /api/sheets
    │   └── useTab.ts                            # tab state via URL search param
    │
    ├── types/
    │   └── scorecard.ts                         # Client, Segment, Stage, Score, Weight
    │
    └── data/
        └── mock.ts                              # static mock data for UI-first phase
```

## 3. Data Model (TypeScript)

```ts
export type Segment = "Strategic" | "Named" | "Core";
export type Stage = "Validation" | "Steady" | "Growth";
export type ScoreBand = "healthy" | "at-risk" | "critical"; // ≥75 / 60–74 / <60

export interface Client {
  name: string;
  segment: Segment;
  stage: Stage;
  arr: number;                  // annual recurring revenue ($)
  compositeScore: number;       // 0–100
  components: {
    goalMet: number;            // A
    execEngagement: number;     // B
    execSentiment: number;      // C
    dmEngagement: number;       // D
    dmSentiment: number;        // E
    wbr: number;                // F
    legoBlocks: number;         // G
    dauMau: number;             // H
    sla: number;                // I
    projectDelays: number;      // J
  };
  lastUpdated: string;          // ISO timestamp
}

export interface SegmentSummary {
  segment: Segment;
  clientCount: number;
  totalARR: number;
  clients: Client[];
}

export interface DashboardData {
  totals: { total: number; healthy: number; atRisk: number; critical: number };
  segments: SegmentSummary[];
}
```

## 4. Google Sheet Layout (actual)

**Sheet ID:** `1ryLUNYSe9gjqZn8WndPDKAzhC8he2c8kkXwI1hRJCDw`
**Single tab:** `Scorecard` (41 rows × 19 cols as of 2026-05-07)

| Col | Header             | Type                                            | UI use                            |
| --- | ------------------ | ----------------------------------------------- | --------------------------------- |
| A   | Client Name        | string                                          | Row label                         |
| B   | Client Type        | `Core` \| `Named` \| `Strategic`                | Group clients by segment          |
| C   | Stage              | `Validation` \| `Steady` \| `Growth`            | Subgroup / filter                 |
| D   | ARR($)             | formatted string (`"24.00K"`, `"1.20M"`)        | Display + parsed for sort/totals  |
| E   | Goal Met (A)       | number \| `"NA"` \| empty                       | Component score                   |
| F   | Exec Engagement (B)| number \| `"NA"` \| empty                       | Component score                   |
| G   | Exec Sentiment (C) | number \| `"NA"` \| empty                       | Component score                   |
| H   | DM Engagement (D)  | number \| `"NA"` \| empty                       | Component score                   |
| I   | DM Sentiment (E)   | number \| `"NA"` \| empty                       | Component score                   |
| J   | WBR/QBR (F)        | number \| `"NA"` \| empty                       | Component score                   |
| K   | Lego Adoption (G)  | number \| `"NA"` \| empty                       | Component score                   |
| L   | DAU/MAU (H)        | empty for all rows currently                    | Component score                   |
| M   | SLA Compliance (I) | number \| `"NA"` \| empty                       | Component score                   |
| N   | Project Delays (J) | number \| `"NA"` \| empty                       | Component score                   |
| O   | Composite Score    | number — **pre-computed in sheet**              | Big number on each client row     |
| P   | Health Status      | `Healthy` \| `At Risk` \| `Critical`            | Drives green/yellow/red color     |
| Q   | Last Updated       | timestamp (currently empty)                     | Row metadata                      |
| R   | Red Flags          | free text                                       | Pill / tooltip on row             |
| S   | Email Domain       | comma-separated string                          | Drawer detail (future)            |

### Implications

- **Composite score & health are pre-computed.** No server-side weighting logic in v1 — we just read columns O and P. (Saves us §3's `scoring/thresholds.ts` and §6 Phase 3's "compute composite" step.)
- **One data tab, five static tabs.** The Weightages / Communications / Data Sources / Definitions / Segmentation tabs in the HTML mockup are **reference content** — not in the sheet. They become hardcoded React components (one .tsx per tab, content lifted directly from the HTML mockup). Only the "Scoring Dashboard" tab is sheet-driven.
- **ARR parsing.** Helper `parseArr("1.20M") → 1_200_000` for sums and sorting; display keeps the original string.
- **`"NA"` and empty cells.** Both render as `—` in the UI. Don't coerce to `0`.
- **DAU/MAU is empty everywhere** — render `—` and don't surface a misleading 0%.

## 5. Auth: Google Sheets Service Account

1. Google Cloud Console → create project → enable **Google Sheets API**.
2. Create a **service account**, download the JSON key.
3. Share the target sheet with the service account email (Viewer is enough for read-only).
4. Store these in `.env` (never commit):

   ```env
   GOOGLE_SHEETS_ID=<spreadsheet id from URL>
   GOOGLE_SERVICE_ACCOUNT_EMAIL=<...@<project>.iam.gserviceaccount.com>
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```

5. `lib/sheets/client.ts` instantiates `google.sheets({ version: 'v4', auth })` once per request.

> Service-account credentials live **server-only** — `/api/sheets` is the only path that touches them. The browser never sees the key.

## 6. Build Phases

### Phase 1 — Scaffold (≈30 min)

- `pnpm create next-app cx_dashboard --typescript --tailwind --eslint --app --src-dir`
- Init `shadcn/ui`, generate `tabs`, `card`, `table` primitives.
- Add `tailwind.config.ts` design tokens matching HTML mockup (gradient, brand `#667eea`, status colors `#10b981` / `#f59e0b` / `#ef4444`).
- Wire root layout + TanStack Query provider.

### Phase 2 — UI with mock data (≈1–2 days)

- Build all 6 tab components against `src/data/mock.ts` (a TS literal mirroring the HTML mockup's clients).
- Match visual fidelity: gradient header, tab indicator, score badges, segment color accents.
- Verify responsive behavior at 768px breakpoint.
- **Acceptance:** every screen in the HTML mockup is reproduced in React with identical layout.

### Phase 3 — Sheets integration (≈2–3 hours)

- Set up service account + share existing sheet with its email; populate `.env`.
- Implement `lib/sheets/client.ts` + `parsers.ts` (Zod-validate every row; convert ARR, handle `"NA"`/empty).
- `/api/sheets/route.ts`: read `Scorecard!A2:S` once, parse into `Client[]`, group by segment, return `DashboardData`. **No composite computation** — column O is the source of truth.
- Replace `mock.ts` import with `useDashboardData()` hook (TanStack Query, 5-min stale time).
- Add loading skeletons and an error state.
- Wire up the manual "↻ Refresh" button to invalidate the query.

### Phase 4 — Polish

- ISR (`export const revalidate = 300`) so the API route caches for 5 min.
- README with setup steps.
- Optional: deploy to Vercel (env vars in dashboard).

## 7. Decisions & Open Questions

### Decided

- **Read-only dashboard.** Sheet is the editable source of truth; UI never writes back.
- **Public access.** No login gate on the dashboard — anyone with the URL can view. (Implication: do not surface anything in the UI that shouldn't be public. Service-account credentials still stay server-only via the API route, so the sheet itself isn't directly exposed.)
- **Future: clickable drill-down drawer.** Every numeric score/metric on the dashboard will eventually open a side drawer showing the breakdown (component scores, raw inputs, history). Not building the drawer in v1, but the components must be designed for it:
  - `ScoreBadge` and `MetricCard` accept an optional `onClick` prop and render as `<button>` when provided. v1 leaves it undefined → renders as static `<span>`/`<div>`. v2 wires it up.
  - Each `Client` row carries enough context (`clientId`, full `components` object) so the drawer can render without a second fetch.
  - Reserve `src/components/shared/ScoreDrawer.tsx` in the structure (file not created yet; placeholder noted here so Phase 2 leaves the seam open).

### Decided (cont.)

- **Refresh cadence: ISR (5 min) + manual refresh button.**
  - API route uses `export const revalidate = 300` → Next.js caches the response for up to 5 min between Sheets fetches.
  - Header includes a "↻ Refresh" button that calls the API with `cache: 'no-store'` to force a fresh pull when someone has just edited the sheet.
  - No polling or websockets in v1.
- **Sheet exists.** User already has a populated Google Sheet. Need from user before Phase 3: sheet ID, actual tab names, and header rows so parsers map correctly (the model in §4 may need to adapt to match the existing schema).

### Still Open

_(none — ready to scaffold once sheet schema is shared)_

---

Once this plan looks right, the next step is Phase 1: run `create-next-app` and lay down the directory tree above.
