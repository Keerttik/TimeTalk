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
py -m uvicorn app.main:app --reload --port 8000
```
- Health Check: [http://localhost:8000/health](http://localhost:8000/health)
- API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

#### Terminal 2 — Frontend (React + Vite):
```powershell
cd frontend
npm install
npm run dev
```
- Web Application: [http://localhost:5173](http://localhost:5173)

---

## Phase 1 Implementation Summary

### Completed Deliverables (FR1, FR2, FR3, FR5, FR7)

1. **Extraction Engine (`backend/app/engine/extractor.py`)**
   - Natural language activity parser extracting dates, hours, task hints, and billability intent.
   - Relative date resolver: maps "yesterday" to Monday (2026-11-09) and "today" to Tuesday (2026-11-10).
   - Hybrid inference: Integrates Google Gemini API when `GEMINI_API_KEY` is present, with deterministic fallback parser for offline testing.

2. **Catalogue Matcher & Grounding (`backend/app/engine/matcher.py`)**
   - Strict grounding against `mock_catalogue.json` (`ACME-WEB`, `ACME-MOB`, `GLOBEX-DATA`, `INITECH-AUD`, `INT-OPS`).
   - Confidence scoring ($0.0 - 1.0$) with $\ge 80\%$ auto-draft threshold.
   - Ambiguity detection: Identifies underspecified entries (e.g. "Acme development") and requests user clarification instead of guessing.

3. **Weekly Timesheet Grid (`frontend/src/components/TimesheetGrid.jsx`)**
   - Renders weekly timesheet view for Northwind Consulting.
   - Visual distinction between Confirmed rows and Draft (AI-generated) rows.
   - Inline editable inputs for hours, project selector, task selector, and billable status toggle.
   - "Confirm All Drafts" and individual row "Confirm" / "Discard" buttons.
   - **FR7 Invariant**: Zero rows are committed to master storage until deliberate user confirmation.

4. **Chat Interface (`frontend/src/components/ChatInterface.jsx`)**
   - Multi-message conversational thread with test prompt chips.
   - Interactive clarification quick-reply chips for resolving ambiguous inputs.

5. **Observability & Telemetry (`frontend/src/components/WhyTraceModal.jsx` & `AIValuePanel.jsx`)**
   - "Why?" modal inspecting confidence scores, reasoning traces, and tokens.
   - Real-time AI Value & ROI panel tracking tokens, AI costs in paise, time saved, and leakage caught.

---

## Verification & Automated Test Suite

To run the automated Phase 1 exit criteria test:
```powershell
cd backend
py test_phase1.py
```

### Exit Criteria Results:
- [x] Input: *"Spent 3 hours on the Acme design review yesterday and 1 hour on internal standup."*
- [x] Backend produces 2 structured objects matched to `ACME-WEB (Design)` and `INT-OPS (Standup)`.
- [x] Both draft rows appear under yesterday's date (2026-11-09).
- [x] Clicking "Confirm" commits rows to storage.
- [x] Zero rows committed prior to confirmation (FR7 preserved).

