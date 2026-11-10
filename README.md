# TimeTalk: Conversational Timesheet Copilot

TimeTalk is an enterprise conversational timesheet copilot built for Northwind Consulting. It combines natural language text processing with strict catalogue grounding, deterministic and statistical anomaly rules, and real-time economic telemetry.

---

## Quick Start Guide

### Prerequisites
- Python 3.10+ (available via `py`)
- Node.js 18+ and npm

### 1. Launch All Services (One-Click)
Run the batch file on Windows:
```powershell
.\start_dev.bat
```

Or run frontend and backend independently in two separate terminals:

#### Terminal 1 — Backend (FastAPI):
```powershell
cd backend
py -m pip install -r requirements.txt
py run.py
```
- Health Check: [http://localhost:8000/health](http://localhost:8000/health)
- API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)
- Admin Metrics: [http://localhost:8000/api/admin/metrics](http://localhost:8000/api/admin/metrics)

#### Terminal 2 — Frontend (React + Vite):
```powershell
cd frontend
npm install
npm run dev
```
- Web Application: [http://localhost:5173](http://localhost:5173)

---

## Phase-Wise Delivery Breakdown

### Phase 1: The Core Loop (`FR1`, `FR2`, `FR3`, `FR5`, `FR7`)
- **Extraction Engine**: Natural language activity parser extracting dates, hours, and task hints. Resolves relative terms ("yesterday", "today") to exact ISO dates.
- **Catalogue Grounding**: Strict matching against `mock_catalogue.json` with confidence evaluation.
- **Weekly Timesheet Grid**: Editable draft rows with inline project/task selectors and billability toggles.
- **Zero Auto-Commit Invariant (`FR7`)**: 0 rows are committed to master storage without explicit human confirmation.

### Phase 2: The Trust Layer & Guardrails (`FR4`, `FR6`, `FR9`)
- **Ambiguity Clarification (`FR4`)**: Halts on ambiguous inputs (e.g. *"2 hours on Acme development"*) and offers interactive quick-reply chips instead of guessing.
- **6 Hybrid Anomaly Checks (`FR6`)**:
  1. `CLOSED_PROJECT`: Detects logging against closed client projects (`INITECH-AUD`).
  2. `BILLABLE_INTERNAL`: Detects billable hours marked on internal projects (`INT-OPS`).
  3. `UNUSUAL_HOURS`: Statistical Z-Score outlier detection ($>10.4\text{h}$).
  4. `WEEKEND_HOLIDAY`: Flags weekend and company holiday logging.
  5. `BUDGET_BURN`: Warns when project hours exceed $90\%$ of budget.
  6. `DUPLICATE`: Flags duplicate entries logged on the same date and task.
- **1-Click Auto-Fix**: One-click inline resolution buttons (`Switch Non-Billable`, `Change to Internal`, `Set to 8h`).
- **Observability "Why?" Flyout (`FR9`)**: Inspects matching rationale, confidence score, tokens, latency, and 6/6 guardrail check audit checklist.

### Phase 3: AI Value Panel, Admin Macro Analytics & Demo (`FR8`, `FR10`)
- **Live AI Value & ROI Panel (`FR8`)**: Real-time economic telemetry tracking tokens consumed, model cost in paise, time saved, billing leakage caught, and live session ROI ($>10\times$).
- **Admin Macro Analytics (`FR10`)**: Executive view summarizing total conversations, billable utilization rate, net value created, and quality benchmarks (Edit Rate $< 15\%$). Includes CSV export.
- **Containerized Railway Deployment**: Multi-stage `Dockerfile`, `Procfile`, and `railway.json` serving both frontend and backend on Railway.

---

## 90-Second Demo Walkthrough Guide

Follow the 5-step narrative defined in `demo_script.md`:

1. **Step 1: Speed Test (0:15 - 0:32)**
   - Click the test chip: `"Spent 3 hours on the Acme design review yesterday and 1 hour on standup."`
   - *Result:* Two draft rows appear under yesterday's column in $< 3$ seconds. Shows speed and multi-activity extraction. Click "Confirm All Drafts".

2. **Step 2: No Guessing / Precision (0:32 - 0:48)**
   - Click or type: `"2 hours on Acme development."`
   - *Result:* Because confidence is below $80\%$ across Website vs. Mobile, TimeTalk asks: *"Did you work on Acme Website (ACME-WEB) or Acme Mobile (ACME-MOB)?"*. Click `[Acme Mobile (ACME-MOB)]` to stage the draft.

3. **Step 3: Revenue Protection / Leakage (0:48 - 1:05)**
   - Click or type: `"4 hours on Initech fieldwork today, billable."`
   - *Result:* Red policy warning appears: *"This project closed on 31 Oct. Time cannot be billed."* Saves ₹12,000 in disputed invoices. Click "Change to Internal" or discard.

4. **Step 4: Observability Trace (1:05 - 1:18)**
   - Click the **"Why?"** button on any row.
   - *Result:* Opens the AI Observability drawer showing confidence score, reasoning trail, model latency, and the 6/6 invariant audit checklist.

5. **Step 5: Verifiable ROI & Admin Analytics (1:18 - 1:30)**
   - Point to the **Live AI Value Panel** on the right (Live ROI $>10\times$, cost in paise).
   - Click **"Admin Macro View (FR10)"** in the top bar to inspect executive KPIs and click "Export CSV Report".

---

## Automated Verification Suite

Run all phase test suites:
```powershell
cd backend
py test_phase1.py
py test_phase2.py
py test_phase3.py
```
