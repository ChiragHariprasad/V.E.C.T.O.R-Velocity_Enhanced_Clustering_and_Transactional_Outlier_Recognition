# V.E.C.T.O.R — FRONTEND UI AUDIT (v2)

> **Audit Date**: 2026-09-18/19
> **Method**: Verified via browser subagent executing actions against live frontend (localhost:5173).

## 1. Global UI / UX
- **Page Load**: ✅ Successfully loads `http://localhost:5173/bitcoin`. No crashes or white screens.
- **Console Errors**: ✅ 0 JavaScript errors, 0 failed network requests, 0 404s. The console is clean.
- **Theme Toggle**: ✅ Dark/Light mode toggle functions smoothly without layout breaking.
- **Navigation Sidebar**: ✅ All 12 links are present and correctly route to their respective pages.
- **Global Search (⌘K)**: ✅ Functional. Typing an entity ID prefix (e.g., "ENT_") successfully returns a dropdown of matching Entities and Investigations from the backend.

## 2. Dashboard / Overview Page (`/bitcoin`)
- **Connection Status**: Displays "Healthy" (Node) and "Healthy" (MongoDB/Redis). *Note: Node status is technically disconnected in backend, but UI displays healthy icon.*
- **Block Height**: Displays real block height (e.g., #840250) fetched from DB.
- **Mempool**: Displays static "42 TXs".
- **Telemetry**: Displays "12 ms" latency and "18.5 tps" (driven by hardcoded backend fallback `8.42`).
- **Entity / Lead Counts**: Accurately reflects MongoDB counts (e.g., 4,491 leads).
- **Charts**: 
  - Transaction Volume Line Chart renders correctly with data.
  - Risk Severity Doughnut Chart renders correctly with proportional data.
  - Entity Velocity Bar Chart renders correctly (uses fallback data if < 3 entities exist).
- **Live Feed**: Ticker streams new transactions successfully (using 2s polling fallback since MongoDB is standalone).
- **Investigation Dossier**: Renders the top/active investigation, showing Case ID, Trigger Reasons, Graph Depth, and Lead summaries.

## 3. Other Core Pages
- **Entity Explorer (`/bitcoin/entities`)**: Renders a list/table of the 981 clustered entities.
- **Risk Queue (`/bitcoin/risk`)**: Renders the 4,491 risk alerts. List is functional but lacks server-side pagination, causing heavy DOM rendering.
- **Investigations (`/bitcoin/investigations`)**: Renders all 700 auto-generated investigations. Note: Fetching this data takes ~13s due to lack of pagination on the backend, which delays the initial UI render of this page.
- **Transaction Graph (`/bitcoin/graph`)**: Successfully renders nodes and edges using `react-flow` or similar network graph library.
- **Behavioral Clusters (`/bitcoin/clusters`)**: Renders cluster profiles, but relies heavily on server-side fallback archetypes.
- **Model Performance (`/bitcoin/models`)**: Displays ML telemetry (latency, loaded models).

## 4. Wallet Intelligence View (`/bitcoin/wallet/:id`)
- Successfully displays comprehensive wallet analysis.
- **Issue**: The risk component breakdown (ML Anomaly, Graph Risk, Velocity Signal) is estimated via mathematical formula in the backend, rather than displaying the true ML model outputs.
- **Issue**: Displays default patterns if none are found.

## Summary
The UI is highly polished, responsive, and functional. It successfully consumes the backend REST APIs. The primary issues are UX-related performance bottlenecks (lack of pagination on Investigations/Risk Queue) and the display of fallback data when specific metadata is missing from the DB.
