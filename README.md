# 🏦 Bank & ERP Fast-Reconciliation Engine

A high-performance, gamified desktop application built to intelligently automate the matching process of Bank Statements against ERP Statements. Designed from the ground up for massive spreadsheets, the app utilizes chunking architectures, strict 1-to-1 processing guarantees, and pure client-side computing to keep financial data secure and processing speeds instantly responsive.

## ✨ Core Features

* **Drag-and-Drop Parsing:** Convert massive `.xls`, `.xlsx`, and `.csv` files into JSON payloads directly inside the browser using optimized `ArrayBuffer` streaming.
* **Intelligent Rule Mapping Engine:** Define complex matching rules dynamically. E.g., tell the system that `Amount` in the Bank file MUST EQUAL `Credit` in the ERP file.
* **Comparison Modes & Comma Sanitation:** Set mapping columns as `Numeric` vs `Text` types. The engine intelligently strips commas from formatted currency strings to ensure pure mathematical (`Num === Num`) matching.
* **Signature Duplicate Detection:** Before any math happens, the system hashes every row mathematically based on your rules. Identical data duplicates across the Bank or ERP sheets are immediately isolated and prominently flagged in a **Yellow Alert Top-Banner**, protecting strict 1-to-1 integrity.
* **Strict 1-to-1 Matching Allocation:** The core iteration engine guarantees one discrete Bank action absorbs exactly one discrete ERP action. Excess duplicates gracefully cascade into the Unmatched tabs.
* **Gamified High-Octane UI:** Wrapped in Framer Motion physics, `Lucide` icons, and Confetti cannons for 90%+ match rates.
* **Report Exporting:** Download the exact resolved arrays (Matched, Unmatched Bank, Unmatched ERP) back down into a clean merged `.xlsx` workbook.

## 🛠️ Technology Stack

* **Core:** React 18, TypeScript, Vite
* **Desktop Encapsulation:** Electron (with `electron-vite`) 
* **State & Routing:** Hooks (`useState`, `useEffect`), React Router v6 (`MemoryRouter` for Electron execution)
* **Design System:** Tailwind CSS (Dark Mode supported), UI composed visually with structured flex grids.
* **Animations:** Framer Motion, React Confetti
* **Data Processing:** `xlsx` (SheetJS Community) 

## 🏗️ Architecture & Code Strategy

To guarantee stability as feature requirements increased, the application is broken out strictly by Domain Driven principles:

* **`/src/types/index.ts` :** All payload shapes and rule metadata are bound by Typescript models (e.g. `TransactionRow`, `MatchedPair`). No loose `any`.
* **`/src/utils/reconcile.ts` :** The mathematical brain. The parsing `evaluateMatch` functions live here completely pure from the React DOM tree, allowing infinite theoretical unit testing without triggering browser engines. 
* **`/src/hooks` :** 
  * `useFileParser.ts` captures browser Native API callbacks isolating it from viewing screens.
  * `useReconciliation.ts` controls asynchronous chunk processing. It slices 10k rows into arrays of `50`, handing thread space back to the UI to update the **Loading Bar**, preventing frozen DOMs.
* **`/src/components` :** Total compositional breakdown. The Reconciliation screen invokes encapsulated visuals like `<StepIndicator />`, `<StatsCards />`, `<ProcessingOverlay />`, `<MatchRateBadge />`, and `<ResultsTable />`.
* **`<ErrorBoundary />`:** The entire application router tree is wrapped inside a robust Error boundary preventing full visual crash-outs in Electron environments.

## 🚀 Getting Started

Ensure you have Node.js installed.

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run in Desktop Electron Window:**
   ```bash
   npm run dev
   ```

3. **Build Application:**
   ```bash
   npm run build
   ```

## 📜 Example Workflow
1. Proceed to **Upload**. Drop `Bank_Jan.xlsx` and `ERP_Jan.xlsx`.
2. Proceed to **Mapping**. Add Rule 1: `Date` <-> `Eff Date` (Text). Add Rule 2: `Debit` <-> `Amount` (Numeric).
3. Proceed to **Reconciliation**. The UI visually indicates duplicates, executes the chunking loops, and displays 3 split tables. Click Export when satisfied!
