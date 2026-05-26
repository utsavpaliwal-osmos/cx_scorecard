# CX Scorecard Dashboard — Specification

A self-contained spec for building a customer-health scorecard dashboard. Hand this file to an LLM and it should have everything needed to produce an equivalent application.

---

## 1. Purpose

A read-only internal dashboard that visualizes client health for a Customer Success / Account Management team. Source of truth is a Google Sheet maintained by humans; the app renders aggregated views, per-segment client lists, and on-demand "why is this number what it is?" drill-down popups.

Audience: small internal team (~tens of users). Not a public-facing product. Optimized for clarity over flexibility.

---

## 2. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16+** (App Router) | Server Components by default. Note: `middleware.ts` is renamed to **`proxy.ts`** in v16. |
| Language | TypeScript (strict) | |
| Runtime | React 19 | |
| Package manager | pnpm | |
| Styling | Tailwind CSS v4 | Uses `@theme` directive in `globals.css` for design tokens (no `tailwind.config.js`). |
| UI primitives | `@base-ui/react` | For Dialog (modal) primitives — accessible focus trap, click-outside dismiss, ESC to close. |
| Table | shadcn-style `<Table>` components | Plain HTML table with Tailwind classes. |
| Icons | `lucide-react` | |
| Data fetching | `@tanstack/react-query` | Used for client-side hydration of dashboard data. |
| Validation | `zod` | Runtime validation of enum fields parsed from the Sheet. |
| Auth | `next-auth@beta` (Auth.js v5) | Google OAuth provider + domain allowlist. |
| Data source | Google Sheets via `@googleapis/sheets` | Service-account auth for server-side reads. |

---

## 3. Architecture

```
┌────────────────────┐
│  Google Sheet      │   Two tabs: "Scorecard" (numbers) and "Scorecard Details" (prose)
└─────────┬──────────┘
          │  Sheets API (server-side, service account)
          ▼
┌────────────────────┐
│  Next.js app       │
│  ┌──────────────┐  │   Header-driven parser turns rows → typed DashboardData
│  │ Server route │  │
│  └──────┬───────┘  │
│         │ JSON     │
│  ┌──────▼───────┐  │   React Query hydrates client components
│  │ Dashboard UI │  │   Click number → modal → click number again → reason popup
│  └──────────────┘  │
└─────────┬──────────┘
          │  Gated by proxy.ts + Auth.js session cookie
          ▼
   Users on @onlinesales.ai / @osmos.ai
```

---

## 4. Data Source: Google Sheets

### 4.1 Two tabs, same column layout

| Tab name | Purpose |
|---|---|
| `Scorecard` | One row per client. Each metric column holds a **numeric score** (0–100), `"NA"`, or empty. |
| `Scorecard Details` | Mirror of Scorecard's columns, but each metric cell holds a **prose explanation** of the score for that client. Joined to Scorecard by client name. |

### 4.2 Range and header convention

- Range fetched: `A1:S` on each tab (header row included).
- **Row 1 = header**, data starts row 2.
- Columns are **looked up by header text**, not by position. Adding, reordering, or renaming score columns in the Sheet must flow through to the UI with zero code changes (this is the central design constraint).

### 4.3 Header types

Headers fall into three categories:

1. **Required metadata columns** — typed fields the app reads via alias lists. Aliases tolerate cosmetic variations (`"ARR"`, `"ARR ($)"`, `"ARR($)"`). The first alias is the canonical name shown in error messages.

   | Field | Aliases (case-insensitive) |
   |---|---|
   | `name` | `Client Name`, `Client`, `Name` |
   | `clientType` | `Client Type`, `Type`, `Segment` |
   | `stage` | `Stage` |
   | `arr` | `ARR($)`, `ARR ($)`, `ARR (USD)`, `ARR` |
   | `healthStatus` | `Health Status`, `Health` |
   | `composite` | `Composite Score`, `Composite`, `Overall Score` |

2. **Optional metadata columns** — looked up the same way but missing headers default to empty (no throw). Currently unused by the UI but kept for forward compat:
   - `lastUpdated` ← `Last Updated`, `Updated`
   - `redFlags` ← `Red Flags`, `Risks`
   - `emailDomains` ← `Email Domains`, `Domains`

3. **Ignored columns** — present in the Sheet but explicitly hidden from the dashboard. Configurable list:
   ```
   Email Domain, Geography, Vertical
   ```

4. **Everything else** — becomes a **dynamic metric column**. Display label is the literal header text; lookup key is the lowercased header. Appears in the modal table and per-client card automatically.

### 4.4 Enum values

- `Client Type` ∈ `{ "Strategic", "Named", "Core" }` (enforced by zod).
- `Stage` ∈ `{ "Validation", "Steady", "Growth" }` (enforced by zod).
- `Health Status` ∈ `{ "Healthy", "At Risk", "Critical" }` (enforced by zod).

Unexpected values throw with a clear error pointing at the offending row.

### 4.5 Score parsing

- Empty cell → `null`
- `"NA"` (any case) → `"NA"`
- Numeric → `number`
- Anything else → `null`

The composite-score column is special: must be a real number (no `NA`/`null`), used for sorting and the score badge. Throws if not parseable.

### 4.6 ARR format

- Display string in the Sheet: `"15K"`, `"2.5M"`, `"100K"`, `"50"`.
- Parsed to a numeric for aggregation (`formatArr` / `parseArr` in `src/lib/format.ts`).
- Re-formatted for segment totals: `$2.50M`, `$120.00K`.

---

## 5. Data Model

```ts
type ClientType   = "Strategic" | "Named" | "Core";
type Stage        = "Validation" | "Steady" | "Growth";
type HealthStatus = "Healthy" | "At Risk" | "Critical";
type ComponentScore = number | "NA" | null;

interface MetricDefinition {
  key: string;    // normalized header (lowercased), used as map key
  label: string;  // literal header text from the Sheet, used as display label
}

interface Client {
  name: string;
  clientType: ClientType;
  stage: Stage;
  arrDisplay: string;       // "$2.50M"
  arrNumeric: number;       // 2500000
  scores: Record<string, ComponentScore>;  // keyed by MetricDefinition.key, includes composite
  reasons: Record<string, string>;          // sparse, keyed by MetricDefinition.key
  compositeScore: number;   // derived from scores[compositeKey]
  healthStatus: HealthStatus;
  redFlags: string;
  emailDomains: string[];
  lastUpdated: string | null;
}

interface SegmentSummary {
  clientType: ClientType;
  clientCount: number;
  totalArr: number;
  arrDisplay: string;       // formatted sum
  clients: Client[];        // sorted desc by compositeScore
}

interface DashboardData {
  totals: {
    total: number;
    healthy: number;
    atRisk: number;
    critical: number;
  };
  metrics: MetricDefinition[];  // all score columns in Sheet column order, includes composite
  compositeKey: string;         // which metrics[i].key is the composite
  segments: SegmentSummary[];   // one per ClientType
  generatedAt: string;          // ISO timestamp at parse time
}
```

### Health-status bands

Derived from `compositeScore`:
- `≥ 75` → `"Healthy"`
- `60–74` → `"At Risk"`
- `< 60` → `"Critical"`

(Also explicitly stored in the Sheet's `Health Status` column; we trust the Sheet over the band calculation.)

---

## 6. UI Structure

### 6.1 Routes

| Path | Purpose | Auth |
|---|---|---|
| `/` | Dashboard | Required |
| `/login` | Sign-in page | Public |
| `/api/auth/*` | Auth.js endpoints | Public |
| `/api/scorecard` *(optional)* | JSON data API for external consumers | API key |

### 6.2 Dashboard layout (`/`)

```
┌───────────────────────────────────────────────────────────┐
│  Osmos CX Scorecard           [user email] [Sign out]     │  ← gradient header banner
└───────────────────────────────────────────────────────────┘

  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐
  │ Total   │  │ Healthy │  │ At Risk │  │Critical │       ← 4 metric cards, clickable
  │   42    │  │   28    │  │    9    │  │    5    │
  │ 66.7%   │  │ 21.4%   │  │ 11.9%   │  │         │
  └─────────┘  └─────────┘  └─────────┘  └─────────┘

  Strategic Clients (High-touch)
  ┌──────────────────────────────────────────┐
  │  N Clients | $XM Total ARR               │
  │  ─────────────────────────────────────   │
  │  Client A                  [Score 87] ●  │   ← click row → per-client modal
  │  Client B                  [Score 72] ●
  │  ...
  └──────────────────────────────────────────┘

  Named Clients (Medium-touch)
  ┌──────────────────────────────────────────┐
  │  ...                                     │
  └──────────────────────────────────────────┘

  Core Clients (Self-service)
  ┌──────────────────────────────────────────┐
  │  ...                                     │
  └──────────────────────────────────────────┘
```

### 6.3 Modal: `<ClientDetailsModal>`

Opens when a number is clicked. Two layouts:

- **`"table"` layout** — used for the 4 top metric cards.
  - Wide modal (`min(95vw, 1400px)`).
  - Columns: `Client | Type | Stage | ARR | <each metric in Sheet order> | Health`.
  - Each score cell is a clickable button (if numeric).
- **`"card"` layout** — used when clicking a single client row.
  - Narrower modal (`min(95vw, 720px)`).
  - Per-client card with vertical `label : value` rows: Type, Stage, ARR, then one row per metric.
  - Each metric value is a clickable button (if numeric).

Numeric scores are clickable; `"NA"` and `null` (`—`) render as plain text.

### 6.4 Nested popup: `<ScoreReasonPopup>`

Opens on top of the modal when any clickable number is clicked. Shows:
- Title: `<client name> — <metric label>`
- Large numeric score
- Reason text from the matching cell in the `Scorecard Details` tab, or "No explanation provided yet" if absent.

### 6.5 Login page (`/login`)

Two-pane layout:
- **Left 60%** (md+) — branded purple gradient. Large title "Osmos CX Scorecard" + tagline.
- **Right 40%** — white background, "Sign in with Google" button styled with the same gradient.

Stacks vertically on small screens.

If sign-in is rejected (non-allowlisted email), redirects back to `/login?error=AccessDenied`, which shows a red error message under the button.

---

## 7. Authentication

### 7.1 Provider

Google OAuth via Auth.js v5. No other providers.

### 7.2 Domain allowlist

In the `signIn` callback:

```ts
const ALLOWED_DOMAINS = ["onlinesales.ai", "osmos.ai"];

signIn({ profile }) {
  if (!profile?.email || profile.email_verified !== true) return false;
  const domain = profile.email.split("@")[1]?.toLowerCase();
  return !!domain && ALLOWED_DOMAINS.includes(domain);
}
```

Two checks:
1. `email_verified === true` — rejects unverified Google accounts.
2. Exact-match on the part after `@`, lowercased (not `endsWith` — would let `@evil-onlinesales.ai` through).

### 7.3 Route protection (`src/proxy.ts`)

```ts
import { auth } from "@/auth";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const path = req.nextUrl.pathname;
  const isAuthRoute = path.startsWith("/api/auth") || path === "/login";
  if (!isLoggedIn && !isAuthRoute) {
    return Response.redirect(new URL("/login", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

### 7.4 Header chrome

Header.tsx (server component) calls `await auth()` to get the session; renders the signed-in email + a Sign-out button (server action calling `signOut`) in the top-right corner of the banner.

---

## 8. Visual Design

### 8.1 Tokens — exact values

Tailwind v4 with shadcn. Defined in `src/app/globals.css` (`:root`):

```css
:root {
  /* Brand */
  --brand:            #667eea;
  --brand-foreground: #ffffff;
  --brand-from:       #667eea;   /* gradient start */
  --brand-to:         #764ba2;   /* gradient end   */

  /* Health-status colors (score badge text, metric-card top border) */
  --status-healthy:   #10b981;   /* emerald */
  --status-at-risk:   #f59e0b;   /* amber   */
  --status-critical:  #ef4444;   /* red     */

  /* Segment accent colors (top border of segment blocks) */
  --segment-strategic: #667eea;  /* same as brand */
  --segment-named:     #f59e0b;
  --segment-core:      #10b981;

  /* shadcn neutrals (OKLCH) */
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card:       oklch(1 0 0);
  --secondary:  oklch(0.97 0 0);             /* page background tint */
  --muted:      oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --border:     oklch(0.922 0 0);
  --ring:       oklch(0.708 0 0);

  --radius: 0.625rem;            /* 10px — used by rounded-lg/xl/2xl tokens */
}
```

The Tailwind v4 `@theme inline` block in `globals.css` exposes these as Tailwind utilities — e.g. `text-status-healthy`, `bg-secondary`, `border-border`.

`body` uses `bg-secondary text-foreground` so the page is light-gray; cards/modals use `bg-white` / `bg-background` for contrast against the body.

### 8.2 Header / login gradient

```css
background: linear-gradient(135deg, var(--brand-from) 0%, var(--brand-to) 100%);
```

Applied via inline `style={{ background: "..." }}` (not Tailwind) on:
- The dashboard header banner.
- The left pane of `/login`.
- The "Sign in with Google" button on `/login`.

### 8.3 Typography

- Font family: **Geist Sans** for body (via `next/font/google`'s `Geist`), **Geist Mono** for `--font-mono`. Loaded in `src/app/layout.tsx` and applied through `className={geistSans.variable}` on `<html>`.
- Numbers use `tabular-nums` for vertical alignment in tables and badges.
- Heavy use of `font-bold text-black` for emphasis (intentional — this is a data-dense dashboard, not a brochure).

### 8.4 Spacing & radii

- Default page padding: `px-8 py-8` on the main content area.
- Card padding: `p-6` (24px).
- Card radius: `rounded-lg` (≈8px).
- Header / login pane radius: `rounded-2xl` (≈18px).
- Borders: `border-border` (light gray).

---

## 8B. Component Visual Reference

Class strings extracted from the working implementation. An LLM reproducing this should match these closely.

### Header (`src/components/layout/Header.tsx`)

Top banner — async server component (reads session via `await auth()`).

```tsx
<header
  className="relative mx-4 mt-4 rounded-2xl text-white py-10 px-8 text-center"
  style={{
    background: "linear-gradient(135deg, var(--brand-from) 0%, var(--brand-to) 100%)",
  }}
>
  <h1 className="text-3xl font-bold tracking-tight">Osmos CX Scorecard</h1>

  {/* Top-right user chrome — only renders when session is present */}
  <div className="absolute right-5 top-5 flex items-center gap-4 text-sm">
    <span className="opacity-90">{session.user.email}</span>
    <form action={signOutAction}>
      <button
        type="submit"
        className="rounded-md bg-white/15 px-3.5 py-1.5 font-bold transition-colors hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        Sign out
      </button>
    </form>
  </div>
</header>
```

### MetricCard (top stat cards)

White card with a 4px-thick colored top border that varies by variant.

```tsx
<Tag
  className="rounded-lg bg-white p-6 text-center cursor-pointer transition-shadow hover:shadow-sm"
  style={{ borderTop: `4px solid ${VARIANT_ACCENT[variant]}` }}
>
  <div className="text-sm font-bold uppercase tracking-wider text-black">
    {label}                       {/* e.g. "Healthy (≥75)" */}
  </div>
  <div className="mt-2 text-5xl font-bold text-black tabular-nums">
    {value}                       {/* e.g. 28 */}
  </div>
  <div className="mt-2 text-sm font-bold text-black">
    {subtext}                     {/* e.g. "21.4%" */}
  </div>
</Tag>
```

Variant accents (top-border color):
```ts
default: "var(--brand)"            // #667eea
success: "var(--status-healthy)"   // #10b981
warning: "var(--status-at-risk)"   // #f59e0b
danger:  "var(--status-critical)"  // #ef4444
```

Grid container around the 4 cards: `grid grid-cols-2 gap-6 md:grid-cols-4`.

### ScoreBadge (composite pill next to each client name)

Just colored bold text, not a pill — the visual weight comes from color + size + boldness. Becomes a clickable button when handed an `onClick`.

```tsx
<button
  type="button"
  className={cn(
    "font-bold tabular-nums cursor-pointer hover:underline",
    HEALTH_CLASS[bandFromScore(score)],   // text-status-healthy | text-status-at-risk | text-status-critical
  )}
>
  {score}
</button>
```

### SegmentBlock (one per ClientType)

Wraps a heading + a white card with a 3px colored top border + a client list.

```tsx
<div>
  <h3 className="mb-3 text-xl font-bold text-black">
    {SEGMENT_HEADING[segment.clientType]}
    {/* "Strategic Clients (High-touch)" |
        "Named Clients (Medium-touch)"  |
        "Core Clients (Self-service)"   */}
  </h3>
  <div
    className="rounded-lg bg-white p-6"
    style={{ borderTop: `3px solid ${SEGMENT_BORDER[segment.clientType]}` }}
  >
    <h4 className="mb-4 text-base font-bold text-black">
      {clientCount} Clients | {arrDisplay} Total ARR
    </h4>
    <ul>{clients.map(client => <ClientRow ... />)}</ul>
  </div>
</div>
```

Segment colors (top-border):
```ts
Strategic: "var(--segment-strategic)"   // #667eea
Named:     "var(--segment-named)"       // #f59e0b
Core:      "var(--segment-core)"        // #10b981
```

The three SegmentBlocks live in a `<div className="space-y-6">` so they stack with consistent vertical gap.

### ClientRow (one item in a segment list)

```tsx
<li className="flex items-center justify-between py-3 text-base">
  <span className="font-bold text-black">{client.name}</span>
  <ScoreBadge
    score={client.compositeScore}
    health={client.healthStatus}
    onClick={() => onScoreClick(client)}
  />
</li>
```

### ClientDetailsModal — Dialog shell

```tsx
<Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm
  data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity" />

<Dialog.Popup
  className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] -translate-x-1/2 -translate-y-1/2
    flex-col rounded-lg bg-background shadow-xl"
  style={{ width: layout === "table" ? "min(95vw,1400px)" : "min(95vw,720px)" }}
>
  <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
    <Dialog.Title className="text-lg font-bold text-black">{title}</Dialog.Title>
    <Dialog.Close
      className="rounded-md p-1.5 text-muted-foreground transition-colors
        hover:bg-muted hover:text-foreground"
    >
      <X className="size-4" />
    </Dialog.Close>
  </div>
  <div className="flex-1 overflow-auto px-6 py-4">{/* table or cards */}</div>
</Dialog.Popup>
```

#### Modal — `"table"` layout (the wide grid)

shadcn `<Table>` with vertical column borders (`border-r border-border` on every `<th>` and `<td>` except the last):

```tsx
<Table className="
  [&_th]:border-r [&_th]:border-border [&_th:last-child]:border-r-0
  [&_th]:font-bold [&_th]:text-black
  [&_td]:border-r [&_td]:border-border [&_td:last-child]:border-r-0
  [&_td]:font-bold [&_td]:text-black
">
  <TableHeader>
    <TableRow>
      <TableHead>Client</TableHead>
      <TableHead>Type</TableHead>
      <TableHead>Stage</TableHead>
      <TableHead>ARR</TableHead>
      {metrics.map(m => <TableHead className="text-center">{m.label}</TableHead>)}
      <TableHead>Health</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {clients.map(c => (
      <TableRow>
        <TableCell>{c.name}</TableCell>
        ...
        {metrics.map(m => (
          <TableCell className="text-center tabular-nums">
            <ScoreButton value={c.scores[m.key]} onClick={...} />
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
```

Health-pill colors:
```ts
Healthy:    "var(--status-healthy)"    // #10b981
"At Risk":  "var(--status-at-risk)"    // #f59e0b
Critical:   "var(--status-critical)"   // #ef4444
```

#### Modal — `"card"` layout (per-client view)

```tsx
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
    {/* Plain rows: Type, Stage, ARR */}
    {plainRows.map(([label, value]) => (
      <div className="flex items-center justify-between px-5 py-2.5 text-sm">
        <dt className="font-bold text-black">{label}</dt>
        <dd className="font-bold text-black tabular-nums">{value}</dd>
      </div>
    ))}
    {/* Then one row per metric (composite included), value is a ScoreButton */}
    {metrics.map(m => (
      <div className="flex items-center justify-between px-5 py-2.5 text-sm">
        <dt className="font-bold text-black">{m.label}</dt>
        <dd className="font-bold text-black tabular-nums">
          <ScoreButton value={client.scores[m.key]} onClick={...} />
        </dd>
      </div>
    ))}
  </dl>
</div>
```

#### Modal — ScoreButton (clickable score cell)

A numeric value becomes a button with a subtle hover. `NA` / `null` stay inert.

```tsx
<button
  type="button"
  className="cursor-pointer rounded px-1 font-bold tabular-nums underline-offset-2
    hover:bg-muted hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
>
  {text}
</button>
```

### ScoreReasonPopup (nested dialog when a number is clicked)

Higher z-index than the parent modal (`z-[60]` backdrop, `z-[70]` popup).

```tsx
<Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm
  data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity" />

<Dialog.Popup
  className="fixed left-1/2 top-1/2 z-[70] flex max-h-[85vh] -translate-x-1/2 -translate-y-1/2
    flex-col rounded-lg bg-background shadow-xl"
  style={{ width: "min(95vw,640px)" }}
>
  <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
    <Dialog.Title className="text-lg font-bold text-black">
      {client.name} — {metric.label}
    </Dialog.Title>
    <Dialog.Close className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
      <X className="size-4" />
    </Dialog.Close>
  </div>

  <div className="flex-1 overflow-auto px-6 py-5">
    <div className="mb-4 text-4xl font-bold text-black tabular-nums">{score}</div>
    <p className="whitespace-pre-wrap text-sm font-bold leading-relaxed text-black">
      {reason || "No explanation provided yet for this score."}
    </p>
  </div>
</Dialog.Popup>
```

### Login page (`/login`)

Two-pane: left 60% gradient, right 40% white. Stacks vertically on small screens.

```tsx
<main className="flex min-h-screen flex-col md:flex-row">
  {/* Left 60% — branded gradient pane */}
  <section
    className="flex flex-col items-center justify-center px-10 py-16 text-white md:w-3/5"
    style={{ background: "linear-gradient(135deg, var(--brand-from) 0%, var(--brand-to) 100%)" }}
  >
    <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Osmos CX Scorecard</h1>
    <p className="mt-4 max-w-md text-center text-base opacity-90">
      Client health monitoring & management dashboard.
    </p>
  </section>

  {/* Right 40% — sign-in form */}
  <section className="flex flex-1 items-center justify-center bg-white px-8 py-16 md:w-2/5">
    <form action={signInAction} className="flex w-full max-w-sm flex-col items-center gap-5">
      <p className="text-center text-lg font-bold text-black">
        Use your Onlinesales or Osmos Google account.
      </p>
      <button
        type="submit"
        className="w-full rounded-md px-4 py-2.5 text-sm font-bold text-white transition-opacity
          hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ background: "linear-gradient(135deg, var(--brand-from) 0%, var(--brand-to) 100%)" }}
      >
        Sign in with Google
      </button>
      {error === "AccessDenied" && (
        <p className="text-sm text-red-600">
          Access restricted to @onlinesales.ai and @osmos.ai accounts.
        </p>
      )}
    </form>
  </section>
</main>
```

### Top-level dashboard layout (in `src/components/tabs/ScoringDashboardTab.tsx`)

```tsx
<section>
  {/* Row of 4 metric cards */}
  <div className="mb-8 grid grid-cols-2 gap-6 md:grid-cols-4">
    <MetricCard label="Total Clients"   value={totals.total}    subtext="Portfolio size" />
    <MetricCard label="Healthy (≥75)"   value={totals.healthy}  subtext={percent} variant="success" />
    <MetricCard label="At Risk (60–74)" value={totals.atRisk}   subtext={percent} variant="warning" />
    <MetricCard label="Critical (<60)"  value={totals.critical} subtext={percent} variant="danger" />
  </div>

  {/* Three segment blocks stacked */}
  <div className="space-y-6">
    {segments.map(s => <SegmentBlock segment={s} ... />)}
  </div>

  <ClientDetailsModal ... />
  <ScoreReasonPopup ... />
</section>
```

The page wrapper in `src/app/page.tsx`:

```tsx
<main className="flex w-full flex-1 flex-col bg-background">
  <Header />
  <div className="px-8 py-8">
    <ScoringDashboardTabContainer />
  </div>
</main>
```

---

## 9. Required Environment Variables

```
# Google Sheets (service account)
GOOGLE_SHEETS_ID=<sheet id from the URL>
GOOGLE_SERVICE_ACCOUNT_EMAIL=<service-account@project.iam.gserviceaccount.com>
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Auth.js
AUTH_SECRET=<openssl rand -base64 32>
AUTH_GOOGLE_ID=<OAuth client id from Google Cloud Console>
AUTH_GOOGLE_SECRET=<OAuth client secret>
```

**Google Cloud Console setup:**
1. Create / reuse a Google Cloud project.
2. **APIs & Services → Library** → enable **Google Sheets API**.
3. **IAM → Service Accounts** → create one → generate a JSON key → extract `client_email` and `private_key` for the env vars.
4. Share the target Sheet with the service-account email (Viewer permission).
5. **APIs & Services → Credentials** → Create OAuth client (Web application). Authorized redirect URI: `<origin>/api/auth/callback/google` (one per environment).
6. **OAuth consent screen** → "Internal" if only one Workspace; "External" + Testing if two Workspaces (which is our case for `onlinesales.ai` + `osmos.ai`).

---

## 10. File Structure

```
web/
├── src/
│   ├── auth.ts                       # Auth.js config: NextAuth({...}) with Google + signIn callback
│   ├── proxy.ts                      # Route gate; redirects unauth'd to /login
│   ├── app/
│   │   ├── layout.tsx                # Root layout, fonts, <Providers>
│   │   ├── page.tsx                  # / — renders <Header /> + <ScoringDashboardTabContainer />
│   │   ├── providers.tsx             # React Query provider
│   │   ├── globals.css               # Tailwind v4 + @theme tokens
│   │   ├── login/page.tsx            # Two-pane sign-in page
│   │   └── api/
│   │       └── auth/[...nextauth]/route.ts   # exports { GET, POST } from auth handlers
│   ├── components/
│   │   ├── layout/Header.tsx         # Top banner; async server component (reads session)
│   │   ├── tabs/
│   │   │   ├── ScoringDashboardTabContainer.tsx  # React Query fetch + loading/error states
│   │   │   └── ScoringDashboardTab.tsx           # Presentational dashboard
│   │   ├── shared/
│   │   │   ├── ClientDetailsModal.tsx   # The big modal, two layouts
│   │   │   ├── ScoreReasonPopup.tsx     # Nested popup for "why?"
│   │   │   ├── ClientRow.tsx            # One row in a segment block
│   │   │   ├── ScoreBadge.tsx           # Colored pill for composite score
│   │   │   └── MetricCard.tsx           # Top-row card
│   │   └── ui/table.tsx              # shadcn-style table primitives
│   ├── lib/
│   │   ├── format.ts                 # parseArr, formatArr, formatComponentScore, healthFromCompositeScore
│   │   └── sheets/
│   │       ├── client.ts             # getSheetsClient() — service-account auth
│   │       ├── ranges.ts             # A1 notation: "Scorecard!A1:S", "Scorecard Details!A1:S"
│   │       ├── load.ts               # loadDashboardData() — batchGet + buildDashboardData
│   │       └── parsers.ts            # Header-driven parsing (the core)
│   └── types/
│       └── scorecard.ts              # All TypeScript types in §5
├── .env                              # Required env vars (in §9)
├── package.json
└── tsconfig.json
```

---

## 11. Implementation Notes / Gotchas

### 11.1 Header-driven parsing is the central design choice

Don't hardcode column indices anywhere. Don't even hardcode the *set* of metrics. The Sheet's header row at parse time defines:
- Which columns are metadata (via alias lookup).
- Which columns are score metrics (everything not in metadata/ignored).
- The display labels (literal header text).
- The column order in the UI.

The only thing that needs a code update is renaming a *metadata* header to something not in the alias list, or wanting to hide a new non-score column (add to `IGNORED_HEADERS`).

### 11.2 Composite is a metric too

Composite Score appears in `metrics[]` like any other column. The parser additionally records `compositeKey` so the UI can find it for sorting and the score badge. Don't special-case the composite column in the table; just iterate `metrics` and the composite column will appear in its Sheet position.

### 11.3 Sheet → app contract

- Column order can change → UI updates automatically.
- Headers can be renamed (within aliases) → no code change.
- New metric column added → auto-appears in modal.
- Metric column deleted → auto-disappears.
- Required metadata column missing → throws with `"Scorecard: missing required column \"<canonical>\" (tried: <alias list>)"`.
- Unknown enum value in Client Type / Stage / Health Status → zod throws.

### 11.4 Reasons join

`Scorecard Details` rows are joined to `Scorecard` rows by **lowercased client name**. Each metric in `Scorecard` is matched to a column in `Details` by **header text equality**. If a metric exists in Scorecard but not in Details, the reason for that metric is simply absent (popup shows "No explanation provided yet").

### 11.5 Auth gotchas

- Auth.js v5 is still beta (`next-auth@beta`). Pin the version.
- `pnpm` is the package manager; `npm` may choke on the existing `node_modules` layout.
- Next.js 16 renamed `middleware.ts` to `proxy.ts`. Use `proxy.ts`.
- "External" OAuth consent screen in Testing mode allows any allowlisted email *up to 100 test users* — fine for two domains' worth of staff. For more, publish the app (no Google verification needed for `email/profile` scopes).
- The "iframe + OAuth" combo doesn't work — Google blocks embedding `accounts.google.com`. If you need to embed the dashboard in another site, plan for it (reverse proxy, shared parent domain, or skip auth in embed mode).

### 11.6 Performance

- `loadDashboardData` does one `batchGet` for both tabs in a single round trip.
- React Query hydrates client-side; server doesn't pre-render the data table (could, if SSR latency matters).
- Sheet is small (tens of rows). No pagination or virtual scrolling.

### 11.7 Deployment

- Vercel-friendly: standard Next.js deployment.
- After deploy, **add the production URL to Google Cloud Console** as both an authorized JS origin and an authorized redirect URI (`https://<prod>/api/auth/callback/google`). Otherwise sign-in fails with `redirect_uri_mismatch`.

---

## 12. What Out of Scope

- Editing the Sheet from the UI (read-only).
- Real-time updates (data refreshes on page load / React Query refetch).
- Per-user permissions (anyone with an allowlisted email sees everything).
- Mobile-optimized table layout (uses horizontal scroll on small viewports).
- Internationalization.

---

## 13. Sheet Template (Minimal Example)

`Scorecard` tab, row 1 (headers):
```
Client Name | Client Type | Stage      | ARR($) | Goal Met | Exec Engagement | Exec Sentiment | DM Engagement | DM Sentiment | WBR/QBR | LEGO Adoption | DAU/MAU | SLA Compliance | Project Delays | Composite Score | Health Status | Last Updated | Red Flags | Email Domains
```

`Scorecard` row 2 (example data):
```
Acme Corp | Strategic | Steady | 2.5M | 85 | 90 | 88 | 75 | 80 | 92 | NA | 65 | 95 | 70 | 82 | Healthy | 2026-05-20 |  | acme.com
```

`Scorecard Details` tab — same headers as `Scorecard`. Each metric cell holds prose:
```
Client Name | Client Type | Stage | ARR($) | Goal Met                              | Exec Engagement                  | ...
Acme Corp   | Strategic   | ...   | ...    | On track for Q2 targets; closed 4/5  | CEO joined the last QBR; ...     | ...
```

Add/rename score columns at will — the dashboard adapts automatically.
