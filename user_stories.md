# TimeTalk: User Stories & Acceptance Criteria

**Product:** TimeTalk (Conversational Timesheet Copilot)  
**Author:** Keerttik  
**Date:** November 10, 2026  
**Document Type:** Functional User Stories & Acceptance Criteria (Gherkin Syntax)  
**Version:** 1.0  

---

## Overview & Persona Key

- **Priya (Consultant / End User):** Wants zero friction, fast entry, and clear confirmation before anything commits.
- **Arjun (Project Manager):** Wants zero misbilled hours, budget overrun alerts, and fewer invoice disputes.
- **Finance Lead (Billing & Accounting):** Wants clean billable data, zero billing on closed projects, and quick month-end close.
- **AI Program Owner (Executive Sponsor):** Wants verifiable ROI, latency/token transparency, and predictable costs.

---

## Epic 1: Conversational Time Capture & Entity Extraction

### US-1.1: Free-Text Natural Language Input (FR1)
**As a** consultant (Priya),  
**I want to** type one or more work activities in plain, unstructured English (including relative dates),  
**So that** I don't have to manually browse calendars, calculate durations, and hunt down project IDs.

#### Acceptance Criteria (Gherkin)
- **Scenario 1: Single activity with relative date**
  - **Given** today is Tuesday, Nov 10, 2026
  - **When** Priya enters: *"Spent 3 hours on the Acme design review yesterday"*
  - **Then** the LLM extracts:
    - Date: `2026-11-09` (Monday)
    - Hours: `3.0`
    - Activity Description: `"Acme design review"`
    - Project Hint: `"Acme"`
    - Task Hint: `"Design"`

- **Scenario 2: Multi-activity compound sentence**
  - **Given** today is Tuesday, Nov 10, 2026
  - **When** Priya enters: *"Spent 3 hours on the Acme design review yesterday and 1 hour on internal standup."*
  - **Then** the system extracts 2 distinct structured activity objects.

- **Scenario 3: Date resolution for week days**
  - **Given** today is Wednesday, Nov 11, 2026
  - **When** Priya enters: *"2 hours on Globex data analysis on Monday"*
  - **Then** the date resolves to `2026-11-09`.

---

### US-1.2: Strict Catalogue Grounding & Code Integrity (FR2, FR3)
**As a** Project Manager (Arjun),  
**I want** the copilot to match tasks strictly against our approved client and project catalogue and never invent a project code,  
**So that** timesheets never contain non-existent or hallucinated accounting codes.

#### Acceptance Criteria (Gherkin)
- **Scenario 1: High confidence exact match**
  - **Given** the mock catalogue contains `ACME-WEB` with tasks `["Design", "Development", "QA"]`
  - **When** the extracted description is `"Acme design review"`
  - **Then** the system assigns Project: `ACME-WEB`, Task: `Design`, Billable: `true` with Confidence $\ge 80\%$.

- **Scenario 2: Rejection of hallucinated codes**
  - **When** the LLM encounters an unknown client like *"Cyberdyne Systems migration"*
  - **Then** the system rejects code generation, marks confidence as $0\%$, and does not assign a synthetic code.

---

## Epic 2: Ambiguity Resolution & Guardrails

### US-2.1: Proactive Clarification on Low Confidence / Ambiguity (FR4)
**As a** consultant (Priya),  
**I want** the copilot to ask me a quick clarifying question when multiple projects match,  
**So that** it never guesses or logs hours to the wrong client.

#### Acceptance Criteria (Gherkin)
- **Scenario 1: Multiple matching projects (e.g., Website vs. Mobile)**
  - **Given** the catalogue has both `ACME-WEB` and `ACME-MOB`
  - **When** Priya enters: *"2 hours on Acme development"*
  - **Then** the matcher determines confidence is $< 80\%$ due to ambiguity between `ACME-WEB` and `ACME-MOB`
  - **And** the copilot does NOT create a draft row immediately
  - **And** the copilot replies in chat: *"Did you work on Acme Website (ACME-WEB) or Acme Mobile (ACME-MOB)?"* with clickable quick-select pills.

- **Scenario 2: User resolution of ambiguity**
  - **When** Priya clicks the `"Acme Mobile (ACME-MOB)"` pill
  - **Then** the system generates the draft row assigned to `ACME-MOB / Development` with confidence updated to $100\%$.

---

## Epic 3: Timesheet Review & Human-in-the-Loop Safety

### US-3.1: Weekly Grid Display with Draft vs. Confirmed States (FR5, FR7)
**As a** consultant (Priya),  
**I want** to see my AI-extracted entries as editable drafts in my weekly timesheet grid before submitting,  
**So that** I maintain full control and nothing is permanently recorded without my approval.

#### Acceptance Criteria (Gherkin)
- **Scenario 1: Visual separation of draft vs. confirmed entries**
  - **Given** extracted activities have been generated
  - **When** the weekly timesheet renders
  - **Then** draft entries are styled with an amber/blue dashed border and labeled `"Draft (AI Generated)"`
  - **And** draft rows feature inline editable fields for date, project dropdown, task dropdown, hours, and billable toggle.

- **Scenario 2: Absolute Human-in-the-Loop enforcement (FR7)**
  - **Given** draft rows are visible in the UI
  - **When** Priya has not yet clicked "Confirm"
  - **Then** no records are written to persistent storage (`timesheets.json`)
  - **And** only upon clicking `"Confirm All"` or row `"Confirm"` are drafts committed to active timesheet state.

---

## Epic 4: Anomaly Detection & Leakage Prevention (Traditional ML / Rules)

### US-4.1: Flagging Over-Budget Tasks (FR6)
**As an** account lead,  
**I want** to be alerted when a draft entry pushes a project past $90\%$ of its allocated budget,  
**So that** we prevent unapproved budget overruns.

#### Acceptance Criteria (Gherkin)
- **Given** project `ACME-WEB` is currently at $88\%$ budget used ($176$ of $200$ hours)
- **When** Priya logs $12$ hours on `ACME-WEB`
- **Then** the new cumulative burn reaches $94\%$ ($188$ of $200$ hours)
- **And** an inline warning tag appears on the draft row: *"Warning: ACME-WEB is at 94% of budget."*

---

### US-4.2: Closed Project Leakage Guard (FR6)
**As a** Finance Billing Lead,  
**I want** the system to block or flag billable time logged against closed projects,  
**So that** we eliminate invoice disputes and write-offs before billing cycles.

#### Acceptance Criteria (Gherkin)
- **Given** project `INITECH-AUD` was closed on `2026-10-31`
- **When** Priya submits: *"4 hours on Initech fieldwork today, billable"*
- **Then** the anomaly engine flags the entry with a Red violation badge:
  `"This project closed on 31 Oct. Time cannot be billed."`
- **And** provides a 1-click action to switch to an active project or cancel the draft.

---

### US-4.3: Statistical Daily Spike Detection (Z-Score) (FR6)
**As a** Project Manager (Arjun),  
**I want** to detect abnormal daily hours exceeding 2 standard deviations from the consultant's 8-week baseline,  
**So that** accidental typos (e.g. typing 11 instead of 1.1) or burnout risk are caught immediately.

#### Acceptance Criteria (Gherkin)
- **Given** Priya's 8-week baseline is $\mu = 8.2\text{ hrs}$, $\sigma = 1.1\text{ hrs}$ (threshold = $10.4\text{ hrs}$)
- **When** Priya logs entries that bring today's total to $11.0\text{ hours}$
- **Then** a warning alert displays: *"11.0 hrs is well above your usual 8.2 hrs. Correct?"*

---

### US-4.4: Weekend, Holiday, and Duplicate Checks (FR6)
- **Weekend/Holiday Check:** Entry dated on Saturday/Sunday or mock holiday prompts: *"This is a [Sunday/Holiday]. Still billable?"*
- **Billable on Internal:** Entry marking `INT-OPS` as billable triggers: *"Internal projects aren't billable. Switch to non-billable?"*
- **Duplicate Check:** Entry matching existing date, project, and task triggers: *"You already logged 3 hrs here today."*

---

## Epic 5: Observability & ROI Justification

### US-5.1: Explainable AI "Why?" Trace (FR9)
**As a** consultant or manager,  
**I want** to click "Why?" on any draft or confirmed row,  
**So that** I can inspect the model's extraction rationale, token count, latency, and confidence score.

#### Acceptance Criteria (Gherkin)
- **When** the user clicks the `"Why?"` button on a row
- **Then** a slide-over panel reveals:
  - Input text snippet
  - Matched catalogue code and confidence percentage
  - Anomaly rules evaluated (Passed / Triggered)
  - Execution metadata: model used, response latency (ms), input/output tokens.

---

### US-5.2: Real-Time AI Value Panel (FR8)
**As an** AI Program Owner,  
**I want** a live telemetry widget beside the chat tracking tokens, model cost, time saved, and ROI,  
**So that** I can defend the AI investment to executive leadership with empirical data.

#### Acceptance Criteria (Gherkin)
- **Given** a chat conversation has completed with $N$ confirmed entries
- **When** the AI Value Panel renders
- **Then** it updates live with:
  1. **Tokens:** Total tokens consumed.
  2. **AI Cost:** In Indian Rupees / Paise (e.g. ₹0.12).
  3. **Time Saved:** $(2 \text{ min baseline} \times \text{confirmed entries}) - \text{chat duration}$.
  4. **Value of Time Saved:** $\text{Time Saved} \times ₹1,500\text{/hr}$.
  5. **Billing Leakage Caught:** Hours flagged on closed/budgeted tasks $\times$ bill rate.
  6. **Live ROI:** $\frac{\text{Value Saved} + \text{Leakage Caught}}{\text{AI Cost}} > 10\times$.
- **And** includes an expandable **"Assumptions"** drawer explaining the baseline defaults.

