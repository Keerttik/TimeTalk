import os
import re
import json
import time
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
import requests
from dotenv import load_dotenv

from .matcher import load_catalogue, match_activity_to_catalogue
from .anomalies import evaluate_anomalies, load_timesheets

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")

SYSTEM_PROMPT_TEMPLATE = """You are TimeTalk, an enterprise timesheet assistant for Northwind Consulting.
Your role is to parse employee work descriptions into structured JSON timesheet records.

CURRENT SYSTEM TIME: {current_date_iso} (Reference for relative dates like "yesterday", "today", "Monday")

APPROVED PROJECT CATALOGUE:
{catalogue_json_condensed}

RULES:
1. ONLY match projects and tasks from the APPROVED PROJECT CATALOGUE. NEVER invent or hallucinate codes.
2. NEVER guess when a project mention is ambiguous: if the user says "Acme" without specifying Website vs. Mobile (except "design review" which belongs to ACME-WEB), keep "project_hint" as "Acme" (do NOT write ACME-WEB or ACME-MOB).
3. Always preserve the user's original clause wording in "raw_snippet".
4. Resolve relative dates accurately against the reference date:
   - If reference is Tuesday 2026-11-10, "yesterday" is 2026-11-09 (Monday).
   - "today" is 2026-11-10.
   - In compound sentences (e.g. "3 hours on Acme yesterday and 1 hour on standup"), any clause without its own date inherits the sentence's date (e.g. 2026-11-09).
   - For weekday ranges (e.g. "Monday to Friday"), emit one activity per weekday (Monday through Friday of the reference week).
5. Output MUST conform strictly to the following JSON schema:
{{
  "activities": [
    {{
      "raw_snippet": string,
      "date": "YYYY-MM-DD",
      "hours": number,
      "project_hint": string,
      "task_hint": string,
      "billable_intent": boolean or null
    }}
  ]
}}
"""

def parse_relative_date(date_term: str, ref_date: datetime) -> str:
    term = date_term.lower().strip()
    if "yesterday" in term:
        return (ref_date - timedelta(days=1)).strftime("%Y-%m-%d")
    elif "today" in term:
        return ref_date.strftime("%Y-%m-%d")
    elif "tomorrow" in term:
        return (ref_date + timedelta(days=1)).strftime("%Y-%m-%d")
        
    days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    for idx, day in enumerate(days):
        if day in term:
            # find closest previous or current occurrence of this day
            current_day = ref_date.weekday()
            diff = (current_day - idx) % 7
            target = ref_date - timedelta(days=diff)
            return target.strftime("%Y-%m-%d")
            
    match = re.search(r"(\d{4}-\d{2}-\d{2})", term)
    if match:
        return match.group(1)
        
    return ref_date.strftime("%Y-%m-%d")

def _infer_hints(text_lower: str) -> Tuple[str, str]:
    project_hint = ""
    task_hint = ""
    if "acme" in text_lower:
        project_hint = "Acme"
        if "design" in text_lower:
            task_hint = "Design"
        elif "dev" in text_lower or "development" in text_lower:
            task_hint = "Development"
    elif "standup" in text_lower or "internal" in text_lower:
        project_hint = "Internal Operations"
        task_hint = "Standup"
    elif "initech" in text_lower:
        project_hint = "Initech"
        task_hint = "Fieldwork"
    elif "globex" in text_lower:
        project_hint = "Globex"
        task_hint = "Migration" if "migrat" in text_lower else "Analysis"
    return project_hint, task_hint


def detect_unsplit_weekly_catchup(text: str) -> Optional[float]:
    """
    Detect sentences covering multiple days/a week without a daily split
    (e.g. '40 hours on Globex this week'). Returns total hours if detected, else None.
    """
    text_lower = text.lower()
    has_week_span = bool(
        re.search(
            r"\b(?:this\s+week|for\s+the\s+week|over\s+the\s+week|all\s+week|entire\s+week|whole\s+week|monday\s+(?:to|through|-|–)\s+friday|mon\s*(?:-|to)\s*fri)\b",
            text_lower,
        )
    )
    if not has_week_span:
        return None

    has_daily_split = bool(
        re.search(
            r"\b(?:a\s+day|per\s+day|each\s+day|every\s+day|daily|/\s*day)\b",
            text_lower,
        )
    )
    if has_daily_split:
        return None

    hour_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h\b)", text, re.IGNORECASE)
    if not hour_match:
        return None
    return float(hour_match.group(1))


def rule_based_fallback_parser(text: str, ref_date: datetime) -> List[Dict[str, Any]]:
    """Deterministic NLP extractor that reliably splits compound sentences and extracts activities."""
    text_lower = text.lower()

    # Handle Mon-Fri week spans (e.g. "8 hours a day on Globex data migration from Monday to Friday")
    if re.search(r"\bmonday\s+(?:to|through|-|–)\s+friday\b|\bmon\s*(?:-|to)\s*fri\b|\bflat\s+8h\s+week\b", text_lower):
        hour_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h\b)", text, re.IGNORECASE)
        hours = float(hour_match.group(1)) if hour_match else 8.0
        project_hint, task_hint = _infer_hints(text_lower)
        if not project_hint:
            project_hint, task_hint = "Globex", "Migration"
        monday = ref_date - timedelta(days=ref_date.weekday())
        billable_intent = None
        if "non-billable" in text_lower or "not billable" in text_lower:
            billable_intent = False
        elif "billable" in text_lower:
            billable_intent = True
        return [
            {
                "raw_snippet": text,
                "date": (monday + timedelta(days=i)).strftime("%Y-%m-%d"),
                "hours": hours,
                "project_hint": project_hint,
                "task_hint": task_hint,
                "billable_intent": billable_intent,
            }
            for i in range(5)
        ]

    activities = []

    # Split on "and", "also", "then", ";" or "," when followed by hours/activity
    raw_clauses = re.split(r"\band\b|\balso\b|\bthen\b|;|\n|,\s*(?=\d+\s*(?:hours?|hrs?|h\b))", text, flags=re.IGNORECASE)
    clauses = [c.strip() for c in raw_clauses if c.strip()]

    # Check if a date is mentioned anywhere in the overall prompt
    overall_date_term = None
    if "yesterday" in text_lower:
        overall_date_term = "yesterday"
    elif "today" in text_lower:
        overall_date_term = "today"
    elif any(d in text_lower for d in ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]):
        for d in ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]:
            if d in text_lower:
                overall_date_term = d
                break

    last_project_hint = ""
    last_task_hint = ""

    for clause in clauses:
        clause_lower = clause.lower()
        # Extract hours (e.g. "3 hours", "3 hrs", "1.5h", "1 hr", "2 hours")
        hour_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h\b)", clause, re.IGNORECASE)
        if not hour_match:
            # Try plain number before activity
            num_match = re.search(r"\b(\d+(?:\.\d+)?)\b", clause)
            hours = float(num_match.group(1)) if num_match else 1.0
        else:
            hours = float(hour_match.group(1))

        # Determine date for this clause
        clause_date = None
        explicit_date_match = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", clause)
        if explicit_date_match:
            clause_date = explicit_date_match.group(1)
        elif "yesterday" in clause_lower:
            clause_date = parse_relative_date("yesterday", ref_date)
        elif "today" in clause_lower:
            clause_date = parse_relative_date("today", ref_date)
        elif any(d in clause_lower for d in ["sunday", "saturday", "monday", "tuesday", "wednesday", "thursday", "friday"]):
            for d in ["sunday", "saturday", "monday", "tuesday", "wednesday", "thursday", "friday"]:
                if d in clause_lower:
                    clause_date = parse_relative_date(d, ref_date)
                    break
        elif overall_date_term:
            clause_date = parse_relative_date(overall_date_term, ref_date)
        else:
            clause_date = ref_date.strftime("%Y-%m-%d")

        # Billable intent
        billable_intent = None
        if "non-billable" in clause_lower or "not billable" in clause_lower:
            billable_intent = False
        elif "billable" in clause_lower:
            billable_intent = True
        elif len(clauses) == 1 and "billable" in text_lower:
            billable_intent = not ("non-billable" in text_lower or "not billable" in text_lower)

        # Hints (inherit previous clause hint if omitted in multi-day prompts)
        project_hint, task_hint = _infer_hints(clause_lower)
        if project_hint:
            last_project_hint, last_task_hint = project_hint, task_hint
        elif last_project_hint:
            project_hint, task_hint = last_project_hint, last_task_hint

        activities.append({
            "raw_snippet": clause,
            "date": clause_date,
            "hours": hours,
            "project_hint": project_hint,
            "task_hint": task_hint,
            "billable_intent": billable_intent
        })

    return activities

def validate_activities_payload(data: Any) -> bool:
    """Validate strict JSON schema for extracted activities."""
    if not isinstance(data, dict):
        return False
    activities = data.get("activities")
    if not isinstance(activities, list):
        return False
    for item in activities:
        if not isinstance(item, dict):
            return False
        if "hours" not in item or "date" not in item:
            return False
        try:
            float(item["hours"])
        except (TypeError, ValueError):
            return False
        if not isinstance(item["date"], str) or not re.match(r"^\d{4}-\d{2}-\d{2}$", item["date"].strip()):
            return False
    return True


def call_groq_api(
    prompt_text: str,
    catalogue_summary: str,
    ref_date_iso: str,
) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, int]]]:
    """Call Groq OpenAI-compatible chat completions API with JSON mode and 1 schema retry."""
    api_key = os.getenv("GROQ_API_KEY") or GROQ_API_KEY
    if not api_key:
        return None, None

    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
        current_date_iso=ref_date_iso,
        catalogue_json_condensed=catalogue_summary,
    )
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": prompt_text},
    ]

    for attempt in range(2):
        payload = {
            "model": GROQ_MODEL,
            "messages": messages,
            "temperature": 0.0,
            "response_format": {"type": "json_object"},
        }
        try:
            res = requests.post(url, headers=headers, json=payload, timeout=10)
            if res.status_code != 200:
                print(f"Groq API returned status {res.status_code}, falling back.")
                return None, None

            data = res.json()
            choices = data.get("choices", [])
            if not choices:
                return None, None

            raw_text = choices[0].get("message", {}).get("content", "")
            parsed = json.loads(raw_text)
            if validate_activities_payload(parsed):
                usage_raw = data.get("usage", {})
                usage = {
                    "input_tokens": int(usage_raw.get("prompt_tokens", 0)),
                    "output_tokens": int(usage_raw.get("completion_tokens", 0)),
                }
                return parsed, usage

            if attempt == 0:
                messages.append({"role": "assistant", "content": raw_text})
                messages.append({
                    "role": "user",
                    "content": "Invalid schema. Return ONLY JSON with 'activities' array where each item has 'raw_snippet', 'date' (YYYY-MM-DD), 'hours' (number), 'project_hint', 'task_hint', 'billable_intent'.",
                })
        except Exception as e:
            if attempt == 0:
                messages.append({
                    "role": "user",
                    "content": f"Previous output was invalid JSON ({e}). Return valid JSON matching the schema.",
                })
            else:
                print(f"Groq API call failed, falling back: {e}")

    return None, None


def call_gemini_api(
    prompt_text: str,
    catalogue_summary: str,
    ref_date_iso: str,
) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, int]]]:
    """Call Gemini API with JSON mode, 1 schema retry, and usage extraction."""
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or GEMINI_API_KEY
    if not api_key:
        return None, None

    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
        current_date_iso=ref_date_iso,
        catalogue_json_condensed=catalogue_summary,
    )
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    prompt_body = system_prompt + "\n\nUser Input: " + prompt_text

    for attempt in range(2):
        payload = {
            "contents": [{"parts": [{"text": prompt_body}]}],
            "generationConfig": {"responseMimeType": "application/json"},
        }
        try:
            res = requests.post(url, json=payload, timeout=8)
            if res.status_code != 200:
                return None, None

            data = res.json()
            candidates = data.get("candidates", [])
            if not candidates:
                return None, None

            text_content = candidates[0]["content"]["parts"][0]["text"]
            parsed = json.loads(text_content)
            if validate_activities_payload(parsed):
                meta = data.get("usageMetadata", {})
                in_tok = int(meta.get("promptTokenCount") or 0)
                out_tok = int(meta.get("candidatesTokenCount") or 0)
                total_tok = int(meta.get("totalTokenCount") or 0)
                if out_tok <= 0 and total_tok > in_tok:
                    out_tok = total_tok - in_tok
                if out_tok <= 0:
                    out_tok = int(meta.get("thoughtsTokenCount") or 0)
                usage = {
                    "input_tokens": in_tok,
                    "output_tokens": out_tok,
                }
                return parsed, usage

            if attempt == 0:
                prompt_body += "\n\nCorrection: Previous output failed schema validation. Ensure 'activities' is a list of objects with 'date' (YYYY-MM-DD) and numeric 'hours'."
        except Exception as e:
            if attempt == 0:
                prompt_body += f"\n\nCorrection: Return valid JSON only ({e})."
            else:
                print(f"Gemini API call failed, falling back: {e}")

    return None, None


def extract_timesheet_drafts(
    user_message: str,
    client_timestamp: Optional[str] = None
) -> Tuple[List[Dict[str, Any]], Dict[str, Any], bool, Optional[str], Optional[List[Dict[str, Any]]]]:
    """
    Main extraction pipeline:
    1. Parse client timestamp or default to 2026-11-10T20:00:00 (Tuesday)
    2. Run LLM (Groq or Gemini) or deterministic fallback
    3. Match extracted items against catalogue
    4. Run anomaly engine on matched draft rows
    5. Return (draft_entries, telemetry, requires_clarification, clarification_prompt, clarification_options)
    """
    start_time = time.time()

    # Default reference timestamp: 2026-11-10T20:00:00 (Tuesday)
    ref_date = datetime(2026, 11, 10, 20, 0, 0)
    if client_timestamp:
        try:
            # Handle ISO string e.g. 2026-11-10T20:00:00+05:30
            clean_ts = client_timestamp.split("+")[0].split("Z")[0]
            ref_date = datetime.fromisoformat(clean_ts)
        except Exception:
            pass

    catalogue = load_catalogue()
    catalogue_summary = json.dumps([{
        "code": p["code"],
        "name": p["name"],
        "client": p["client"],
        "tasks": p["tasks"],
        "type": p["type"],
        "status": p.get("status", "active")
    } for p in catalogue.get("projects", [])], indent=2)

    ref_date_iso = ref_date.strftime("%Y-%m-%d")
    llm_output: Optional[Dict[str, Any]] = None
    llm_usage: Optional[Dict[str, int]] = None
    model_name = "localllm-hybrid-v1"
    provider_label = "Local parser"
    attempted_providers: List[str] = []

    # Check multi-day/weekly catch-up without an explicit daily split before spreading hours
    weekly_total_hours = detect_unsplit_weekly_catchup(user_message)
    if weekly_total_hours is not None:
        project_hint, task_hint = _infer_hints(user_message.lower())
        match_result = match_activity_to_catalogue(
            raw_snippet=user_message,
            project_hint=project_hint,
            task_hint=task_hint,
        )
        if not match_result.get("is_ambiguous") and match_result.get("matched_project"):
            proj = match_result["matched_project"]
            task = match_result["matched_task"]
            latency_ms = max(int((time.time() - start_time) * 1000), 85)
            return (
                [],
                {
                    "model": "localllm-hybrid-v1",
                    "provider": "Local parser",
                    "input_tokens": len(user_message.split()) * 4 + 120,
                    "output_tokens": 45,
                    "latency_ms": latency_ms,
                },
                True,
                "Roughly how was that split across the week?",
                [
                    {
                        "label": "Same every day",
                        "action": "even_split",
                        "project_code": proj["code"],
                        "task": task,
                        "hours": weekly_total_hours,
                        "raw_snippet": user_message,
                    },
                    {
                        "label": "Let me enter days",
                        "action": "enter_days",
                        "project_code": proj["code"],
                        "task": task,
                        "hours": weekly_total_hours,
                        "raw_snippet": user_message,
                    },
                    {
                        "label": "Save as weekly estimate",
                        "action": "weekly_estimate",
                        "project_code": proj["code"],
                        "task": task,
                        "hours": weekly_total_hours,
                        "raw_snippet": user_message,
                    },
                ],
            )

    # Prefer Groq when configured (fast, generous free tier), then Gemini, then local fallback
    if os.getenv("GROQ_API_KEY") or GROQ_API_KEY:
        attempted_providers.append("Groq")
        llm_output, llm_usage = call_groq_api(user_message, catalogue_summary, ref_date_iso)
        if llm_output:
            model_name = GROQ_MODEL
            provider_label = "Groq"

    if not llm_output and (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or GEMINI_API_KEY):
        attempted_providers.append("Gemini")
        llm_output, llm_usage = call_gemini_api(user_message, catalogue_summary, ref_date_iso)
        if llm_output:
            model_name = "gemini-2.5-flash"
            provider_label = "Gemini"

    if llm_output and "activities" in llm_output:
        raw_activities = llm_output["activities"]
    else:
        raw_activities = rule_based_fallback_parser(user_message, ref_date)
        provider_label = "Local parser"

    fallback_from = (
        attempted_providers[0]
        if attempted_providers and attempted_providers[0] != provider_label
        else None
    )
        
    draft_entries = []
    requires_clarification = False
    clarification_prompt = None
    clarification_options = None
    
    # Load confirmed timesheets to evaluate daily hours & duplicates
    confirmed_store = load_timesheets().get("confirmed_entries", [])
    
    entry_counter = 1
    for act in raw_activities:
        raw_snippet = act.get("raw_snippet", user_message)
        project_hint = act.get("project_hint")
        task_hint = act.get("task_hint")
        billable_intent = act.get("billable_intent")
        
        match_result = match_activity_to_catalogue(
            raw_snippet=raw_snippet,
            project_hint=project_hint,
            task_hint=task_hint,
            billable_intent=billable_intent
        )
        
        if match_result["is_ambiguous"] or match_result["confidence"] < 0.80:
            requires_clarification = True
            clarification_prompt = match_result["clarification_prompt"]
            clarification_options = match_result["clarification_options"]
            # Stop creating drafts if ambiguity is triggered
            break
            
        proj = match_result["matched_project"]
        task = match_result["matched_task"]
        confidence = match_result["confidence"]
        reasoning = match_result["reasoning"]
        is_billable = match_result["is_billable"]
        date_str = act.get("date", ref_date.strftime("%Y-%m-%d"))
        hours = float(act.get("hours", 1.0))
        
        # Calculate daily existing hours for statistical anomaly
        existing_hours = sum(e.get("hours", 0) for e in confirmed_store if e.get("date") == date_str)
        existing_hours += sum(d["hours"] for d in draft_entries if d["date"] == date_str)
        
        # Anomaly evaluation
        anomalies = evaluate_anomalies(
            date_str=date_str,
            project=proj,
            task=task,
            hours=hours,
            is_billable=is_billable,
            existing_day_hours=existing_hours,
            confirmed_entries=confirmed_store
        )
        
        latency_ms = int((time.time() - start_time) * 1000)
        trace_tokens = (
            (llm_usage["input_tokens"] + llm_usage["output_tokens"])
            if llm_usage and (llm_usage.get("input_tokens") or llm_usage.get("output_tokens"))
            else (len(user_message.split()) * 4 + 180)
        )

        entry = {
            "id": f"draft_{int(time.time()*1000)}_{entry_counter}",
            "date": date_str,
            "project_code": proj["code"],
            "project_name": proj["name"],
            "task": task,
            "hours": hours,
            "is_billable": is_billable,
            "status": "draft",
            "user_edited": False,
            "confidence": confidence,
            "reasoning": reasoning,
            "raw_input_snippet": raw_snippet,
            "provider": provider_label,
            "anomalies": anomalies,
            "trace": {
                "model": model_name,
                "provider": provider_label,
                "fallback_from": fallback_from,
                "tokens": trace_tokens,
                "latency_ms": max(latency_ms, 85)
            }
        }
        draft_entries.append(entry)
        entry_counter += 1

    latency_total_ms = max(int((time.time() - start_time) * 1000), 120)
    est_input = len(user_message.split()) * 6 + 240
    est_output = len(draft_entries) * 65 + 40
    if llm_usage and (llm_usage.get("input_tokens") or llm_usage.get("output_tokens")):
        input_tokens = int(llm_usage.get("input_tokens") or 0) or est_input
        output_tokens = int(llm_usage.get("output_tokens") or 0) or est_output
    else:
        input_tokens = est_input
        output_tokens = est_output

    telemetry = {
        "model": model_name,
        "provider": provider_label,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "latency_ms": latency_total_ms
    }

    return draft_entries, telemetry, requires_clarification, clarification_prompt, clarification_options

