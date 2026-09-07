# 🏦 ReconcileX — Bank & ERP Reconciliation Engine

A desktop application that automates matching **Bank statements** against **ERP statements**.
You upload two spreadsheets, describe how their columns relate, and the engine
resolves every row into **Matched**, **Unmatched (Bank only)**, or **Unmatched (ERP only)**
under a strict 1‑to‑1 guarantee. File contents are parsed and matched locally on your
machine; only lightweight metadata (rule templates, session summaries, preferences) is
persisted, in a local SQLite database.

---

## ✨ Features

- **Spreadsheet parsing** — drag‑and‑drop `.xls`, `.xlsx`, or `.csv` files. Parsing runs
  in the renderer via SheetJS (`xlsx`), reading the first sheet of each workbook into JSON rows.
- **Custom rule mapping** — pair any Bank column with any ERP column (`Bank.Amount` MUST EQUAL
  `ERP.Credit`). Add multiple conditions; they are combined with **AND**.
- **Text vs. Numeric comparison** — each rule is compared as `Text (Exact)` (case‑insensitive,
  trimmed) or `Numeric`. Numeric mode strips thousands separators (`1,250.00` → `1250`) before
  comparing values mathematically.
- **Signature‑based duplicate detection** — every row is hashed into a signature from its mapped
  fields. Rows with identical signatures on either side are counted and surfaced in a yellow
  warning banner on the results screen.
- **Strict 1‑to‑1 matching** — each Bank row consumes at most one ERP row with the same
  signature. Surplus duplicates cascade into the Unmatched lists.
- **Chunked processing** — matching is sliced into chunks of 200 rows with yields back to the
  event loop, so the progress bar animates and the UI stays responsive on large files.
- **Session persistence & recovery** — each run is saved to SQLite. If a session is interrupted,
  the Upload screen offers a "Resume Session" banner to continue from the last saved state.
- **Reusable rule templates** — save a set of mapping rules by name/description and reload them
  on a later run.
- **Preferences** — key/value preferences (e.g. theme) stored in the database.
- **Excel export** — download a single `Reconciliation_Report.xlsx` workbook with three sheets:
  `Matched`, `Unmatched Bank`, `Unmatched ERP`, each tagged with a `Match_Status` column.
- **Gamified UI** — Framer Motion transitions, Lucide icons, and a confetti burst when the
  combined match rate is great. Light/dark theme with an in-app toggle (seeded from the OS
  setting, persisted to preferences). The whole router tree is wrapped in an `<ErrorBoundary />`.

---

## 🛠️ Tech Stack

| Area | Choice |
|------|--------|
| UI | React 18, TypeScript 5, Vite 7 |
| Desktop shell | Electron 41 via `vite-plugin-electron`, packaged with `electron-builder` |
| Routing | `react-router-dom` v7 (`MemoryRouter` — no URL bar in Electron) |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite` plugin) |
| Animation | Framer Motion, `react-confetti`, `react-use` |
| Spreadsheets | `xlsx` (SheetJS Community, installed from the SheetJS CDN tarball) |
| Local storage | SQLite via `better-sqlite3` (main process only) |
| Tooling | ESLint (`@typescript-eslint`, `react-hooks`, `react-refresh`) |

---

## 🏗️ Architecture

The renderer does parsing, matching, and rendering. The Electron main process owns the SQLite
database and exposes it to the renderer over a typed IPC bridge (`window.db`).

```
electron/
  main.ts       Electron entry; registers all `db:*` IPC handlers
  preload.ts    contextBridge — exposes `window.ipcRenderer` and `window.db`
  db.ts         better-sqlite3 setup + CRUD for rules, sessions, preferences, history

src/
  types/index.ts          Shared models: MappingRule, TransactionRow, MatchedPair,
                          ReconciliationSession, SavedRule, HistoryEvent
  utils/reconcile.ts      Pure matching logic — getRowSignature() and evaluateMatch()
  hooks/
    useFileParser.ts      Reads File objects → TransactionRow[] via FileReader + xlsx
    useReconciliation.ts  The matching engine (see below)
    useDatabase.ts        Re-exports the DB context + helper hooks (useSavedRules,
                          usePreferences, useSessions, useSessionRecovery,
                          useAutoSaveSession, useRuleTemplates, …)
  context/DatabaseContext.tsx   React context wrapping window.db; no-ops when it is absent
  pages/
    UploadScreen.tsx          Step 1 — file drop, parse, session-recovery banner
    MappingScreen.tsx         Step 2 — rule builder, template load/save
    ReconciliationScreen.tsx  Step 3 — run, stats tabs, duplicate banner, export
  components/    FileDropzone, StepIndicator, StatsCards, MatchRateBadge,
                ResultsTable, ProcessingOverlay, Toast, ErrorBoundary
```

### How matching works (`useReconciliation.ts`)

1. **Duplicate scan** — build a signature→count map for each side; report any signature seen
   more than once as a duplicate warning.
2. **ERP index** — bucket every ERP row into a `Map<signature, TransactionRow[]>` for O(1) lookup.
3. **Match pass** — iterate Bank rows in chunks of 200. For each row, look up its signature
   bucket; if a row is available, `shift()` one ERP row and record the pair, otherwise the Bank
   row is unmatched. Empty buckets are deleted.
4. **Remainder** — any ERP rows still left in buckets are the unmatched ERP set.

Overall cost is roughly O(n + m). `getRowSignature()` builds the hash key; `evaluateMatch()`
is a direct pairwise comparator kept in `utils/reconcile.ts` for reuse and testing.

### Persistence

`better-sqlite3` opens `rec-app.db` in Electron's `userData` directory (WAL mode) and creates
four tables on first run: `rules`, `sessions`, `preferences`, `history`. All access goes
through `db:*` IPC channels; each handler returns either the result or `{ error: string }`.
When the app runs outside Electron (e.g. `vite preview` in a browser), `window.db` is undefined
and the database layer silently disables itself — parsing, matching, and export still work.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js 18+** and npm.
- A C/C++ toolchain for building the `better-sqlite3` native addon if a prebuilt binary is not
  available for your platform (Windows: "Desktop development with C++" workload; macOS: Xcode
  Command Line Tools; Linux: `build-essential` + `python3`).

### Install

```bash
npm install
```

`xlsx` is pinned to the official SheetJS CDN tarball
(`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`) rather than the npm registry —
the registry copy is frozen at `0.18.5` and carries unpatched advisories. `npm install`
therefore needs network access to `cdn.sheetjs.com`.

### Run in development

```bash
npm run dev
```

Starts the Vite dev server and launches the Electron window with hot reload for the renderer,
main, and preload processes.

### Lint & test

```bash
npm run lint
npm test          # Vitest — unit tests for the matching logic
```

### Build a distributable

```bash
npm run build
```

Runs `tsc`, builds the renderer and Electron bundles with Vite, then packages installers with
`electron-builder` into `release/<version>/` (NSIS on Windows, DMG on macOS, AppImage on Linux).

> Before shipping, update the placeholder `appId` and `productName` in
> [`electron-builder.json5`](electron-builder.json5).

---

## 📜 Example Workflow

1. **Upload** — drop `Bank_Jan.xlsx` and `ERP_Jan.xlsx`, then *Process & Extract Data*.
2. **Mapping** — add Rule 1: `Date` MUST EQUAL `Eff Date` (Text). Add Rule 2: `Debit` MUST EQUAL
   `Amount` (Numeric). Optionally *Save as Template*.
3. **Reconciliation** — the engine scans for duplicates, runs the chunked match, and shows three
   tabs (Matched / Unmatched Bank / Unmatched ERP) plus a match‑rate badge. Review the yellow
   banner if duplicates were found, then *Export Report* or *Save Session*.

---

## 📁 Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Vite dev server + Electron window |
| `npm run build` | Type-check, bundle, and package installers |
| `npm run lint` | ESLint (flat config, zero warnings allowed) |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Vitest in watch mode |
| `npm run preview` | Serve the built renderer in a browser (no Electron, no database) |

---

## ⚠️ Notes & Limitations

- Only the **first worksheet** of each workbook is read.
- Column names are taken from the header row of the first data row; keys starting with `__EMPTY`
  are ignored in the mapping UI.
- Test coverage is currently limited to the matching logic (`utils/reconcile.ts`); UI and the
  Electron/SQLite layer are untested.
- The renderer runs with Electron's default `webPreferences` (no `contextIsolation`/`sandbox`
  hardening configured); review these before distributing.
- A `docs/FEATURE-ROADMAP.md` tracks planned changes and the implementation log.
