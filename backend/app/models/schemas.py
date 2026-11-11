from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field

class AnomalyWarning(BaseModel):
    rule_id: str
    severity: str  # "warning" | "error"
    message: str
    suggested_fix: Optional[Dict[str, Any]] = None

class Telemetry(BaseModel):
    model: str
    input_tokens: int
    output_tokens: int
    latency_ms: int

class DraftTimesheetEntry(BaseModel):
    id: str
    date: str  # YYYY-MM-DD
    project_code: str
    project_name: str
    task: str
    hours: float
    is_billable: bool
    status: str = "draft"
    user_edited: bool = False
    confidence: float
    reasoning: str
    raw_input_snippet: str
    anomalies: List[AnomalyWarning] = []
    trace: Optional[Dict[str, Any]] = None

class ClarificationOption(BaseModel):
    label: str
    project_code: str
    task: Optional[str] = None

class ClarificationResolveRequest(BaseModel):
    conversation_id: str
    user_id: str = "u_priya"
    project_code: str
    task: Optional[str] = "Development"
    hours: float = 2.0
    date: Optional[str] = "2026-11-10"
    is_billable: Optional[bool] = None
    raw_snippet: Optional[str] = None

class ChatParseRequest(BaseModel):
    conversation_id: str
    user_id: str = "u_priya"
    message: str
    client_timestamp: Optional[str] = "2026-11-10T20:00:00+05:30"

class ChatParseResponse(BaseModel):
    conversation_id: str
    status: str = "success"
    requires_clarification: bool = False
    clarification_prompt: Optional[str] = None
    clarification_options: Optional[List[ClarificationOption]] = None
    assistant_message: Optional[str] = None
    draft_entries: List[DraftTimesheetEntry] = []
    telemetry: Telemetry

class TimesheetConfirmItem(BaseModel):
    id: Optional[str] = None
    date: str
    project_code: str
    project_name: Optional[str] = None
    task: str
    hours: float
    is_billable: bool
    user_edited: bool = False
    is_override: bool = False
    override_reason: Optional[str] = None
    overridden_rules: Optional[List[str]] = None
    overridden_messages: Optional[List[str]] = None
    override_timestamp: Optional[str] = None

class TimesheetConfirmRequest(BaseModel):
    user_id: str = "u_priya"
    entries: List[TimesheetConfirmItem]

class TimesheetConfirmResponse(BaseModel):
    status: str = "committed"
    count: int
    entries: List[TimesheetConfirmItem]

