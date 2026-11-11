import json
import os
from datetime import datetime
from typing import List, Dict, Any, Optional

BASELINE_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "historical_baseline.json")
TIMESHEETS_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "timesheets.json")

def load_baseline() -> Dict[str, Any]:
    with open(BASELINE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def load_timesheets() -> Dict[str, Any]:
    if not os.path.exists(TIMESHEETS_PATH):
        return {"user_id": "u_priya", "confirmed_entries": []}
    with open(TIMESHEETS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def evaluate_anomalies(
    date_str: str,
    project: Dict[str, Any],
    task: str,
    hours: float,
    is_billable: bool,
    existing_day_hours: float = 0.0,
    confirmed_entries: Optional[List[Dict[str, Any]]] = None
) -> List[Dict[str, Any]]:
    anomalies = []
    baseline = load_baseline()
    
    # 1. Closed Project Check (Rule 5)
    project_status = project.get("status", "active")
    end_date_str = project.get("end_date")
    if project_status == "closed" or (end_date_str and date_str > end_date_str):
        display_date = "31 Oct"
        if end_date_str:
            try:
                display_date = datetime.strptime(end_date_str, "%Y-%m-%d").strftime("%d %b")
            except Exception:
                display_date = end_date_str
        anomalies.append({
            "rule_id": "CLOSED_PROJECT",
            "severity": "error",
            "message": f"This project closed on {display_date}. Time cannot be billed.",
            "suggested_fix": {
                "action": "change_project",
                "value": "INT-OPS"
            }
        })

    # 2. Billable on Internal Project (Rule 3)
    if is_billable and (project.get("type") == "non_billable" or project.get("code") == "INT-OPS"):
        anomalies.append({
            "rule_id": "BILLABLE_INTERNAL",
            "severity": "warning",
            "message": "Internal projects aren't billable. Switch to non-billable?",
            "suggested_fix": {
                "action": "set_non_billable",
                "value": False
            }
        })

    # 3. Budget Burn Breach > 90% (Rule 4)
    budget_hours = project.get("budget_hours")
    hours_logged = project.get("hours_logged", 0)
    if budget_hours and budget_hours > 0:
        new_total = hours_logged + hours
        pct = (new_total / budget_hours) * 100.0
        if pct > 90.0:
            anomalies.append({
                "rule_id": "BUDGET_BURN",
                "severity": "warning",
                "message": f"{project.get('code')} {task} is now at {pct:.0f}% of budget.",
                "suggested_fix": None
            })

    # 4. Weekend or Holiday Entry (Rule 2)
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        day_of_week = dt.weekday()  # Monday is 0, Sunday is 6
        is_weekend = day_of_week in [5, 6]
        
        holidays = [h.get("date") for h in baseline.get("mock_holidays", [])]
        is_holiday = date_str in holidays
        
        if is_weekend or is_holiday:
            day_name = "Sunday" if day_of_week == 6 else ("Saturday" if day_of_week == 5 else "Holiday")
            anomalies.append({
                "rule_id": "WEEKEND_HOLIDAY",
                "severity": "warning",
                "message": f"This date is a {day_name}. Still billable?",
                "suggested_fix": None
            })
    except Exception:
        pass

    # 5. Unusual Daily Hours Statistical Z-Score (Rule 1)
    stats = baseline.get("baseline_stats", {})
    mean_hours = stats.get("average_daily_hours", 8.2)
    std_dev = stats.get("std_dev_hours", 1.1)
    threshold = stats.get("unusual_hours_threshold", 10.4)
    
    total_day_hours = existing_day_hours + hours
    if total_day_hours > threshold:
        anomalies.append({
            "rule_id": "UNUSUAL_HOURS",
            "severity": "warning",
            "message": f"{total_day_hours:.1f} hrs is well above your usual {mean_hours:.1f} hrs. Correct?",
            "suggested_fix": {
                "action": "adjust_hours",
                "value": 8.0
            }
        })

    # 6. Duplicate Entry Check (Rule 6)
    if confirmed_entries is None:
        confirmed_entries = load_timesheets().get("confirmed_entries", [])
    
    for entry in confirmed_entries:
        if (entry.get("date") == date_str and 
            entry.get("project_code") == project.get("code") and 
            entry.get("task", "").lower() == task.lower()):
            anomalies.append({
                "rule_id": "DUPLICATE",
                "severity": "warning",
                "message": f"You already logged {entry.get('hours')} hrs here today.",
                "suggested_fix": {
                    "action": "remove_duplicate",
                    "value": None
                }
            })
            break

    return anomalies

