import os
import sys

# Ensure backend directory is on path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app


client = TestClient(app)


def test_duplicate_on_draft():
    client.post("/api/timesheets/reset")
    confirm_res = client.post(
        "/api/timesheets/confirm",
        json={
            "user_id": "u_priya",
            "request_id": "req_dup_setup_1",
            "entries": [
                {
                    "id": "entry_dup_1",
                    "date": "2026-11-09",
                    "project_code": "ACME-WEB",
                    "project_name": "Acme Website Redesign",
                    "task": "Design",
                    "hours": 3.0,
                    "is_billable": True,
                    "user_edited": False,
                }
            ],
        },
    )
    assert confirm_res.status_code == 200

    parse_res = client.post(
        "/api/chat/parse",
        json={
            "conversation_id": "conv_dup_test",
            "user_id": "u_priya",
            "message": "3 hours on Acme design review yesterday",
            "client_timestamp": "2026-11-10T20:00:00+05:30",
        },
    )
    assert parse_res.status_code == 200
    data = parse_res.json()
    assert len(data["draft_entries"]) >= 1
    draft = data["draft_entries"][0]
    dup_anomalies = [a for a in draft["anomalies"] if a["rule_id"] == "DUPLICATE"]
    assert len(dup_anomalies) == 1, f"Expected DUPLICATE anomaly on draft, got {draft['anomalies']}"
    assert dup_anomalies[0]["suggested_fix"]["action"] == "remove_duplicate"
    print("PASS: duplicate-on-draft detected with remove_duplicate fix")


def test_confirm_all_excludes_flagged_rows():
    client.post("/api/timesheets/reset")
    flagged_res = client.post(
        "/api/chat/parse",
        json={
            "conversation_id": "conv_flagged",
            "user_id": "u_priya",
            "message": "4 hours on Initech fieldwork today, billable",
            "client_timestamp": "2026-11-10T20:00:00+05:30",
        },
    ).json()
    clean_res = client.post(
        "/api/chat/parse",
        json={
            "conversation_id": "conv_clean",
            "user_id": "u_priya",
            "message": "3 hours on Acme design review yesterday",
            "client_timestamp": "2026-11-10T20:00:00+05:30",
        },
    ).json()

    staged = flagged_res["draft_entries"] + clean_res["draft_entries"]
    clean_only = [d for d in staged if not d.get("anomalies")]
    flagged_only = [d for d in staged if d.get("anomalies")]
    assert len(flagged_only) >= 1 and len(clean_only) >= 1

    # Confirm all commits only clean drafts; flagged rows require individual resolution or override
    res = client.post(
        "/api/timesheets/confirm",
        json={
            "user_id": "u_priya",
            "request_id": "req_confirm_all_clean",
            "entries": clean_only,
        },
    )
    assert res.status_code == 200
    stored = client.get("/api/timesheets").json()["confirmed_entries"]
    assert len(stored) == len(clean_only)
    assert all(e["project_code"] != "INITECH-AUD" for e in stored)

    # Confirm anyway with override reason logs override metadata
    ov_entry = dict(flagged_only[0])
    ov_entry["is_override"] = True
    ov_entry["override_reason"] = "Partner approved post-close billing"
    ov_entry["overridden_rules"] = [a["rule_id"] for a in ov_entry["anomalies"]]
    ov_res = client.post(
        "/api/timesheets/confirm",
        json={
            "user_id": "u_priya",
            "request_id": "req_override_1",
            "entries": [ov_entry],
        },
    )
    assert ov_res.status_code == 200
    committed_ov = ov_res.json()["entries"][0]
    assert committed_ov["is_override"] is True
    assert committed_ov["override_reason"] == "Partner approved post-close billing"
    assert "CLOSED_PROJECT" in committed_ov["overridden_rules"]
    print("PASS: confirm-all excludes flagged rows and override confirm logs reason")


def test_idempotent_confirm():
    client.post("/api/timesheets/reset")
    payload = {
        "user_id": "u_priya",
        "request_id": "req_idem_unique_123",
        "entries": [
            {
                "id": "draft_idem_1",
                "date": "2026-11-09",
                "project_code": "ACME-WEB",
                "project_name": "Acme Website Redesign",
                "task": "Design",
                "hours": 3.0,
                "is_billable": True,
                "user_edited": False,
            }
        ],
    }

    r1 = client.post("/api/timesheets/confirm", json=payload)
    assert r1.status_code == 200
    assert r1.json()["status"] == "committed"
    assert r1.json()["count"] == 1

    # Retry with exact same request_id must not duplicate
    r2 = client.post("/api/timesheets/confirm", json=payload)
    assert r2.status_code == 200
    assert r2.json()["status"] == "duplicate_ignored"

    stored = client.get("/api/timesheets").json()["confirmed_entries"]
    assert len(stored) == 1, f"Expected 1 row after idempotent retry, got {len(stored)}"
    print("PASS: idempotent confirm prevented duplicate rows on retry")


def test_weekly_estimate_flow():
    client.post("/api/timesheets/reset")
    parse_res = client.post(
        "/api/chat/parse",
        json={
            "conversation_id": "conv_weekly",
            "user_id": "u_priya",
            "message": "40 hours on Globex data migration this week.",
            "client_timestamp": "2026-11-10T20:00:00+05:30",
        },
    )
    assert parse_res.status_code == 200
    data = parse_res.json()
    assert data["requires_clarification"] is True
    assert data["clarification_prompt"] == "Roughly how was that split across the week?"
    labels = [o["label"] for o in data["clarification_options"]]
    assert labels == ["Same every day", "Let me enter days", "Save as weekly estimate"]

    # 1. Save as weekly estimate -> 1 row marked "Estimated"
    est_opt = next(o for o in data["clarification_options"] if o["action"] == "weekly_estimate")
    est_res = client.post(
        "/api/chat/resolve",
        json={
            "conversation_id": "conv_weekly",
            "user_id": "u_priya",
            "project_code": est_opt["project_code"],
            "task": est_opt["task"],
            "hours": est_opt["hours"],
            "date": "2026-11-09",
            "action": "weekly_estimate",
        },
    ).json()
    assert len(est_res["draft_entries"]) == 1
    est_row = est_res["draft_entries"][0]
    assert est_row["hours"] == 40.0
    assert est_row["estimate_tag"] == "Estimated"
    assert not any(a["rule_id"] == "UNUSUAL_HOURS" for a in est_row["anomalies"])

    # 2. Same every day -> 5 daily rows tagged "Estimated: even split"
    split_res = client.post(
        "/api/chat/resolve",
        json={
            "conversation_id": "conv_weekly",
            "user_id": "u_priya",
            "project_code": est_opt["project_code"],
            "task": est_opt["task"],
            "hours": est_opt["hours"],
            "action": "even_split",
        },
    ).json()
    assert len(split_res["draft_entries"]) == 5
    assert all(r["hours"] == 8.0 for r in split_res["draft_entries"])
    assert all(r["estimate_tag"] == "Estimated: even split" for r in split_res["draft_entries"])

    # 3. Let me enter days -> 0 rows, prompt to enter days
    enter_res = client.post(
        "/api/chat/resolve",
        json={
            "conversation_id": "conv_weekly",
            "user_id": "u_priya",
            "project_code": est_opt["project_code"],
            "task": est_opt["task"],
            "hours": est_opt["hours"],
            "action": "enter_days",
        },
    ).json()
    assert len(enter_res["draft_entries"]) == 0
    print("PASS: weekly estimate flow verified (Estimated, Estimated: even split, Let me enter days)")


def test_provider_recorded_on_every_entry():
    client.post("/api/timesheets/reset")
    res = client.post(
        "/api/chat/parse",
        json={
            "conversation_id": "conv_provider",
            "user_id": "u_priya",
            "message": "Spent 3 hours on Acme design review yesterday and 1 hour on internal standup.",
            "client_timestamp": "2026-11-10T20:00:00+05:30",
        },
    )
    assert res.status_code == 200
    data = res.json()
    valid_providers = {"Groq", "Gemini", "Local parser"}
    assert data["telemetry"]["provider"] in valid_providers
    assert len(data["draft_entries"]) >= 1
    for entry in data["draft_entries"]:
        assert entry["provider"] in valid_providers
        assert entry["trace"]["provider"] == entry["provider"]
    print(f"PASS: provider recorded on every entry ({data['telemetry']['provider']})")


if __name__ == "__main__":
    test_duplicate_on_draft()
    test_confirm_all_excludes_flagged_rows()
    test_idempotent_confirm()
    test_weekly_estimate_flow()
    test_provider_recorded_on_every_entry()
    client.post("/api/timesheets/reset")
    print("\n==============================================")
    print("SUCCESS: ALL PHASE 4 ARTICLE ALIGNMENT TESTS PASSED!")
    print("==============================================")

