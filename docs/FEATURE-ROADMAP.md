# ReconcileX — Feature Roadmap & Change Plan

A feature-by-feature plan: what exists, what to change, and which new features are worth
building next. Written against the current codebase (single commit `1dc9317`, post
dependency upgrade).

> **Progress:** v0.1 ("Honest & polished") is implemented — see the Implementation log at
> the bottom. Rows below are marked ✅ when done.

## Legend

| Tag | Meaning |
|-----|---------|
| **P0** | Broken or misleading today — fix first |
| **P1** | High value, low/medium cost |
| **P2** | Valuable, larger effort or depends on P1 |
| **P3** | Nice to have / polish |
| Effort **S** | < half a day |
| Effort **M** | 1–3 days |
| Effort **L** | 1–2 weeks |

---

## Part 1 — Existing features: what to change

### 1.1 Matching engine (`src/hooks/useReconciliation.ts`, `src/utils/reconcile.ts`)

| # | Change | Priority | Effort | Notes |
|---|--------|----------|--------|-------|
| 1 | ✅ **Float-safe numeric compare.** New `normalizeNumeric()` strips separators and rounds to the cent; `evaluateMatch` compares with `NUMERIC_EPSILON`. | P0 | S | Done |
| 2 | ✅ **`getRowSignature` `\|\| ''` → `?? ''`** — a real `0` is preserved. Regression test added. | P0 | S | Done |
| 3 | ✅ **Signature now `JSON.stringify(parts)`** — no cross-field collisions. | P1 | S | Done |
| 4 | ✅ **Match rate is both-sided.** `progress` is now the combined rate; `bankMatchRate` / `erpMatchRate` added to results and shown as "Bank x% · ERP y%" on the badge. | P1 | S | Done |
| 5 | **`evaluateMatch` is dead code.** Either delete it or (better) reuse it for the "why didn't this row match?" explainer (see 2.4 / 3.9). | P2 | S | |
| 6 | **Artificial delays** (`setTimeout` 300 / 5 / 500 ms). Keep a *minimum* visible spinner time (~600 ms) but drop the rest; on a 500-row file the run should feel instant. | P2 | S | |
| 7 | **Move matching into a Web Worker.** Main-thread chunking still blocks paint on 100k rows. A worker makes "massive spreadsheets" real and lets the progress bar be honest. | P2 | M | Enables 1.6, 3.7 |
| 8 | **Cancel button.** The engine already has an `isMounted` flag — expose a user abort from `ProcessingOverlay`. | P2 | S | |

### 1.2 Rule mapping (`src/pages/MappingScreen.tsx`)

| # | Change | Priority | Effort | Notes |
|---|--------|----------|--------|-------|
| 1 | ✅ **`alert()` replaced with `Toast`** in `handleStartReconciliation`. | P0 | S | Done |
| 2 | **Validate rules:** warn on a rule with only one side filled, the same column mapped twice, or zero valid rules (currently only the last is blocked). | P1 | S | |
| 3 | **Data preview.** Show 3–5 sample rows per side above the rule builder so users map against real values, not just header names. | P1 | M | Big comprehension win |
| 4 | **Auto-suggest mappings** by fuzzy header match (`"Txn Date"`↔`"Date"`, `"Amt"`↔`"Amount"`). Pre-fill rules, let the user correct. | P1 | M | Pairs with 1.2.3 |
| 5 | **Template manager.** `deleteRuleAsync` / `duplicateRuleAsync` already exist in `DatabaseContext` with no UI. Add rename / edit / delete / duplicate, and auto-select "last used" (`getLastUsedTemplate` also already built). | P1 | M | Exposes dead plumbing |
| 6 | **Explain the vocabulary.** Info tooltips on "MUST EQUAL", "Compare As", "Text (Exact)", "Numeric", "AND". One sentence each. | P1 | S | |

### 1.3 Duplicate detection (`useReconciliation.ts` + `ReconciliationScreen.tsx` banner)

| # | Change | Priority | Effort | Notes |
|---|--------|----------|--------|-------|
| 1 | **Show *which* rows are duplicates**, not just a count. Add a "Duplicates" tab grouping rows by signature. | P1 | M | Currently users can't act on the warning |
| 2 | **Clearer wording:** "3 groups of identical rows (7 extra copies). Only the first in each group can match 1-to-1; the rest move to Unmatched." | P1 | S | |
| 3 | **Let the user pick** how duplicates resolve: first-wins (current), or push *all* copies to Unmatched for manual review. | P2 | M | |

### 1.4 Results & export (`ResultsTable.tsx`, `ReconciliationScreen.tsx`)

| # | Change | Priority | Effort | Notes |
|---|--------|----------|--------|-------|
| 1 | ✅ **Thresholds unified** in `src/utils/constants.ts` (`MATCH_RATE`, `CONFETTI_THRESHOLD`); confetti now fires at the "great" tier. | P0 | S | Done |
| 2 | **Results table caps at 100 rows** with no way to see the rest in-app. Add search + column sort + virtualized scroll (`react-window`) or pagination. | P1 | M | |
| 3 | **Export:** use Electron `dialog.showSaveDialog` (currently `XLSX.writeFile` dumps to CWD); timestamp the default filename; add a **Summary sheet** (counts, match rate, rules used, file names, run date). | P1 | M | |
| 4 | **Per-tab export** and a **CSV** option. | P2 | S | |
| 5 | **"Why unmatched?"** per row — run `evaluateMatch` against the nearest candidate and show which rule failed. | P2 | M | Needs candidate lookup |
| 6 | **Empty states** per tab instead of bare grey text; loading skeletons. | P3 | S | |

### 1.5 Sessions & recovery (`useDatabase.ts`, `UploadScreen.tsx`, `ReconciliationScreen.tsx`)

| # | Change | Priority | Effort | Notes |
|---|--------|----------|--------|-------|
| 1 | **"Interrupted" is not real.** Every completed run flips `isActive:false`, so `activeSessions` is only ever non-empty during the ~1 s processing window. Either mark active *before* processing and clear only on real completion, or rename the banner to **"Continue last reconciliation"** and be honest. | P0 | S | Banner currently misleads |
| 2 | **Resume loses earlier `matchedPairs`.** `handleResumeSession` feeds only `unmatchedBank/ERP` back as new input. Carry forward prior matches. | P1 | M | |
| 3 | **`setToast` during render** in `UploadScreen` (`if (error && !toast.show) setToast(...)`). Move to an effect. | P1 | S | React anti-pattern; will trip the stricter react-hooks rules |
| 4 | **No session list.** `getAllSessions` / `allSessions` is loaded but unused. See new feature 2.3. | P1 | — | |

### 1.6 Preferences & theme (`useDatabase.ts` — `useThemePreference`, `useAutoSaveSettings`, `useColumnDefaults`)

| # | Change | Priority | Effort | Notes |
|---|--------|----------|--------|-------|
| 1 | **Dark mode is not real.** `dark:` classes are everywhere, but nothing ever sets `class="dark"` on `<html>` — the app only follows the OS setting and `useThemePreference` is never rendered. Add a top-level effect: `document.documentElement.classList.toggle('dark', theme === 'dark')`, wire Tailwind v4's `dark` variant to `class`, put a toggle in `StepIndicator`. | P0 | S | |
| 2 | **`Toast` has no `dark:` variants** (`bg-green-50`, `text-slate-800`) — looks broken in dark mode. | P0 | S | |
| 3 | **`useAutoSaveSettings`, `useColumnDefaults`, `useAutoSaveSession`** are fully built and wired to nothing. Surface them in a Settings screen (feature 2.4). | P1 | — | |

### 1.7 Dead / disconnected code

| Item | Where | Recommendation |
|------|-------|----------------|
| **History logging** — `logHistory` / `getSessionHistory` / `getAllHistory` wired through `db.ts` + `main.ts` + `preload.ts`, never called from the renderer | `electron/db.ts`, IPC | Wire it (feature 2.3) or delete the surface to reduce confusion |
| **DB maintenance** — `vacuum` / `optimize` IPC exists, no caller | `electron/db.ts` | Expose in Settings ("Compact database") or drop |
| **`src/types/database.d.ts`** referenced in a comment in `DatabaseContext.tsx` | — | File doesn't exist; the type now lives in `electron/electron-env.d.ts`. Fix the comment |
| **No tests** despite `reconcile.ts` being pure | — | Add Vitest + a `reconcile.test.ts` (feature 2.8) |
| **`index.html`** title still `"Vite + React + TS"`, favicon `vite.svg` | `index.html` | Rename to ReconcileX, add a real icon |
| **`electron-builder.json5`** placeholders `YourAppID` / `YourAppName` | build config | Fill before any packaged build |

---

## Part 2 — New features (options + recommendation)

### 2.1 Tolerance / fuzzy matching  ·  **P1 · Effort L · highest product value**

**Problem:** matching is exact-only. Real bank vs ERP data differs by rounding, dates
off by a day, sign conventions, and reference numbers buried in memo text — so genuine
matches land in "Unmatched" and users reconcile them by hand anyway.

**Options**

| Option | What it is | Verdict |
|--------|-----------|---------|
| A. Keep exact-only | Status quo | ✗ Leaves the core value on the table |
| B. Per-rule tolerance | Each rule gets a mode: numeric `exact / ±amount / ±%`; date `exact / ±N days`; text `exact / normalized / contains / alphanumeric-only` | ✅ **Recommended.** Fits the existing rule UI, incremental to build |
| C. Scoring model | Weight every rule, accept pairs above a threshold, rank candidates | Powerful but a bigger UX + tuning problem; do as a later evolution of B |

**Recommended build:** Option **B**, delivered as a **two-pass engine** — pass 1 strict
(unchanged), pass 2 runs tolerance rules over the leftovers and labels those pairs
"fuzzy — needs review" (distinct colour in `ResultsTable`, counted separately). Extend
`comparisonMode` on `MappingRule` into `{ type, tolerance }`. Depends on 1.1.7 (worker)
for large files.

### 2.2 Manual match / unmatch  ·  **P1 · Effort M**

**Problem:** even with fuzzy matching there's always a residue only a human can pair.

**Options**

| Option | Verdict |
|--------|---------|
| A. Drag an unmatched Bank row onto an unmatched ERP row to force a pair; click a matched pair to split it | ✅ **Recommended** — direct, obvious, demo-friendly |
| B. Checkbox-select on both sides + "Match selected" button | Fallback if drag-and-drop proves fiddly in Electron; keep as the keyboard-accessible path |
| C. Rule-based overrides ("always match ref X to Y") | Scope creep — revisit later |

Persist overrides on the session (`manualMatches: [{bankId, erpId}]`) so they survive
resume and export. Needs stable row ids (add a synthetic `__rowId` at parse time).

### 2.3 Reconciliation history browser  ·  **P1 · Effort M**

**Problem:** every run is saved to SQLite but there's no way to see past runs — only the
single "resume" banner.

**Build:** a `/history` route listing sessions from `getAllSessions` (date, files, match
rate, row counts). Row actions: **reopen** (load saved results into `ReconciliationScreen`
read-only), **delete**, **export**. Add a small match-rate trend chart across runs. This
is where the dead `history` table earns its place — log `session_start` /
`session_complete` / `rule_save` events and show them as a per-session timeline.

### 2.4 Settings screen  ·  **P1 · Effort M · unlocks already-built code**

One `/settings` route that finally renders the hooks that already exist:

- Theme (light / dark / system) — `useThemePreference`
- Auto-save on/off + interval — `useAutoSaveSettings`
- Default columns — `useColumnDefaults`
- Duplicate-resolution strategy (1.3.3)
- Confetti / animations toggle (accessibility)
- "Compact database" → `vacuum` + `optimize`
- Reset: clear templates / clear history / factory reset (`resetDatabase` exists)

### 2.5 Column auto-mapping + preview  ·  **P1 · Effort M**

Covered in 1.2.3 + 1.2.4. Grouped here because together they're a single "smart mapping"
feature: show sample data, auto-propose rules by header similarity + value-shape
detection (looks numeric / looks like a date), user confirms. Biggest reduction in
time-to-first-result for a new user.

### 2.6 One-to-many matching  ·  **P2 · Effort L**

**Problem:** a batched deposit in the bank statement = N invoice lines in ERP (and vice
versa). Strict 1-to-1 can never match these.

**Options**

| Option | Verdict |
|--------|---------|
| A. Skip it | Acceptable for v1, but it's a common reconciliation case |
| B. Sum-subset search: for an unmatched bank row, find a small combination of unmatched ERP rows whose mapped numeric field sums to it (cap at 3–4 to bound cost) | ✅ **Recommended**, as an optional third pass after 2.1. Flag as "group match" |
| C. User manually builds groups | Ship as part of 2.2's UI; B auto-proposes, C confirms |

### 2.7 Sheet & header controls  ·  **P2 · Effort S–M**

Only the first worksheet is read and the header is assumed to be row 1. Add: a sheet
picker when a workbook has multiple sheets, and a "header is on row N / skip N top rows"
control. Cheap, removes a class of "no columns detected" support questions.

### 2.8 Test suite  ·  **P1 · Effort S to start**

Add **Vitest**. Start with `src/utils/reconcile.test.ts` covering: exact match, numeric
comma stripping, the zero-value bug (1.1.2), duplicate cascade, ERP-heavy match-rate
(1.1.4). Grows naturally as the engine gains tolerance modes.

### 2.9 Explainability / onboarding  ·  **P1 · Effort S–M**

- First-run welcome card: the 3 steps in one sentence each.
- Results legend: "Unmatched in Bank = in your bank file, no equivalent found in ERP."
- Tooltips from 1.2.6.
- A "How matching works" help panel (strict → fuzzy → groups).

### 2.10 Packaging & distribution  ·  **P2 · Effort M**

Real `appId` / `productName`; `@electron/rebuild` + a `postinstall` so `better-sqlite3`
matches Electron's ABI (currently it's built for Node and will fail at runtime under a
packaged app / `npm run dev`); `electron-updater` for auto-update; app icon set.

---

## Part 3 — UI / UX system improvements

| # | Change | Priority | Effort |
|---|--------|----------|--------|
| 1 | Real dark mode + toggle (1.6.1) and dark-aware `Toast` (1.6.2) | P0 | S |
| 2 | One feedback system: no `alert()`, a `Toast` **queue** so rapid errors don't overwrite | P1 | S |
| 3 | `ProcessingOverlay`: show "matched 8,240 / 12,000 rows" + elapsed time + Cancel, not just a % | P1 | S |
| 4 | Accessibility: `aria-selected` on the stat-card tabs, `role="button"` + keyboard on `FileDropzone`, focus trap + `Esc` in modals | P1 | M |
| 5 | `ErrorBoundary` "Return to Start" calls `window.location.reload()` and wipes all parsed data — at least confirm, ideally persist parsed data so a crash isn't a full restart | P2 | M |
| 6 | Consistent number formatting (thousands separators) in tables and stat cards | P3 | S |
| 7 | Bundle is 835 kB — lazy-load `xlsx` (only needed on parse + export) and `react-confetti` | P2 | S |

---

## Suggested release plan

### v0.1 — "Honest & polished" (P0 + cheap P1)
Dark mode + toggle · dark `Toast` · float-safe compare · zero-value fix · `alert()`→Toast ·
confetti/badge threshold · match-rate label (both sides) · recovery-banner wording ·
`setToast`-in-render fix · `index.html` title/icon · Vitest + first `reconcile` tests.

### v0.2 — "Use what's already built"
Template manager UI · reconciliation history browser · Settings screen · duplicates tab.

### v0.3 — "Matching that matches reality"
Per-rule tolerance + two-pass engine · Web Worker · manual match/unmatch · "why unmatched?".

### v0.4 — "Scale & ship"
Virtualized results + search/sort · export save-dialog + summary sheet + CSV ·
one-to-many group matching · sheet/header controls · packaging (rebuild, updater, icon).

---

## Open product decisions (need your call)

1. **Fuzzy matching UX** — per-rule tolerance controls (recommended) vs. a single global
   "strictness" slider. Per-rule is more powerful but more UI.
2. **Duplicate default** — keep first-wins, or default to "push all copies to Unmatched
   for review"? Safer vs. higher headline match rate.
3. **History retention** — keep every session forever, cap at N, or auto-prune after X
   days? Affects the `sessions` / `history` tables and the Settings UI.
4. **Manual matches in export** — mark them visually distinct from engine matches in the
   workbook, or merge them into "Matched"?
5. **Target scale** — realistic max row count per file? Decides whether the Web Worker
   (2.1 dependency) is v0.3 or can wait.
