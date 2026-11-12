import json
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

CALENDAR_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "mock_calendar.json")


def load_mock_calendar() -> Dict[str, Any]:
    if not os.path.exists(CALENDAR_PATH):
        return {"user_id": "u_priya", "events": []}
    with open(CALENDAR_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def get_calendar_hints_for_date(
    date_str: str,
    use_calendar_hints: bool = False,
    linked_only: bool = True,
) -> List[Dict[str, Any]]:
    """
    Return non-private calendar hints for a date when opted in.
    Private events (is_private=True or title=='Busy') are never returned.
    """
    if not use_calendar_hints:
        return []

    calendar = load_mock_calendar()
    hints: List[Dict[str, Any]] = []
    for ev in calendar.get("events", []):
        if ev.get("date") != date_str:
            continue
        if ev.get("is_private") or (ev.get("title") or "").strip().lower() == "busy":
            continue
        if linked_only and not ev.get("project_code"):
            continue
        hints.append(
            {
                "id": ev.get("id"),
                "date": ev.get("date"),
                "title": ev.get("title"),
                "duration_hours": float(ev.get("duration_hours") or 1.0),
                "project_code": ev.get("project_code"),
                "task": ev.get("task") or "General",
                "source": "calendar_hint",
                "label_tag": "From calendar, suggestion only",
            }
        )
    return hints


def get_llm_safe_calendar_context(
    date_str: str,
    use_calendar_hints: bool = False,
) -> List[Dict[str, Any]]:
    """
    Only title and duration of linked non-private events may ever be passed to an LLM.
    """
    hints = get_calendar_hints_for_date(
        date_str=date_str,
        use_calendar_hints=use_calendar_hints,
        linked_only=True,
    )
    return [
        {
            "title": h["title"],
            "duration_hours": h["duration_hours"],
        }
        for h in hints
    ]


def compute_provenance(
    work_date: str,
    logged_at: Optional[str] = None,
    is_estimated: bool = False,
) -> Dict[str, Any]:
    """
    Compute log lag in days and provenance tag from work_date and logged_at.
    """
    logged_date_str = (logged_at or datetime.now().strftime("%Y-%m-%d"))[:10]
    work_date_str = (work_date or logged_date_str)[:10]

    try:
        d_work = datetime.strptime(work_date_str, "%Y-%m-%d").date()
        d_logged = datetime.strptime(logged_date_str, "%Y-%m-%d").date()
        lag_days = max(0, (d_logged - d_work).days)
    except Exception:
        lag_days = 0

    if is_estimated:
        tag = "Estimated"
        tone = "amber"
    elif lag_days == 0:
        tag = "Same day"
        tone = "green"
    else:
        tag = f"Reconstructed, {lag_days}d later"
        tone = "grey"

    return {
        "work_date": work_date_str,
        "logged_at": logged_date_str,
        "log_lag_days": lag_days,
        "provenance_tag": tag,
        "provenance_tone": tone,
        "is_estimated": bool(is_estimated),
    }

