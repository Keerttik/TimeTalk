# TimeTalk: Conversational Timesheet Copilot

TimeTalk is an enterprise conversational timesheet copilot built for **Northwind Consulting (demo data)**. It combines natural language activity extraction with strict project catalogue grounding, deterministic and statistical anomaly guardrails, inline AI explainability, and real-time single-source-of-truth ROI telemetry.

---

## Architecture & Hybrid AI Pipeline

TimeTalk separates **probabilistic language understanding** from **deterministic enterprise rules**:

1. **Multi-Provider Extraction (`backend/app/engine/extractor.py`):**
   - **Primary:** Groq (`openai/gpt-oss-20b`, configurable via `GROQ_MODEL`) using JSON mode (`response_format: json_object`) with strict schema validation and automatic single-retry correction.
   - **Failover 1:** Google Gemini (`gemini-2.5-flash`) with JSON mode, schema retry, and `usageMetadata` token extraction.
   - **Failover 2:** Deterministic local NLP fallback (`rule_based_fallback_parser`) supporting compound clauses, relative dates (`yesterday`, `today`, weekdays), and Mon–Fri week spans.
2. **Catalogue Grounding (`backend/app/engine/matcher.py`):**
   - Grounds extracted hints strictly against `backend/app/data/mock_catalogue.json` (project codes cannot be invented).
   - Halts and renders interactive clarification chips when confidence is `< 80%` or ambiguous (e.g., *"2 hours on Acme development"* → `ACME-WEB` vs. `ACME-MOB`).
3. **6 Hybrid Anomaly Guardrails (`backend/app/engine/anomalies.py`):**
   - `CLOSED_PROJECT`: Blocks billing on closed projects (`INITECH-AUD`, closed Oct 31).
   - `BILLABLE_INTERNAL`: Flags billable time logged to internal projects (`INT-OPS`).
   - `UNUSUAL_HOURS`: Statistical Z-score outlier detection against an 8-week baseline (`mean = 8.2h`, `σ = 1.1h`, threshold `> 10.4h`).
   - `WEEKEND_HOLIDAY`: Flags weekend and company holiday entries (`historical_baseline.json`).
   - `BUDGET_BURN`: Warns when new hours push project utilization above `90%`.
   - `DUPLICATE`: Flags duplicate `(date, project_code, task)` entries (including drafts matching already-confirmed entries, with `"Already logged Xh here"` and 1-click `"Remove duplicate"`).
4. **Zero Auto-Commit Invariant:** No entry is committed to `timesheets.json` without explicit user confirmation (`Confirm` or `Confirm all (N)`). `Confirm all` commits only clean `Draft` rows; `Needs review` rows require individual resolution first.

---

## Key UI & Product Features

- **Single-Screen Executive Layout (`1440×900`):** Zero outer page scroll or horizontal table scroll, `#F7F8FA` / `#FFFFFF` surfaces, single `#2563EB` blue accent, `8px` radius, subtle borders, and `Inter` typography.
  - **Header:** Logo, `Northwind Consulting (demo data)`, `Nothing submits without your approval` badge, `Team view` button, and Priya's avatar menu (`PS · Priya · ₹1,500/hr` with live rate selector).
  - **Left Column (`35%`):** Conversational copilot with wrapping `"Try:"` suggestion chips (`Log yesterday`, `Ambiguous project`, `Closed project`, `Flat 8h week`).
  - **Right Top:** 4 KPI cards (`Time saved`, `Disputed billing prevented`, `AI cost`, `Fully loaded ROI`) under `Cost vs value, live`, plus an expandable **Assumptions** drawer.
  - **Right Bottom:** Weekly timesheet grid with inline project/task/hours/billing editors (`project` selector displays code only, with project name in muted text underneath).
- **Three Row States:**
  - **Draft** (grey): Validated draft ready to confirm.
  - **Needs review** (amber): Full-width sub-row beneath the entry showing warning icon, single-line reason, and 1-click remediation (`Move to internal`, `Switch non-billable`, `Set to 8h`, `Remove duplicate`).
  - **Confirmed** (green): Committed to the weekly timesheet store.
- **Inline `"Why?"` Inspection:** Always visible on every row; expands directly beneath the row to show match explanation, raw input snippet, confidence `%`, tokens, and latency (`ms`).
- **Single-Source-of-Truth Telemetry & Monthly ROI Projection (`frontend/src/store/metricsStore.jsx`):**
  - Main KPI cards and **Team view** read from one shared React store (`MetricsProvider`).
  - **Real per-token pricing (`₹`):** Computes token cost from model-specific input/output rates (`₹0.04` scale, formatted to 2 decimals).
  - **Disputed billing prevented:** Starts at `₹0` and increments only after the user resolves or discards a flagged anomaly.
  - **20-Day Monthly ROI Alignment:** Shows **Fully loaded ROI** (`(session value * 20) / (token cost * 20 + fully loaded monthly cost)`) as the headline KPI once `3+` entries are confirmed, and displays **Token ROI** inside **Assumptions** with the note `"Token cost is negligible; fully loaded cost is the real test."` (`Fully loaded cost` defaults to `₹40`/user/month and is editable).
- **Team View (`AdminMacroModal.jsx`):**
  - Displays identical session KPIs, **Value breakdown** (projected over 20 working days, with `Client billable value logged` tagged `Context, not counted in ROI`), CSV export, and a 7-consultant team table (`Priya Sharma` live + 6 seeded peers) tracking **Confirmed hours**, **Utilization**, **Edit rate**, **Same-day logging %**, and **Flat 8h pattern** flagging (identical daily hours, `>90%` on one project, `5+` days late).

---

## Mock Catalogue (`backend/app/data/mock_catalogue.json`)

| Code | Project | Client | Tasks | Billing | Status / Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `ACME-WEB` | Acme Website Redesign | Acme Corp | Design, Development, QA | Billable (`₹4,000/hr`) | Active (`88%` budget used) |
| `ACME-MOB` | Acme Mobile App | Acme Corp | Design, Development | Billable (`₹4,000/hr`) | Active (`40%` budget used) |
| `GLOBEX-DATA` | Globex Data Migration | Globex Corp | Analysis, Migration | Billable (`₹3,500/hr`) | Active (`65%` budget used) |
| `INITECH-AUD` | Initech Audit Support | Initech Inc | Fieldwork | Billable (`₹3,000/hr`) | **Closed** (`2026-10-31`, `100%` used) |
| `INT-OPS` | Internal Operations | Northwind Internal | Standup, Training, Admin | Non-billable (`₹0/hr`) | Active |

---

## Tech Stack

- **Frontend:** React 19, Vite 8, Tailwind CSS v4, Lucide Icons (`lucide-react`)
- **Backend:** FastAPI, Uvicorn, Pydantic v2, `python-dotenv`, `requests`
- **Inference:** Groq (`openai/gpt-oss-20b`), Google Gemini (`gemini-2.5-flash`), local deterministic fallback
- **Deployment:** Multi-stage Docker (`node:20-alpine` + `python:3.11-slim`), Railway (`railway.json`, `Procfile`)

---

## Quick Start (Local Development)

### Prerequisites
- Python 3.10+ (`py` on Windows)
- Node.js 18+ and npm

### 1. Configure Environment Variables (`backend/.env`)
Create `backend/.env` (excluded from Git via `.gitignore`):

```env
PORT=8000
ENVIRONMENT=development
GROQ_API_KEY=your_groq_api_key
GEMINI_API_KEY=your_gemini_api_key
# Optional: override default Groq model (defaults to openai/gpt-oss-20b)
# GROQ_MODEL=openai/gpt-oss-20b
```

### 2. Run Both Services

On Windows (one-click):
```powershell
.\start_dev.bat
```

Or in two terminals:

**Terminal 1: Backend (FastAPI on port `8000`):**
```powershell
cd backend
py -m pip install -r requirements.txt
py run.py
```

**Terminal 2: Frontend (Vite on port `5173`, proxies `/api` to `localhost:8000`):**
```powershell
cd frontend
npm install
npm run dev
```

- **App UI:** [http://localhost:5173](http://localhost:5173)
- **Health Check:** [http://localhost:8000/health](http://localhost:8000/health)
- **API Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)

---

## API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Service health & timestamp check |
| `GET` | `/api/catalogue` | Returns `mock_catalogue.json` |
| `GET` | `/api/baseline` | Returns 8-week baseline & mock holidays |
| `GET` | `/api/timesheets` | Returns active confirmed entries (`timesheets.json`) |
| `POST` | `/api/chat/parse` | Extracts structured drafts, runs matcher & 6 anomaly rules, returns telemetry |
| `POST` | `/api/chat/resolve` | Resolves an ambiguous project clarification into a staged draft |
| `POST` | `/api/timesheets/confirm` | Commits reviewed entries to `timesheets.json` |
| `POST` | `/api/timesheets/reset` | Clears confirmed entries in `timesheets.json` |
| `GET` | `/api/admin/metrics` | Returns aggregated backend timesheet metrics |

---

## Demo Walkthrough

On initial load, TimeTalk seeds two draft rows so key guardrails and ROI mechanics are immediately visible:
- **Row 1 (`Needs review`, amber):** `4h` on `INITECH-AUD` (`Fieldwork`) flagged as closed on Oct 31; resolving it via **Move to internal** credits `₹12,000` into **Disputed billing prevented**.
- **Row 2 (`Draft`, grey):** `3h` on `ACME-WEB` (`Design`).

From there, use the `"Try:"` chips or type freely:
1. **`Log yesterday`:** Parses a compound sentence into `ACME-WEB (Design)` and `INT-OPS (Standup)` on yesterday's date.
2. **`Ambiguous project`:** Prompts *"Did you work on Acme Website (ACME-WEB) or Acme Mobile (ACME-MOB)?"* with clickable chips instead of guessing.
3. **`Closed project`:** Demonstrates `INITECH-AUD` policy blocking and 1-click **Move to internal**.
4. **`Flat 8h week`:** Stages 5 Mon-Fri `8h` rows for `GLOBEX-DATA`; confirming `3+` clean entries unlocks **Fully loaded ROI** (20-day projection) and **Token ROI** inside Assumptions.
5. **Inline `Why?` & `Team view`:** Expand any row's match rationale/tokens/latency inline, then open **Team view** to compare live session KPIs and inspect the 2 flagged `Flat 8h pattern` consultants.

---

## Verification & Automated Tests

**Backend acceptance suites:**
```powershell
cd backend
py test_phase1.py
py test_phase2.py
py test_phase3.py
```

**Frontend production build:**
```powershell
cd frontend
npm run build
```

---

## Project Structure

```text
TimeTalk/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI routes & static frontend serving
│   │   ├── models/schemas.py        # Pydantic request/response contracts
│   │   ├── engine/
│   │   │   ├── extractor.py         # Groq -> Gemini -> local parser + schema retry
│   │   │   ├── matcher.py           # Catalogue grounding & ambiguity detection
│   │   │   └── anomalies.py         # 6 deterministic & statistical anomaly rules
│   │   └── data/
│   │       ├── mock_catalogue.json
│   │       ├── historical_baseline.json
│   │       └── timesheets.json
│   ├── requirements.txt
│   ├── run.py
│   ├── test_phase1.py
│   ├── test_phase2.py
│   └── test_phase3.py
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx                  # 1440x900 single-screen layout & header
│       ├── mockData.js              # Catalogue mirror, Try chips, 6 peer consultants
│       ├── store/metricsStore.jsx   # Single source of truth for KPIs, ROI & patterns
│       └── components/
│           ├── ChatInterface.jsx    # Chat thread, wrapping Try chips, clarification pills
│           ├── AIValuePanel.jsx     # 4 KPI cards & editable Assumptions drawer
│           ├── TimesheetGrid.jsx    # 3-state rows & inline Why? expansion
│           ├── AnomalyWarning.jsx   # Inline guardrail warnings & 1-click fixes
│           └── AdminMacroModal.jsx  # Team view modal, consultant table & CSV export
├── Dockerfile                       # Multi-stage Vite build + FastAPI container
├── Procfile
├── railway.json
├── start_dev.bat
├── implementationPlan.md
├── architecture.md
├── demo_script.md
├── user_stories.md
└── timeline.md
```

---

## Railway Deployment

The repository ships with [`Dockerfile`](Dockerfile), [`Procfile`](Procfile), and [`railway.json`](railway.json). Multi-stage Docker builds `frontend/dist` and serves both the API and static React bundle from FastAPI (`backend/run.py`) on `$PORT`.

Set the following environment variables in Railway:
- `GROQ_API_KEY`
- `GEMINI_API_KEY`
- `ENVIRONMENT=production`
