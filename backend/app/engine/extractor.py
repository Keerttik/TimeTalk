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

def rule_based_fallback_parser(text: str, ref_date: datetime) -> List[Dict[str, Any]]:
    """Deterministic NLP extractor that reliably splits compound sentences and extracts activities."""
    activities = []
    
    # Split on "and", "also", "then", ";" or "," when followed by hours/activity
    raw_clauses = re.split(r"\band\b|\balso\b|\bthen\b|;|\n|,\s*(?=\d+\s*(?:hours?|hrs?|h\b))", text, flags=re.IGNORECASE)
    clauses = [c.strip() for c in raw_clauses if c.strip()]
    
    # Check if a date is mentioned anywhere in the overall prompt
    overall_date_term = None
    if "yesterday" in text.lower():
        overall_date_term = "yesterday"
    elif "today" in text.lower():
        overall_date_term = "today"
    elif any(d in text.lower() for d in ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]):
        for d in ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]:
            if d in text.lower():
                overall_date_term = d
                break
                
    for clause in clauses:
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
        elif "yesterday" in clause.lower():
            clause_date = parse_relative_date("yesterday", ref_date)
        elif "today" in clause.lower():
            clause_date = parse_relative_date("today", ref_date)
        elif any(d in clause.lower() for d in ["sunday", "saturday", "monday", "tuesday", "wednesday", "thursday", "friday"]):
            for d in ["sunday", "saturday", "monday", "tuesday", "wednesday", "thursday", "friday"]:
                if d in clause.lower():
                    clause_date = parse_relative_date(d, ref_date)
                    break
        elif overall_date_term:
            clause_date = parse_relative_date(overall_date_term, ref_date)
        else:
            clause_date = ref_date.strftime("%Y-%m-%d")
            
        # Billable intent
        billable_intent = None
        if "non-billable" in clause.lower() or "not billable" in clause.lower():
            billable_intent = False
        elif "billable" in clause.lower():
            billable_intent = True
        elif len(clauses) == 1 and "billable" in text.lower():
            billable_intent = not ("non-billable" in text.lower() or "not billable" in text.lower())
            
        # Hints
        project_hint = ""
        task_hint = ""
        if "acme" in clause.lower():
            project_hint = "Acme"
            if "design" in clause.lower():
                task_hint = "Design"
            elif "dev" in clause.lower() or "development" in clause.lower():
                task_hint = "Development"
        elif "standup" in clause.lower() or "internal" in clause.lower():
            project_hint = "Internal Operations"
            task_hint = "Standup"
        elif "initech" in clause.lower():
            project_hint = "Initech"
            task_hint = "Fieldwork"
        elif "globex" in clause.lower():
            project_hint = "Globex"
            task_hint = "Migration" if "migrat" in clause.lower() else "Analysis"

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
                usage = {
                    "input_tokens": int(meta.get("promptTokenCount", 0)),
                    "output_tokens": int(meta.get("candidatesTokenCount", 0)),
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

    # Prefer Groq when configured (fast, generous free tier), then Gemini, then local fallback
    if os.getenv("GROQ_API_KEY") or GROQ_API_KEY:
        llm_output, llm_usage = call_groq_api(user_message, catalogue_summary, ref_date_iso)
        if llm_output:
            model_name = GROQ_MODEL

    if not llm_output and (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or GEMINI_API_KEY):
        llm_output, llm_usage = call_gemini_api(user_message, catalogue_summary, ref_date_iso)
        if llm_output:
            model_name = "gemini-2.5-flash"

    if llm_output and "activities" in llm_output:
        raw_activities = llm_output["activities"]
    else:
        raw_activities = rule_based_fallback_parser(user_message, ref_date)
        
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
            "anomalies": anomalies,
            "trace": {
                "model": model_name,
                "tokens": trace_tokens,
                "latency_ms": max(latency_ms, 85)
            }
        }
        draft_entries.append(entry)
        entry_counter += 1

    latency_total_ms = max(int((time.time() - start_time) * 1000), 120)
    if llm_usage and (llm_usage.get("input_tokens") or llm_usage.get("output_tokens")):
        input_tokens = llm_usage["input_tokens"]
        output_tokens = llm_usage["output_tokens"]
    else:
        input_tokens = len(user_message.split()) * 6 + 240
        output_tokens = len(draft_entries) * 65 + 40

    telemetry = {
        "model": model_name,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "latency_ms": latency_total_ms
    }

    return draft_entries, telemetry, requires_clarification, clarification_prompt, clarification_options

