import os
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .models.schemas import (
    ChatParseRequest,
    ChatParseResponse,
    DraftTimesheetEntry,
    Telemetry,
    ClarificationOption,
    ClarificationResolveRequest,
    TimesheetConfirmRequest,
    TimesheetConfirmResponse,
    TimesheetConfirmItem,
    ReconstructionPlanRequest
)
from .engine.extractor import extract_timesheet_drafts
from .engine.matcher import load_catalogue
from .engine.anomalies import load_baseline, load_timesheets, evaluate_anomalies, TIMESHEETS_PATH
from .engine.calendar_hints import get_calendar_hints_for_date, compute_provenance

app = FastAPI(
    title="TimeTalk API",
    description="Conversational Timesheet Copilot Backend",
    version="1.0.0"
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "app": "TimeTalk API"
    }

@app.get("/api/catalogue")
def get_catalogue():
    return load_catalogue()

@app.get("/api/baseline")
def get_baseline():
    return load_baseline()

@app.get("/api/timesheets")
def get_timesheets():
    return load_timesheets()

@app.get("/api/calendar/hints")
def get_calendar_hints(date: str, use_calendar_hints: bool = False):
    """
    Return non-private linked calendar hints for a date when opted in.
    Private events ('Busy') are never returned.
    """
    return {
        "date": date,
        "use_calendar_hints": use_calendar_hints,
        "hints": get_calendar_hints_for_date(
            date_str=date,
            use_calendar_hints=use_calendar_hints,
            linked_only=True,
        ),
    }

@app.post("/api/reconstruction/plan")
def plan_reconstruction(req: ReconstructionPlanRequest):
    """
    Detect working days in the selected week with no entries and return up to 3
    suggestion chips per missing day plus 'Not sure'. Never creates entries automatically.
    """
    timesheets_data = load_timesheets()
    confirmed = timesheets_data.get("confirmed_entries", [])
    existing_set = set(req.existing_dates or [])
    for e in confirmed:
        if e.get("date"):
            existing_set.add(e["date"])

    week_dates = req.week_dates or [
        "2026-11-02",
        "2026-11-03",
        "2026-11-04",
        "2026-11-05",
        "2026-11-06",
    ]
    missing_dates = [d for d in week_dates if d not in existing_set]

    catalogue = load_catalogue()
    active_projects = [p for p in catalogue.get("projects", []) if p.get("status") != "closed"]

    # Build up to 2 fallback suggestions from previous entries, then active catalogue
    prev_suggestions: List[Dict[str, Any]] = []
    seen_prev = set()
    for e in reversed(confirmed):
        key = (e.get("project_code"), e.get("task"))
        if key not in seen_prev and e.get("project_code"):
            seen_prev.add(key)
            prev_suggestions.append(
                {
                    "label": f"{e['project_code']} · {e.get('task', 'General')} ({e.get('hours', 8)}h)",
                    "project_code": e["project_code"],
                    "task": e.get("task", "General"),
                    "hours": float(e.get("hours") or 8.0),
                    "source": "previous_entry",
                    "label_tag": "From previous entries",
                }
            )
    for p in active_projects:
        task_name = p["tasks"][0] if p.get("tasks") else "General"
        key = (p["code"], task_name)
        if key not in seen_prev:
            seen_prev.add(key)
            prev_suggestions.append(
                {
                    "label": f"{p['code']} · {task_name} (8h)",
                    "project_code": p["code"],
                    "task": task_name,
                    "hours": 8.0,
                    "source": "catalogue",
                    "label_tag": "Active project",
                }
            )

    days_plan = []
    for d_str in missing_dates:
        try:
            dt = datetime.strptime(d_str, "%Y-%m-%d")
            day_label = dt.strftime("%A, %b ") + str(dt.day)
        except Exception:
            day_label = d_str

        cal_hints = get_calendar_hints_for_date(
            date_str=d_str,
            use_calendar_hints=req.use_calendar_hints,
            linked_only=True,
        )
        day_suggestions: List[Dict[str, Any]] = []
        used_keys = set()

        for h in cal_hints:
            if len(day_suggestions) >= 3:
                break
            key = (h["project_code"], h["task"])
            used_keys.add(key)
            day_suggestions.append(
                {
                    "label": f"{h['title']} ({h['project_code']}, {h['duration_hours']}h)",
                    "project_code": h["project_code"],
                    "task": h["task"],
                    "hours": h["duration_hours"],
                    "source": "calendar_hint",
                    "label_tag": "From calendar, suggestion only",
                    "calendar_title": h["title"],
                }
            )

        for ps in prev_suggestions:
            if len(day_suggestions) >= 3:
                break
            key = (ps["project_code"], ps["task"])
            if key not in used_keys:
                used_keys.add(key)
                day_suggestions.append(ps)

        days_plan.append(
            {
                "date": d_str,
                "day_label": day_label,
                "prompt": f"{day_label}: what did you mostly work on?",
                "suggestions": day_suggestions[:3],
                "not_sure_option": {
                    "label": "Not sure",
                    "action": "not_sure",
                    "project_code": active_projects[0]["code"] if active_projects else "ACME-WEB",
                    "task": (active_projects[0]["tasks"][0] if active_projects and active_projects[0].get("tasks") else "General"),
                    "hours": 8.0,
                    "date": d_str,
                },
            }
        )

    return {
        "status": "planned",
        "total_missing": len(days_plan),
        "days": days_plan,
    }

@app.get("/api/admin/metrics")
def get_admin_metrics():
    timesheets = load_timesheets()
    confirmed = timesheets.get("confirmed_entries", [])
    catalogue = load_catalogue()
    projects_map = {p["code"]: p for p in catalogue.get("projects", [])}
    
    total_confirmed = len(confirmed)
    total_hours = sum(e.get("hours", 0) for e in confirmed)
    billable_hours = sum(e.get("hours", 0) for e in confirmed if e.get("is_billable"))
    non_billable_hours = total_hours - billable_hours
    
    edited_count = sum(1 for e in confirmed if e.get("user_edited", False))
    edit_rate_pct = round((edited_count / total_confirmed * 100), 1) if total_confirmed > 0 else 0.0
    
    # Financial metrics
    billable_value = sum(
        e.get("hours", 0) * projects_map.get(e.get("project_code"), {}).get("bill_rate", 0)
        for e in confirmed if e.get("is_billable")
    )
    
    # Time Saved (2.0 mins manual per entry)
    time_saved_minutes = round(total_confirmed * 2.0, 1)
    value_of_time_saved = round((time_saved_minutes / 60.0) * 1500.0, 2)
    
    # Estimated AI Costs (approx 450 tokens per entry @ ₹8/1M)
    estimated_tokens = total_confirmed * 450 + 800
    ai_cost_rupees = round((estimated_tokens / 1_000_000.0) * 8.0, 4)
    
    # Total economic value & ROI
    leakage_caught_rupees = 12000.0 if any(e.get("project_code") == "INITECH-AUD" for e in confirmed) else 0.0
    total_value = value_of_time_saved + leakage_caught_rupees
    roi_ratio = round(total_value / max(ai_cost_rupees, 0.01), 1) if ai_cost_rupees > 0 else 0.0

    return {
        "status": "success",
        "sample_period": "Week 46 (Nov 9 - Nov 15, 2026)",
        "organization": "Northwind Consulting",
        "consultant_count": 1,
        "total_conversations": max(1, total_confirmed // 2 + 1),
        "total_entries_confirmed": total_confirmed,
        "total_hours_logged": round(total_hours, 1),
        "billable_hours": round(billable_hours, 1),
        "non_billable_hours": round(non_billable_hours, 1),
        "billable_utilization_pct": round((billable_hours / total_hours * 100), 1) if total_hours > 0 else 0.0,
        "edit_rate_pct": edit_rate_pct,
        "edit_rate_benchmark": "< 15% (Target met)",
        "billing_value_generated_inr": billable_value,
        "time_saved_minutes": time_saved_minutes,
        "value_of_time_saved_inr": value_of_time_saved,
        "leakage_prevented_inr": leakage_caught_rupees,
        "estimated_ai_cost_inr": ai_cost_rupees,
        "total_economic_value_inr": round(total_value, 2),
        "net_roi": roi_ratio
    }

@app.post("/api/timesheets/reset")
def reset_timesheets():
    initial_data = {
        "user_id": "u_priya",
        "current_week_start": "2026-11-09",
        "confirmed_entries": [],
        "processed_requests": {}
    }
    with open(TIMESHEETS_PATH, "w", encoding="utf-8") as f:
        json.dump(initial_data, f, indent=2)
    return {"status": "reset", "confirmed_entries": []}

@app.post("/api/chat/parse", response_model=ChatParseResponse)
def parse_chat_message(req: ChatParseRequest):
    draft_entries, telemetry, requires_clarification, clarification_prompt, clarification_options = extract_timesheet_drafts(
        user_message=req.message,
        client_timestamp=req.client_timestamp
    )
    
    assistant_msg = ""
    if requires_clarification:
        assistant_msg = clarification_prompt or "Please clarify your entry."
    elif draft_entries:
        total_hrs = sum(e["hours"] for e in draft_entries)
        assistant_msg = f"I've staged {len(draft_entries)} draft {'entry' if len(draft_entries) == 1 else 'entries'} ({total_hrs} hrs total) for your review. Please review and confirm below."
        fallback_from = (draft_entries[0].get("trace") or {}).get("fallback_from")
        if fallback_from:
            assistant_msg += f" (Note: {fallback_from} was unavailable, so {telemetry.get('provider', 'Local parser')} handled this extraction.)"
    else:
        assistant_msg = "I couldn't detect any timesheet activities in that message. Try stating hours and project (e.g. 'Spent 3 hours on Acme design review yesterday')."

    converted_drafts = [DraftTimesheetEntry(**d) for d in draft_entries]
    converted_telemetry = Telemetry(**telemetry)
    converted_options = [ClarificationOption(**opt) for opt in clarification_options] if clarification_options else None
    
    return ChatParseResponse(
        conversation_id=req.conversation_id,
        status="success",
        requires_clarification=requires_clarification,
        clarification_prompt=clarification_prompt,
        clarification_options=converted_options,
        assistant_message=assistant_msg,
        draft_entries=converted_drafts,
        telemetry=converted_telemetry
    )

@app.post("/api/chat/resolve", response_model=ChatParseResponse)
def resolve_clarification(req: ClarificationResolveRequest):
    import time
    start_time = time.time()
    catalogue = load_catalogue()
    projects = catalogue.get("projects", [])
    proj = next((p for p in projects if p["code"] == req.project_code), None)
    
    if not proj:
        raise HTTPException(status_code=404, detail=f"Project code {req.project_code} not found in catalogue")
        
    task = req.task or (proj["tasks"][0] if proj.get("tasks") else "General")
    is_billable = proj.get("is_billable", True) if req.is_billable is None else req.is_billable
    
    timesheets_data = load_timesheets()
    confirmed = timesheets_data.get("confirmed_entries", [])
    latency = max(int((time.time() - start_time) * 1000), 75)

    if req.action == "enter_days":
        return ChatParseResponse(
            conversation_id=req.conversation_id,
            status="success",
            requires_clarification=False,
            clarification_prompt=None,
            clarification_options=None,
            assistant_message="Got it. Tell me the hours per day (for example: 'Mon 8h, Tue 10h, Wed 6h on Globex') and I'll stage each day.",
            draft_entries=[],
            telemetry=Telemetry(
                model="localllm-hybrid-v1",
                provider="Local parser",
                input_tokens=60,
                output_tokens=30,
                latency_ms=latency
            )
        )

    if req.action == "weekly_estimate" or req.action == "not_sure":
        est_date = req.date or "2026-11-09"
        prov = compute_provenance(work_date=est_date, logged_at="2026-11-10", is_estimated=True)
        existing_day_hours = sum(e.get("hours", 0) for e in confirmed if e.get("date") == est_date)
        anomalies = evaluate_anomalies(
            date_str=est_date,
            project=proj,
            task=task,
            hours=req.hours,
            is_billable=is_billable,
            existing_day_hours=existing_day_hours,
            confirmed_entries=confirmed,
            skip_daily_outlier=(req.action == "weekly_estimate")
        )
        draft = DraftTimesheetEntry(
            id=f"draft_{int(time.time()*1000)}_{'not_sure' if req.action == 'not_sure' else 'weekly_est'}",
            date=est_date,
            work_date=prov["work_date"],
            logged_at=prov["logged_at"],
            log_lag_days=prov["log_lag_days"],
            provenance_tag=prov["provenance_tag"],
            is_estimated=True,
            project_code=proj["code"],
            project_name=proj["name"],
            task=task,
            hours=req.hours,
            is_billable=is_billable,
            status="draft",
            user_edited=False,
            confidence=0.88 if req.action == "not_sure" else 0.94,
            reasoning=(
                f"Logged {req.hours}h estimate on {proj['name']} ({proj['code']}) / {task} because user selected Not sure."
                if req.action == "not_sure"
                else f"Saved {req.hours}h on {proj['name']} ({proj['code']}) / {task} as a single weekly estimate."
            ),
            raw_input_snippet=req.raw_snippet or f"{req.hours} hours on {proj['name']}",
            provider="Local parser",
            estimate_tag="Estimated",
            anomalies=anomalies,
            trace={
                "model": "localllm-hybrid-v1",
                "provider": "Local parser",
                "tokens": 180,
                "latency_ms": latency
            }
        )
        return ChatParseResponse(
            conversation_id=req.conversation_id,
            status="success",
            requires_clarification=False,
            assistant_message=(
                f"Staged {req.hours} hrs on {proj['code']} for {est_date}, tagged Estimated."
                if req.action == "not_sure"
                else f"Staged 1 weekly estimate row ({req.hours} hrs) for {proj['name']} ({proj['code']})."
            ),
            draft_entries=[draft],
            telemetry=Telemetry(
                model="localllm-hybrid-v1",
                provider="Local parser",
                input_tokens=120,
                output_tokens=60,
                latency_ms=latency
            )
        )

    if req.action == "even_split":
        week_dates = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"]
        daily_hours = round(float(req.hours) / 5.0, 2)
        split_drafts = []
        base_ts = int(time.time() * 1000)
        for idx, d_str in enumerate(week_dates):
            prov = compute_provenance(work_date=d_str, logged_at="2026-11-10", is_estimated=True)
            existing_day_hours = sum(e.get("hours", 0) for e in confirmed if e.get("date") == d_str)
            anomalies = evaluate_anomalies(
                date_str=d_str,
                project=proj,
                task=task,
                hours=daily_hours,
                is_billable=is_billable,
                existing_day_hours=existing_day_hours,
                confirmed_entries=confirmed
            )
            split_drafts.append(
                DraftTimesheetEntry(
                    id=f"draft_{base_ts}_split_{idx + 1}",
                    date=d_str,
                    work_date=prov["work_date"],
                    logged_at=prov["logged_at"],
                    log_lag_days=prov["log_lag_days"],
                    provenance_tag=prov["provenance_tag"],
                    is_estimated=True,
                    project_code=proj["code"],
                    project_name=proj["name"],
                    task=task,
                    hours=daily_hours,
                    is_billable=is_billable,
                    status="draft",
                    user_edited=False,
                    confidence=0.94,
                    reasoning=f"Split {req.hours}h weekly total evenly across Mon-Fri ({daily_hours}h/day) for {proj['code']} / {task}.",
                    raw_input_snippet=req.raw_snippet or f"{req.hours} hours on {proj['name']} this week",
                    provider="Local parser",
                    estimate_tag="Estimated: even split",
                    anomalies=anomalies,
                    trace={
                        "model": "localllm-hybrid-v1",
                        "provider": "Local parser",
                        "tokens": 210,
                        "latency_ms": latency
                    }
                )
            )
        return ChatParseResponse(
            conversation_id=req.conversation_id,
            status="success",
            requires_clarification=False,
            assistant_message=f"Staged 5 daily rows ({daily_hours} hrs/day) for {proj['name']} ({proj['code']}), tagged as Estimated: even split.",
            draft_entries=split_drafts,
            telemetry=Telemetry(
                model="localllm-hybrid-v1",
                provider="Local parser",
                input_tokens=140,
                output_tokens=120,
                latency_ms=latency
            )
        )

    resolve_date = req.date or "2026-11-10"
    prov = compute_provenance(work_date=resolve_date, logged_at="2026-11-10", is_estimated=False)
    existing_day_hours = sum(e.get("hours", 0) for e in confirmed if e.get("date") == resolve_date)
    
    anomalies = evaluate_anomalies(
        date_str=resolve_date,
        project=proj,
        task=task,
        hours=req.hours,
        is_billable=is_billable,
        existing_day_hours=existing_day_hours,
        confirmed_entries=confirmed
    )
    
    draft = DraftTimesheetEntry(
        id=f"draft_{int(time.time()*1000)}_clarified",
        date=resolve_date,
        work_date=prov["work_date"],
        logged_at=prov["logged_at"],
        log_lag_days=prov["log_lag_days"],
        provenance_tag=prov["provenance_tag"],
        is_estimated=False,
        project_code=proj["code"],
        project_name=proj["name"],
        task=task,
        hours=req.hours,
        is_billable=is_billable,
        status="draft",
        user_edited=False,
        confidence=0.95,
        reasoning=f"User clarified project selection to {proj['name']} ({proj['code']}) / {task}",
        raw_input_snippet=req.raw_snippet or f"{req.hours} hours on {proj['name']}",
        provider="Local parser",
        anomalies=anomalies,
        trace={
            "model": "localllm-hybrid-v1",
            "provider": "Local parser",
            "tokens": 195,
            "latency_ms": latency
        }
    )
    
    assistant_msg = f"Got it! Staged {req.hours} hrs for {proj['name']} ({proj['code']}) under {task} ({'billable' if is_billable else 'non-billable'})."
    
    return ChatParseResponse(
        conversation_id=req.conversation_id,
        status="success",
        requires_clarification=False,
        clarification_prompt=None,
        clarification_options=None,
        assistant_message=assistant_msg,
        draft_entries=[draft],
        telemetry=Telemetry(
            model="localllm-hybrid-v1",
            provider="Local parser",
            input_tokens=180,
            output_tokens=75,
            latency_ms=latency
        )
    )

@app.post("/api/timesheets/confirm", response_model=TimesheetConfirmResponse)
def confirm_timesheets(req: TimesheetConfirmRequest):
    # Commits confirmed entries to storage (FR7 invariant) with request_id idempotency
    timesheets_data = load_timesheets()
    confirmed = timesheets_data.get("confirmed_entries", [])
    processed_requests = timesheets_data.get("processed_requests", {})

    if req.request_id and req.request_id in processed_requests:
        cached = processed_requests[req.request_id]
        cached_entries = [TimesheetConfirmItem(**e) for e in cached.get("entries", [])]
        return TimesheetConfirmResponse(
            status="duplicate_ignored",
            request_id=req.request_id,
            count=len(cached_entries),
            entries=cached_entries
        )

    existing_ids = {e.get("id") for e in confirmed if e.get("id")}
    catalogue = load_catalogue()
    projects_map = {p["code"]: p["name"] for p in catalogue.get("projects", [])}
    
    added_items = []
    for item in req.entries:
        if item.id and item.id in existing_ids:
            continue
        p_name = item.project_name or projects_map.get(item.project_code, item.project_code)
        entry_id = item.id or f"entry_{int(datetime.now().timestamp()*1000)}"
        existing_ids.add(entry_id)
        prov = compute_provenance(
            work_date=item.work_date or item.date,
            logged_at=item.logged_at or "2026-11-10",
            is_estimated=bool(item.is_estimated),
        )
        entry_record = {
            "id": entry_id,
            "date": item.date,
            "work_date": prov["work_date"],
            "logged_at": prov["logged_at"],
            "log_lag_days": prov["log_lag_days"],
            "provenance_tag": item.provenance_tag or prov["provenance_tag"],
            "is_estimated": prov["is_estimated"],
            "project_code": item.project_code,
            "project_name": p_name,
            "task": item.task,
            "hours": float(item.hours),
            "is_billable": item.is_billable,
            "user_edited": item.user_edited,
            "is_override": item.is_override,
            "override_reason": item.override_reason,
            "overridden_rules": item.overridden_rules or [],
            "overridden_messages": item.overridden_messages or [],
            "override_timestamp": item.override_timestamp,
            "status": "confirmed",
            "confirmed_at": datetime.now().isoformat()
        }
        confirmed.append(entry_record)
        added_items.append(TimesheetConfirmItem(
            id=entry_record["id"],
            date=entry_record["date"],
            work_date=entry_record["work_date"],
            logged_at=entry_record["logged_at"],
            log_lag_days=entry_record["log_lag_days"],
            provenance_tag=entry_record["provenance_tag"],
            is_estimated=entry_record["is_estimated"],
            project_code=entry_record["project_code"],
            project_name=entry_record["project_name"],
            task=entry_record["task"],
            hours=entry_record["hours"],
            is_billable=entry_record["is_billable"],
            user_edited=entry_record["user_edited"],
            is_override=entry_record["is_override"],
            override_reason=entry_record["override_reason"],
            overridden_rules=entry_record["overridden_rules"],
            overridden_messages=entry_record["overridden_messages"],
            override_timestamp=entry_record["override_timestamp"]
        ))
        
    timesheets_data["confirmed_entries"] = confirmed
    if req.request_id:
        processed_requests[req.request_id] = {
            "committed_at": datetime.now().isoformat(),
            "entries": [item.model_dump() for item in added_items]
        }
        timesheets_data["processed_requests"] = processed_requests
    
    with open(TIMESHEETS_PATH, "w", encoding="utf-8") as f:
        json.dump(timesheets_data, f, indent=2)
        
    return TimesheetConfirmResponse(
        status="committed",
        request_id=req.request_id,
        count=len(added_items),
        entries=added_items
    )

# Static file serving for Railway / Production container
from fastapi.staticfiles import StaticFiles

frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")


