# ReconcileX — Feature Roadmap & Change Plan

A feature-by-feature plan: what exists, what to change, and which new features are worth
building next. Originally written against commit `1dc9317`.

> **Progress (as of branch `feat/v0.4-scale-and-ship`, commit `985cadc`):** v0.1–v0.4 are
> implemented and committed one branch per version off `feat/update-features`:
> `feat/v0.2-use-whats-built` → `feat/v0.3-matching-reality` → `feat/v0.4-scale-and-ship`.
> Each branch passes `tsc` / `lint` / `test` / `vite build`. Remaining items (manual
> match, `Toast` queue, auto-update, focus-trap, `ErrorBoundary` persistence) are grouped
> into **v0.5** — see the Implementation log at the bottom. Rows are marked ✅ done,
> ⏳ partial.

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
| 5 | ✅ **`evaluateMatch` reused** — now honours tolerances and powers `explainMatch` / `nearestCandidate` ("why unmatched?"). | P2 | S | Done (v0.3) |
| 6 | ✅ **Artificial delays trimmed** (v0.2), then removed entirely — matching runs in a Worker (v0.3). | P2 | S | Done |
| 7 | ✅ **Web Worker** — `src/workers/reconcile.worker.ts` runs the pure `runReconciliation` engine off-thread; main-thread fallback if `Worker` fails. | P2 | M | Done (v0.3) |
| 8 | ✅ **Cancel button** — `useReconciliation.cancel()` terminates the worker; `ProcessingOverlay` shows Cancel + elapsed time. | P2 | S | Done (v0.3) |

### 1.2 Rule mapping (`src/pages/MappingScreen.tsx`)

| # | Change | Priority | Effort | Notes |
|---|--------|----------|--------|-------|
| 1 | ✅ **`alert()` replaced with `Toast`** in `handleStartReconciliation`. | P0 | S | Done (v0.1) |
| 2 | ✅ **Rule validation** — half-filled rows are highlighted amber and listed in a "Check your rules" panel; duplicate Bank/ERP column use is flagged. | P1 | S | Done (v0.2) |
| 3 | ✅ **Data preview** — first 4 rows of each side shown above the rule builder. | P1 | M | Done (v0.3) |
| 4 | ✅ **Auto-suggest** — "Suggest mappings" button; `suggestMappings` pairs headers by similarity, guesses `date`/`numeric`/`text`. | P1 | M | Done (v0.3) |
| 5 | ✅ **Template manager** — Manage modal with load / rename / duplicate / delete; `getLastUsedTemplate` auto-loads on a pristine rule list; loading a template records it as last-used. New `updateRuleAsync` wired through context. | P1 | M | Done (v0.2) |
| 6 | ✅ **Vocabulary tooltips** — `<InfoTip>` on "MUST EQUAL" and "Compare As" (Text vs Numeric). | P1 | S | Done (v0.2) |

### 1.3 Duplicate detection (`useReconciliation.ts` + `ReconciliationScreen.tsx` banner)

| # | Change | Priority | Effort | Notes |
|---|--------|----------|--------|-------|
| 1 | ✅ **Duplicate Rows tab** — 4th stat card (when any exist); `ResultsTable` renders each signature group with the kept row marked `1 ✓`. `useReconciliation` returns `duplicateGroups`. | P1 | M | Done (v0.2) |
| 2 | ✅ **Banner reworded:** "N groups of identical rows (M extra copies) … open the Duplicate Rows tab". | P1 | S | Done (v0.2) |
| 3 | ✅ **Duplicate strategy** setting: `first-wins` (default) or `all-unmatched`; honored by the engine (`poisoned` signatures) and reflected in the banner text. | P2 | M | Done (v0.2) |

### 1.4 Results & export (`ResultsTable.tsx`, `ReconciliationScreen.tsx`)

| # | Change | Priority | Effort | Notes |
|---|--------|----------|--------|-------|
| 1 | ✅ **Thresholds unified** in `src/utils/constants.ts`; confetti fires at the "great" tier and respects the `confettiEnabled` setting. | P0 | S | Done (v0.1 / v0.2) |
| 2 | ✅ **Search + sort + pagination** (50/page) on the matched and unmatched tables — no `react-window` dep; virtualization still an option if 50/page proves too small. | P1 | M | Done (v0.4) |
| 3 | ✅ **Export** — Summary sheet + timestamped name (v0.2); Electron `dialog.showSaveDialog` via `export:save` IPC, browser download fallback; Group Matches sheet (v0.4). | P1 | M | Done (v0.4) |
| 4 | ✅ **CSV** export (single flattened sheet). Per-tab export not added — the CSV/xlsx already carry `Match_Status`. | P2 | S | Done (v0.4) |
| 5 | ✅ **"Why unmatched?"** — each unmatched row expands to show the closest row on the other side, rule-by-rule (✓/✗ with both values). | P2 | M | Done (v0.3) |
| 6 | ⏳ **Empty states** — every view now renders a friendly `<EmptyState>` / "No duplicate rows detected" line (v0.3). Loading skeletons still TODO (v0.5). | P3 | S | Partial (v0.3) |

### 1.5 Sessions & recovery (`useDatabase.ts`, `UploadScreen.tsx`, `ReconciliationScreen.tsx`)

| # | Change | Priority | Effort | Notes |
|---|--------|----------|--------|-------|
| 1 | ✅ **Banner reworded** to "Continue last reconciliation" (v0.1). Session row is created `isActive:true` at run start, `false` on completion; `session_start` / `session_complete` events logged. Precise crash detection still coarse. | P0 | S | Done (v0.1 / v0.2) |
| 2 | ✅ **Resume carries forward matches** — `seedMatched` is passed through and folded into the resumed run's totals and match rate. | P1 | M | Done (v0.3) |
| 3 | ✅ **`setToast` during render → `useEffect([error])`** in `UploadScreen`. | P1 | S | Done (v0.1) |
| 4 | ✅ **Session list** — `/history` browser reads `getAllSessions`; reopen / delete / sparkline / auto-prune. | P1 | — | Done (v0.2) |

### 1.6 Preferences & theme (`useDatabase.ts` — `useThemePreference`, `useAutoSaveSettings`, `useColumnDefaults`)

| # | Change | Priority | Effort | Notes |
|---|--------|----------|--------|-------|
| 1 | ✅ **Real dark mode** — `@custom-variant dark` (class-based); `useThemePreference` applies `.dark`, seeds from OS/DOM, persists; `<ThemeToggle>` in `StepIndicator` + Settings. | P0 | S | Done (v0.1) |
| 2 | ✅ **`Toast` dark variants** added. | P0 | S | Done (v0.1) |
| 3 | ⏳ **Settings screen** surfaces theme, confetti, duplicate strategy, auto-save on/off, history cap, DB compact/clear/reset. `useColumnDefaults` and the auto-save *interval* editor still unused. | P1 | — | Partial (v0.2) |

### 1.7 Dead / disconnected code

| Item | Status |
|------|--------|
| **History logging** — `logHistory` etc. never called | ✅ `logEvent` in context; `session_start` / `session_complete` written from `ReconciliationScreen` (v0.2) |
| **DB maintenance** — `vacuum` / `optimize` no caller | ✅ Settings → "Compact database"; new `clearHistory` / `resetDatabase` IPC + Settings actions (v0.2) |
| **`src/types/database.d.ts`** stale comment in `DatabaseContext.tsx` | ✅ Comment corrected (v0.2) |
| **No tests** despite `reconcile.ts` being pure | ✅ Vitest + `reconcile.test.ts` (14 cases) (v0.1 / v0.2) |
| **`index.html`** title / favicon | ✅ `ReconcileX` + `public/reconcilex.svg` (v0.1) |
| **`electron-builder.json5`** placeholders | ⏳ real `appId` / `productName` / `buildResources` / `npmRebuild` set (v0.4); `build/icon.png` still needed |

---

## Part 2 — New features (options + recommendation)

### 2.1 Tolerance / fuzzy matching  ·  **P1 · Effort L · ✅ DONE (v0.3)**

**Shipped:** per-rule `tolerance` on `MappingRule` — numeric `amount`/`percent`, date
`days`, text `normalized`/`contains`/`alnum`; `comparisonMode` gains `date`. Two-pass
engine (`src/utils/engine.ts`): pass 1 exact bucket, pass 2 tolerant brute-force over the
leftovers (capped at `FUZZY_CAP` comparisons → `fuzzySkipped` flag otherwise). Fuzzy
pairs carry `kind: 'fuzzy'`, render with an amber ✨ badge, and are counted separately.
The Tolerance row in `MappingScreen` configures it.

**Original problem:** matching was exact-only — genuine matches that differed by rounding,
a day, or formatting landed in "Unmatched".

**Options**

| Option | What it is | Verdict |
|--------|-----------|---------|
| A. Keep exact-only | Status quo | ✗ Leaves the core value on the table |
| B. Per-rule tolerance | Each rule gets a mode: numeric `exact / ±amount / ±%`; date `exact / ±N days`; text `exact / normalized / contains / alphanumeric-only` | ✅ **Recommended.** Fits the existing rule UI, incremental to build |
| C. Scoring model | Weight every rule, accept pairs above a threshold, rank candidates | Powerful but a bigger UX + tuning problem; do as a later evolution of B |

**How it was built:** Option **B**, as a two-pass engine — pass 1 strict, pass 2 tolerant
over the leftovers, fuzzy pairs badged and counted separately. `MappingRule` kept
`comparisonMode` and gained an optional `tolerance` (rather than the `{ type, tolerance }`
reshape originally sketched). Runs in the Worker (1.1.7).

### 2.2 Manual match / unmatch  ·  **P1 · Effort M · ⏳ DEFERRED → v0.5**

Not started. It's the riskiest remaining item — a synthetic `__rowId` has to thread
through parse → signature (excluded) → export → session storage, plus cross-tab selection
state and re-derived results — and it can't be verified without running the app. The
export code already emits a distinct `MATCHED (MANUAL)` status for when it lands.

**Problem:** even with fuzzy matching there's always a residue only a human can pair.

**Options**

| Option | Verdict |
|--------|---------|
| A. Drag an unmatched Bank row onto an unmatched ERP row to force a pair; click a matched pair to split it | ✅ **Recommended** — direct, obvious, demo-friendly |
| B. Checkbox-select on both sides + "Match selected" button | Fallback if drag-and-drop proves fiddly in Electron; keep as the keyboard-accessible path |
| C. Rule-based overrides ("always match ref X to Y") | Scope creep — revisit later |

Persist overrides on the session (`manualMatches: [{bankId, erpId}]`) so they survive
resume and export. Needs stable row ids (add a synthetic `__rowId` at parse time).

### 2.3 Reconciliation history browser  ·  **P1 · Effort M · ✅ DONE (v0.2)**

**Problem:** every run is saved to SQLite but there's no way to see past runs — only the
single "resume" banner.

**Shipped:** `/history` route — session list (date, files, match %, counts), reopen in
read-only "review" mode, delete, match-rate sparkline, cap-based auto-prune (Settings).
`session_start` / `session_complete` events are logged. Per-session event *timeline* (from
`getSessionHistory`) has a data path via `getSessionHistoryAsync` but no UI yet → v0.5.

### 2.4 Settings screen  ·  **P1 · Effort M · ✅ DONE (v0.2)**

`/settings` route. Shipped: theme, "celebrate high match rates" (confetti), duplicate
strategy, auto-save on/off, history cap, Compact database, Clear history, Factory reset.
Not yet: auto-save *interval* editor, `useColumnDefaults` defaults.

### 2.5 Column auto-mapping + preview  ·  **P1 · Effort M · ✅ DONE (v0.3)**

Data preview (first 4 rows/side) + "Suggest mappings" (`src/utils/mapping.ts`:
`headerSimilarity`, `guessComparisonMode`, `suggestMappings`). Value-shape detection
(sampling actual cell values, not just headers) could still improve the mode guess.

### 2.6 One-to-many matching  ·  **P2 · Effort L · ✅ DONE (v0.4)**

Pass 3 in `engine.ts`: for each leftover row, `subsetSum` finds ≤`MAX_GROUP` rows on the
other side whose primary numeric value sums to it (non-numeric rules must still all
agree). Both directions. Skipped above `GROUP_LEFTOVER_CAP` leftovers. Rendered as a
"one-to-many" block in the Matched tab; exported as a **Group Matches** sheet.

### 2.7 Sheet & header controls  ·  **P2 · Effort S–M · ✅ DONE (v0.4)**

`useFileParser.inspectSheets()` lists sheet names; a `<select>` appears per file when a
workbook has more than one. A "Header is on row N" input feeds `sheet_to_json`'s `range`.

### 2.8 Test suite  ·  **P1 · ✅ STARTED (v0.1 → v0.4)**

Vitest (`vitest.config.ts`, standalone). **34 cases across 3 files:**
- `reconcile.test.ts` — `normalizeNumeric`, `parseDateMs`, exact / zero / sub-cent match,
  signature format & collisions, `evaluateRule` tolerances, `describeRow`.
- `mapping.test.ts` — `headerSimilarity`, `guessComparisonMode`, `suggestMappings`.
- `engine.test.ts` — exact pass, `all-unmatched` strategy, fuzzy pass (amount / date),
  one-to-many pass 3.

Still to come: hook/component tests (React Testing Library).

### 2.9 Explainability / onboarding  ·  **P1 · Effort S–M · ⏳ PARTIAL**

- ✅ Tooltips on "MUST EQUAL" / "Compare As" (`<InfoTip>`, v0.2).
- ✅ Results subtitle spells out matched / fuzzy / grouped / bank-only / ERP-only counts (v0.3–v0.4).
- ✅ Duplicate banner explains the 1-to-1 rule in plain terms (v0.2).
- ⏳ First-run welcome card; a "How matching works" panel (strict → fuzzy → groups) → v0.5.

### 2.10 Packaging & distribution  ·  **⏳ Partial (v0.4)**

Done: real `appId` (`com.reconcilex.app`) / `productName` (`ReconcileX`);
`directories.buildResources: build`; `npmRebuild: true`; `@electron/rebuild` devDep +
`npm run rebuild` script (rebuilds `better-sqlite3` for Electron's ABI — run before
`npm run dev` / packaging).
Still TODO: drop a real `build/icon.png`; `electron-updater` wiring (needs a release feed
URL, so left for when a distribution channel exists).

---

## Part 3 — UI / UX system improvements

| # | Change | Priority | Effort | Status |
|---|--------|----------|--------|--------|
| 1 | Real dark mode + toggle and dark-aware `Toast` | P0 | S | ✅ v0.1 |
| 2 | One feedback system: no `alert()`, a `Toast` **queue** so rapid errors don't overwrite | P1 | S | ✅ `alert()` gone (v0.1); ⏳ queue → v0.5 |
| 3 | `ProcessingOverlay`: % + elapsed + Cancel | P1 | S | ✅ v0.3 (live "matched X / Y" counter → v0.5) |
| 4 | Accessibility: `aria-*` tabs, keyboard `FileDropzone`, `Esc` in modals | P1 | M | ✅ tabs `aria-pressed` (v0.2); `FileDropzone` focus ring + `aria-label`, modal `Esc` (v0.4); full focus-trap → v0.5 |
| 5 | `ErrorBoundary` "Return to Start" wipes parsed data — confirm / persist | P2 | M | ⏳ v0.5 |
| 6 | ✅ Consistent number formatting (`toLocaleString`) in result tables | P3 | S | Done (v0.4) |
| 7 | ✅ Lazy-load `xlsx` + `react-confetti` — main bundle 942 kB → **458 kB** (gzip 300 → 141) | P2 | S | Done (v0.4) |

---

## Suggested release plan

### v0.1 — "Honest & polished" — ✅ DONE
Dark mode + toggle · dark `Toast` · float-safe compare · zero-value fix · `alert()`→Toast ·
confetti/badge threshold · match-rate label (both sides) · recovery-banner wording ·
`setToast`-in-render fix · `index.html` title/icon · Vitest + first `reconcile` tests.

### v0.2 — "Use what's already built" — ✅ DONE
Template manager UI · reconciliation history browser · Settings screen · duplicates tab ·
duplicate strategy · rule validation · vocabulary tooltips · export summary sheet ·
history logging + DB maintenance wired · trimmed processing delays.

### v0.3 — "Matching that matches reality" — ✅ DONE
Per-rule tolerance + two-pass engine · Web Worker + Cancel · "why unmatched?" ·
data preview + auto-suggest mappings · resume carries forward matches · `date` mode.
(Deferred: **manual match/unmatch** → v0.4.)

### v0.4 — "Scale & ship" — ✅ DONE (core)
Search + sort + pagination · one-to-many group matching · sheet/header controls ·
Electron save-dialog + CSV + Group Matches sheet · lazy-load `xlsx`/`confetti`
(458 kB main) · number formatting · `FileDropzone`/modal a11y · packaging config
(appId, productName, `npm run rebuild`, `@electron/rebuild`).

### v0.5 — "Polish & distribute" — next
Manual match/unmatch (checkbox, `__rowId`) · `Toast` queue provider · full modal
focus-trap · `ErrorBoundary` state persistence · live "matched X/Y" from the worker ·
`build/icon.png` + `electron-updater` · per-session history timeline · auto-save interval editor.

---

## Open product decisions — resolved

All five went with the recommended default; each is reversible:

1. **Fuzzy matching UX** → per-rule tolerance (`RuleTolerance` on each rule), not a global slider.
2. **Duplicate default** → `first-wins`, switchable to `all-unmatched` in Settings.
3. **History retention** → cap of 100 (editable in Settings), auto-prune oldest first.
4. **Manual matches in export** → distinct: `Match_Status` = `MATCHED (MANUAL)` / `MATCHED (FUZZY)` / `GROUP …`.
5. **Target scale** → assumed ≤ ~100k rows/file; matching runs in a Web Worker (shipped v0.3).

Still genuinely open for v0.5:
- Manual-match interaction: checkbox-select (planned) vs. drag-and-drop.
- Whether to persist manual matches to the session DB or keep them per-view.

---

## Implementation log

### v0.1 — "Honest & polished"
Branch `feat/v0.1-honest-and-polished` (folded into `feat/update-features`). Constants
module; float-safe `normalizeNumeric`; `?? ''` zero fix; `JSON.stringify` signature;
both-sided match rate; unified thresholds; real class-based dark mode + `<ThemeToggle>`;
dark `Toast`; `alert()`→`Toast`; `setToast`-in-render→effect; recovery banner reworded;
`index.html` + favicon; Vitest + `reconcile.test.ts`.
Gate: `tsc` ✓ · `lint` ✓ · `test` ✓ · `build` ✓.

### v0.2 — "Use what's already built"
Branch `feat/v0.2-use-whats-built` off `feat/update-features`.

| Area | Files |
|------|-------|
| DB surface | `electron/db.ts` (+`clearHistory`), `electron/main.ts` (+`db:clearHistory`, `db:resetDatabase`), `electron/preload.ts`, `electron/electron-env.d.ts` |
| Context | `DatabaseContext.tsx` — `updateRuleAsync`, `logEvent`, `getSessionHistoryAsync`, `vacuumAsync`, `optimizeAsync`, `clearHistoryAsync`, `factoryResetAsync`; stale comment fixed |
| Hooks | `useDatabase.ts` — `useSavedRules`/`useRuleTemplates` gain `updateTemplate` |
| Types | `DuplicateStrategy`, `DuplicateGroup`, `DuplicateSummary`, `HistoryEventType`, `HistoryRecord` |
| Engine | `useReconciliation.ts` rewritten — `duplicateGroups`, `duplicateSummary`, `duplicateStrategy` (`poisoned` signatures), trimmed delays; `reconcile.ts` +`describeRow` |
| Components | `InfoTip` (new); `StatsCards` (4th Duplicates card, `aria-pressed`); `ResultsTable` (duplicates rendering); `StepIndicator` (History/Settings nav) |
| Pages | `MappingScreen` (validation panel, tooltips, template Manage modal, auto-load last used); `ReconciliationScreen` (new dup banner, dup tab wiring, history events, read-only "review" mode, Summary sheet + timestamped export, confetti setting); `HistoryScreen` (new); `SettingsScreen` (new); `App.tsx` routes |
| Tests | `reconcile.test.ts` → 14 cases (+`describeRow`) |

Gate: `tsc` ✓ · `lint` ✓ · `test` 14/14 ✓ · `vite build` ✓.

### v0.3 — "Matching that matches reality"
Branch `feat/v0.3-matching-reality` off `feat/v0.2-use-whats-built`.

| Area | Files |
|------|-------|
| Types | `RuleTolerance`, `ComparisonMode` (+`date`), `MatchKind`, `MatchedPair.kind`, `ReconciliationResults.fuzzyCount`/`fuzzySkipped` |
| Engine | `src/utils/engine.ts` (new) — pure two-pass `runReconciliation`; `src/workers/reconcile.worker.ts` (new); `reconcile.ts` — `evaluateRule` (tolerant), `parseDateMs`, `explainMatch`, `nearestCandidate` |
| Mapping helpers | `src/utils/mapping.ts` (new) — `headerSimilarity`, `guessComparisonMode`, `suggestMappings` |
| Hook | `useReconciliation.ts` rewritten — spawns the worker, `elapsedMs`, `cancel()`, main-thread fallback |
| Components | `ProcessingOverlay` (elapsed + Cancel); `ResultsTable` split into `DuplicatesView` / `MatchedView` (fuzzy badge) / `UnmatchedView` ("Why?" explainer) |
| Pages | `MappingScreen` (data preview, Suggest button, Tolerance row, `date` option); `ReconciliationScreen` (worker wiring, cancel→back, `seedMatched` fold-in, fuzzy count / skipped note); `UploadScreen` (resume passes `seedMatched`); `HistoryScreen` (`toResults` fills new fields) |
| Tests | `mapping.test.ts` (new), `engine.test.ts` (new), `reconcile.test.ts` +tolerance/date → **32 cases across 3 files** |

Gate: `tsc` ✓ · `lint` ✓ · `test` 32/32 ✓ · `vite build` ✓ (worker emitted as its own chunk).

### v0.4 — "Scale & ship"
Branch `feat/v0.4-scale-and-ship` off `feat/v0.3-matching-reality`.

| Area | Files |
|------|-------|
| Engine | `engine.ts` pass 3 (`subsetSum`, `MAX_GROUP`, `GROUP_LEFTOVER_CAP`), `GroupMatch` type, `ReconciliationResults.groupMatched` |
| Parsing | `useFileParser.ts` — `inspectSheets()`, `ParseOptions` (`headerRow` → `range`, `bankSheet`/`erpSheet`), lazy `import('xlsx')` |
| Results UI | `ResultsTable.tsx` — `SearchBox` / `Pager` / `fmtCell`; `UnmatchedView` gets filter + click-to-sort + 50/page; `MatchedView` gets filter + pagination + `GroupMatchesBlock` |
| Export | `ReconciliationScreen.tsx` — `handleExport('xlsx'|'csv')`, `deliver()` (Electron `export:save` IPC or browser download), Summary + Group Matches sheets; `Confetti` via `React.lazy`+`Suspense` |
| Electron | `main.ts` (`export:save` w/ `dialog`+`fs`), `preload.ts` (`window.exporter`), `electron-env.d.ts` (`ExporterAPI`) |
| a11y / polish | `FileDropzone` focus ring + `aria-label`; `MappingScreen` modal `Esc`; `toLocaleString` in tables |
| Packaging | `electron-builder.json5` (real `appId`/`productName`, `buildResources`, `npmRebuild`); `package.json` `rebuild` script; `@electron/rebuild` devDep; `build/README.md` |
| Tests | `engine.test.ts` +one-to-many → **34 cases / 3 files** |

Gate: `tsc` ✓ · `lint` ✓ · `test` 34/34 ✓ · `vite build` ✓ (main 942→458 kB; `xlsx`/`confetti`/worker split out).

### Deferred to v0.5
- **Manual match / unmatch** — riskiest remaining item (`__rowId` through parse/signature/
  export/session, cross-tab selection, results re-derivation); wants a focused pass with
  runtime verification.
- `Toast` queue provider · full modal focus-trap · `ErrorBoundary` state persistence.
- `build/icon.png` + `electron-updater` (needs a release feed).
- Per-session history timeline · auto-save interval editor · `useColumnDefaults`.
