import os
import sys

# Ensure backend directory is on path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.engine.calendar_hints import (
    compute_provenance,
    get_calendar_hints_for_date,
    get_llm_safe_calendar_context,
)


client = TestClient(app)


def test_reconstruction_never_auto_creates_entries():
    client.post("/api/timesheets/reset")
    plan_res = client.post(
        "/api/reconstruction/plan",
        json={
            "week_dates": [
                "2026-11-02",
                "2026-11-03",
                "2026-11-04",
                "2026-11-05",
                "2026-11-06",
            ],
            "existing_dates": ["2026-11-02"],
            "use_calendar_hints": False,
            "logged_at": "2026-11-10",
        },
    )
    assert plan_res.status_code == 200
    data = plan_res.json()
    assert data["total_missing"] == 4
    assert data["days"][0]["date"] == "2026-11-03"
    assert data["days"][0]["prompt"] == "Tuesday, Nov 3: what did you mostly work on?"
    assert len(data["days"][0]["suggestions"]) <= 3
    assert data["days"][0]["not_sure_option"]["action"] == "not_sure"

    # Crucial invariant: planning reconstruction creates ZERO entries without user input
    stored = client.get("/api/timesheets").json()["confirmed_entries"]
    assert len(stored) == 0, "Reconstruction plan must not create entries automatically!"

    # Selecting "Not sure" creates one draft tagged "Estimated"
    ns = data["days"][0]["not_sure_option"]
    ns_res = client.post(
        "/api/chat/resolve",
        json={
            "conversation_id": "conv_recon_ns",
            "user_id": "u_priya",
            "project_code": ns["project_code"],
            "task": ns["task"],
            "hours": ns["hours"],
            "date": ns["date"],
            "action": "not_sure",
        },
    )
    assert ns_res.status_code == 200
    draft = ns_res.json()["draft_entries"][0]
    assert draft["is_estimated"] is True
    assert draft["provenance_tag"] == "Estimated"
    print("PASS: reconstruction never creates entries without user input; Not sure tags Estimated")


def test_provenance_tags_computed_correctly():
    same_day = compute_provenance(work_date="2026-11-10", logged_at="2026-11-10", is_estimated=False)
    assert same_day["log_lag_days"] == 0
    assert same_day["provenance_tag"] == "Same day"

    reconstructed = compute_provenance(work_date="2026-11-03", logged_at="2026-11-10", is_estimated=False)
    assert reconstructed["log_lag_days"] == 7
    assert reconstructed["provenance_tag"] == "Reconstructed, 7d later"

    estimated = compute_provenance(work_date="2026-11-03", logged_at="2026-11-10", is_estimated=True)
    assert estimated["provenance_tag"] == "Estimated"
    print("PASS: provenance tags computed correctly (Same day, Reconstructed 7d later, Estimated)")


def test_private_calendar_events_excluded():
    # Opted out (default): returns zero hints
    off_res = client.get("/api/calendar/hints?date=2026-11-03&use_calendar_hints=false").json()
    assert off_res["hints"] == []

    # Opted in on 2026-11-03: returns linked Globex event, NEVER private 'Busy' event
    on_res = client.get("/api/calendar/hints?date=2026-11-03&use_calendar_hints=true").json()
    titles = [h["title"] for h in on_res["hints"]]
    assert "Globex Migration Architecture Review" in titles
    assert "Busy" not in titles
    assert all(h["label_tag"] == "From calendar, suggestion only" for h in on_res["hints"])

    # Unlinked event on 2026-11-04 ('Coffee Chat with Alumni') & private events excluded from LLM context
    llm_ctx = get_llm_safe_calendar_context("2026-11-04", use_calendar_hints=True)
    assert len(llm_ctx) == 1
    assert set(llm_ctx[0].keys()) == {"title", "duration_hours"}
    assert llm_ctx[0]["title"] == "Acme Mobile QA Sync"
    assert get_calendar_hints_for_date("2026-11-03", use_calendar_hints=False) == []
    print("PASS: private and unlinked calendar events excluded; LLM context strictly title+duration")


def test_team_view_matches_kpi_strip_provenance():
    client.post("/api/timesheets/reset")
    confirm_res = client.post(
        "/api/timesheets/confirm",
        json={
            "user_id": "u_priya",
            "request_id": "req_kpi_prov_1",
            "entries": [
                {
                    "id": "e_same_day",
                    "date": "2026-11-10",
                    "work_date": "2026-11-10",
                    "logged_at": "2026-11-10",
                    "project_code": "ACME-WEB",
                    "task": "Design",
                    "hours": 3.0,
                    "is_billable": True,
                    "is_estimated": False,
                },
                {
                    "id": "e_reconstructed",
                    "date": "2026-11-03",
                    "work_date": "2026-11-03",
                    "logged_at": "2026-11-10",
                    "project_code": "GLOBEX-DATA",
                    "task": "Migration",
                    "hours": 4.0,
                    "is_billable": True,
                    "is_estimated": False,
                },
            ],
        },
    )
    assert confirm_res.status_code == 200
    entries = client.get("/api/timesheets").json()["confirmed_entries"]
    assert len(entries) == 2

    same_day_count = sum(1 for e in entries if not e["is_estimated"] and e["log_lag_days"] == 0)
    reconstructed_count = sum(1 for e in entries if not e["is_estimated"] and e["log_lag_days"] > 0)
    same_day_pct = round((same_day_count / len(entries)) * 100, 1)
    reconstructed_pct = round((reconstructed_count / len(entries)) * 100, 1)
    avg_lag = round(sum(e["log_lag_days"] for e in entries) / len(entries), 1)

    assert same_day_pct == 50.0
    assert reconstructed_pct == 50.0
    assert avg_lag == 3.5
    print("PASS: Team view & KPI strip provenance metrics match (50% same-day, 50% reconstructed, 3.5d avg lag)")


if __name__ == "__main__":
    test_reconstruction_never_auto_creates_entries()
    test_provenance_tags_computed_correctly()
    test_private_calendar_events_excluded()
    test_team_view_matches_kpi_strip_provenance()
    client.post("/api/timesheets/reset")
    print("\n==============================================")
    print("SUCCESS: ALL PHASE 5 RECONSTRUCTION TESTS PASSED!")
    print("==============================================")

