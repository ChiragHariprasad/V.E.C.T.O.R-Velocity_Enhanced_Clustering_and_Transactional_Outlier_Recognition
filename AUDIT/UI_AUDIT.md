# V.E.C.T.O.R — UI AUDIT

> Frontend: React 18 + Vite + TailwindCSS | Port: 5174 | Backend: Express @ 3001

---

## Overview Page Screenshot Evidence

![Overview Page - Top Section](file:///C:/Users/chira/.gemini/antigravity-ide/brain/65843c33-39c8-4d3c-9983-4fe98f528639/bitcoin_overview_top_1789655610763.png)

![Overview Page - Bottom Section](file:///C:/Users/chira/.gemini/antigravity-ide/brain/65843c33-39c8-4d3c-9983-4fe98f528639/bitcoin_overview_bottom_1789655620190.png)

---

## Page-by-Page Audit

### 1. Overview (`/bitcoin`)
- **Status**: ✅ Functional
- **Data**: Mix of real DB data + hardcoded status values
- **KPIs Displayed**: Block height, BTC volume, entities, leads, risk distribution
- **Charts**: Real-time TX volume (line chart), Risk severity breakdown (donut)
- **Issues**: 
  - Pipeline telemetry shows hardcoded 18.5 tps, 12.4ms latency
  - Connection always shows "Healthy" regardless of actual Bitcoin node status
  - Mempool "42 TXs" comes from initial seed (overwritten by bulk ingest)

### 2. Live Stream (`/bitcoin/live`)
- **Status**: ✅ Functional
- **Data**: Real-time transaction feed via Socket.IO (polling fallback)
- **Features**: Transaction cards with risk level badges, BTC amounts, entity IDs
- **Live Feed**: Bottom ticker shows scrolling transactions with risk indicators

### 3. TX Explorer (`/bitcoin/explorer`)
- **Status**: ✅ Functional
- **Data**: Real transactions from DB
- **Features**: Transaction list with inputs/outputs, risk scores, entity linkage
- **Notes**: Clicking transaction opens detail view with full decoded I/O

### 4. Entity Explorer (`/bitcoin/entities`)
- **Status**: ✅ Functional
- **Data**: 981 real entities from bulk ingest pipeline
- **Features**: Entity cards with risk score, address count, propagated risk, tx count
- **Sorting**: By risk score descending
- **Notes**: Entity IDs match pipeline output (ENT_XXXXXXXXXXXX format)

### 5. Risk Queue (`/bitcoin/risk`)
- **Status**: ✅ Functional
- **Data**: 1,447 real risk alerts from pipeline
- **Features**: Sorted by risk score, shows signals, pattern, explanation
- **Priority Levels**: CRITICAL, HIGH, MEDIUM displayed with color coding

### 6. Transaction Graph (`/bitcoin/graph`)
- **Status**: ✅ Functional
- **Data**: Real graph data built from transactions in DB
- **Features**: Interactive node-edge graph visualization
- **Notes**: Shows Address → TX → Address edges with risk-colored nodes
- **Tested**: ENT_01224F550305 renders 196 nodes, 214 edges

### 7. Behavioral Clusters (`/bitcoin/clusters`)
- **Status**: ⚠️ HARDCODED
- **Data**: 3 static clusters from server — NOT computed from real data
- **Issues**: 
  - Entity counts don't match real DB (shows 34/18/12, actual total is 981)
  - Volume and velocity values are static
  - HDBSCAN/UMAP installed but not invoked

### 8. Anomaly Timeline (`/bitcoin/timeline`)
- **Status**: ✅ Functional
- **Data**: Real transactions displayed chronologically
- **Features**: Timeline visualization of transaction anomalies

### 9. Investigations (`/bitcoin/investigations`)
- **Status**: ✅ Functional
- **Data**: 697 real auto-investigations from pipeline
- **Features**: Investigation list with seed entity, status, lead count, pattern count
- **Detail View**: Full investigation lifecycle — graph, flow, leads, evidence
- **Investigation Detail Test (INV-FA5BF2A829)**: 100 nodes, 99 edges, 99 leads, 5,722 patterns

### 10. Model Performance (`/bitcoin/models`)
- **Status**: ✅ Renders
- **Data**: Model configuration and performance metrics
- **Notes**: Shows "HDBSCAN + Isolation Forest" and "XGBoost" labels

### 11. Data Sources (`/bitcoin/sources`)
- **Status**: ✅ Renders
- **Data**: Configuration information page

### 12. Settings (`/bitcoin/settings`)
- **Status**: ✅ Renders
- **Data**: System configuration UI

---

## Cross-Cutting UI Features

| Feature | Status | Notes |
|---|---|---|
| Dark/Light Theme | ✅ | Toggle in header, smooth transition |
| Search Bar (⌘K) | ✅ | Real-time search across entities, txs, investigations |
| SIH26146 Badge | ✅ | Visible in header bar |
| Domain Toggle (Bitcoin/Financial) | ✅ | Switches between Bitcoin and Financial monitoring |
| User Profile | ✅ | Shows "Analyst Vinith" with online status |
| Responsive Layout | ✅ | Sidebar navigation, max-width 1720px |
| Loading States | ✅ | Loading screen on initial load, skeleton states |
| Error States | ⚠️ | "Disconnected from server" banner when socket fails |
| Live Feed Ticker | ✅ | Bottom bar scrolls real transactions |

---

## Visual Quality Assessment

- **Design System**: Modern, polished dark theme with gradient accents
- **Typography**: Clean system fonts, proper hierarchy
- **Color Coding**: Risk levels consistently color-coded (red=CRITICAL, orange=HIGH, yellow=MEDIUM, green=LOW)
- **Animations**: Framer Motion transitions, smooth page navigation
- **Chart Quality**: Chart.js with proper legends, tooltips, responsive sizing
- **Overall**: Production-quality UI, not a prototype/wireframe
