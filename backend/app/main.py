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
    TimesheetConfirmRequest,
    TimesheetConfirmResponse,
    TimesheetConfirmItem
)
from .engine.extractor import extract_timesheet_drafts
from .engine.matcher import load_catalogue
from .engine.anomalies import load_baseline, load_timesheets, TIMESHEETS_PATH

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

@app.post("/api/timesheets/reset")
def reset_timesheets():
    initial_data = {
        "user_id": "u_priya",
        "current_week_start": "2026-11-09",
        "confirmed_entries": []
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

@app.post("/api/timesheets/confirm", response_model=TimesheetConfirmResponse)
def confirm_timesheets(req: TimesheetConfirmRequest):
    # Commits confirmed entries to storage (FR7 invariant)
    timesheets_data = load_timesheets()
    confirmed = timesheets_data.get("confirmed_entries", [])
    
    catalogue = load_catalogue()
    projects_map = {p["code"]: p["name"] for p in catalogue.get("projects", [])}
    
    added_items = []
    for item in req.entries:
        p_name = item.project_name or projects_map.get(item.project_code, item.project_code)
        entry_record = {
            "id": item.id or f"entry_{int(datetime.now().timestamp()*1000)}",
            "date": item.date,
            "project_code": item.project_code,
            "project_name": p_name,
            "task": item.task,
            "hours": float(item.hours),
            "is_billable": item.is_billable,
            "user_edited": item.user_edited,
            "status": "confirmed",
            "confirmed_at": datetime.now().isoformat()
        }
        confirmed.append(entry_record)
        added_items.append(TimesheetConfirmItem(
            id=entry_record["id"],
            date=entry_record["date"],
            project_code=entry_record["project_code"],
            project_name=entry_record["project_name"],
            task=entry_record["task"],
            hours=entry_record["hours"],
            is_billable=entry_record["is_billable"],
            user_edited=entry_record["user_edited"]
        ))
        
    timesheets_data["confirmed_entries"] = confirmed
    
    with open(TIMESHEETS_PATH, "w", encoding="utf-8") as f:
        json.dump(timesheets_data, f, indent=2)
        
    return TimesheetConfirmResponse(
        status="committed",
        count=len(added_items),
        entries=added_items
    )
