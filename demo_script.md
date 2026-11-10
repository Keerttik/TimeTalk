# TimeTalk: 90-Second Demo Script & Product Walkthrough

**Product:** TimeTalk — Conversational Timesheet Copilot  
**Author:** Keerttik  
**Date:** November 10, 2026  
**Document Type:** Executive Demo Script, Screenplay & Loom Guide  
**Target Duration:** 90 Seconds  
**Audience:** Enterprise Leadership, Product Management Evaluators, AI Program Owners  

---

## 1. Demo Objectives & Elevator Pitch

- **The Hook:** Timesheets are a dreaded chore that leaks millions in unbilled hours and invoice disputes. Adding a naive chatbot only introduces hallucinations and distrust.
- **The Solution:** TimeTalk captures time in under 30 seconds via natural language, grounds everything in an approved catalogue, enforces deterministic anomaly rules, and transparently proves its ROI live.
- **The 5 Pillars Demonstrated:**
  1. **Speed:** 2 entries parsed and staged in < 5 seconds.
  2. **Zero-Hallucination Safety:** Clarification triggered instead of guessing.
  3. **Revenue Protection:** Catching billing leakage on closed projects.
  4. **Observability:** Inspectable "Why?" reasoning trace.
  5. **Verifiable Value:** Live AI Value & ROI panel (>10x return).

---

## 2. Chronological Demo Timeline (0:00 – 1:30)

| Timestamp | Phase | On-Screen Action | Spoken Voiceover Narration | Core Message |
| :---: | :--- | :--- | :--- | :--- |
| **0:00 - 0:15** | **The Hook** | Show split view: Traditional dropdown form vs. TimeTalk clean interface with empty draft grid. | *"In consulting firms, every hour feeds billing and payroll—yet employees hate timesheets. They fill them late, from memory, clicking through dozens of dropdowns. This dirty data causes unbilled hours and invoice disputes. Meet TimeTalk, an AI copilot built for speed, trust, and proven ROI."* | The problem is expensive and universal. |
| **0:15 - 0:32** | **Step 1: Speed Test** | Type or click sample chip: `Spent 3 hours on the Acme design review yesterday and 1 hour on standup.` | *"Watch how fast Priya logs her Monday. She types one natural sentence. Instantly, TimeTalk resolves 'yesterday' to Monday, splits the compound sentence, matches Acme Website Design as billable, and assigns Internal Standup as non-billable. That took 3 seconds instead of 4 minutes."* | Speed & multi-activity extraction. |
| **0:32 - 0:48** | **Step 2: No Guessing** | Type: `2 hours on Acme development.` | *"Now watch what happens when an entry is ambiguous. We have two Acme projects: Website and Mobile. A naive bot would guess. TimeTalk never guesses. Because confidence is below 80%, it stops and asks Priya: 'Website or Mobile?' She clicks Mobile, and the draft is safely mapped."* | Guardrails & ambiguity resolution. |
| **0:48 - 1:05** | **Step 3: Revenue Protection** | Type: `4 hours on Initech fieldwork today, billable.` | *"Here is where TimeTalk protects revenue. Priya logs 4 hours to Initech fieldwork. But Initech was closed on October 31st. TimeTalk’s anomaly engine immediately flags an inline warning before she can submit: 'This project closed on 31 Oct.' That's ₹12,000 in disputed invoices saved before it reaches finance."* | Hybrid AI & financial leakage protection. |
| **1:05 - 1:18** | **Step 4: Observability** | Click the **"Why?"** button on the Acme Mobile row. | *"Leaders only trust AI if it can explain itself. Clicking 'Why?' on any row reveals the entire reasoning trace: exact confidence score, catalogue matching rationale, and token latency. And notice: nothing hits the timesheet until Priya clicks 'Confirm All'."* | Human-in-the-loop & explainability. |
| **1:18 - 1:30** | **Step 5: Live ROI & Close** | Zoom into the **Live AI Value Panel** beside the chat. | *"Finally, how do we justify the AI spend? This live AI Value panel calculates cumulative tokens, model cost in paise, time saved, and billing leakage caught. Across this session, TimeTalk delivered an ROI over 14x its cost. That’s TimeTalk: fast for employees, safe for finance, and proven for leadership."* | Concrete business value & ROI. |

---

## 3. Rehearsal Checklist & Seed Prompts

### Quick-Test Prompts (Pre-Loaded in Demo UI)

1. **Prompt 1 (Speed & Multi-Task):**
   ```text
   Spent 3 hours on the Acme design review yesterday and 1 hour on standup.
   ```
   - **Expected Outcome:** 2 draft rows created. Row 1: `ACME-WEB`, `Design`, 3h, Billable. Row 2: `INT-OPS`, `Standup`, 1h, Non-billable.

2. **Prompt 2 (Ambiguity & Clarification):**
   ```text
   2 hours on Acme development.
   ```
   - **Expected Outcome:** Bot stops, asks clarification with chips `[Acme Website (ACME-WEB)]` and `[Acme Mobile (ACME-MOB)]`.

3. **Prompt 3 (Closed Project Anomaly):**
   ```text
   4 hours on Initech fieldwork today, billable.
   ```
   - **Expected Outcome:** Draft row created with prominent red warning: `This project closed on 31 Oct.`

---

## 4. Key Metrics to Highlight During the Walkthrough

- **Logging Time:** Under 30 seconds vs. ~4 minutes baseline.
- **Accuracy:** 100% catalogue grounded, 0 invented codes.
- **Human In The Loop:** 0 entries committed without human "Confirm".
- **Leakage Prevention:** 100% seeded anomalies caught.
- **Real-Time ROI:** Live value-to-cost ratio displayed above $10\times$.

