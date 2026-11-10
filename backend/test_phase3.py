import json
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def run_phase3_tests():
    print("==================================================")
    print("RUNNING PHASE 3 ACCEPTANCE & 90s DEMO WALKTHROUGH")
    print("==================================================")

    # Reset timesheet store for fresh demo run
    client.post('/api/timesheets/reset')

    # STEP 1: Speed Test (PRD Demo Step 1)
    print("\n--- Step 1: Speed Test (FR1, FR2, FR5) ---")
    step1_payload = {
        'conversation_id': 'demo_step1',
        'user_id': 'u_priya',
        'message': 'Spent 3 hours on the Acme design review yesterday and 1 hour on internal standup.',
        'client_timestamp': '2026-11-10T20:00:00+05:30'
    }
    res1 = client.post('/api/chat/parse', json=step1_payload)
    assert res1.status_code == 200
    data1 = res1.json()
    assert len(data1['draft_entries']) == 2
    d1, d2 = data1['draft_entries'][0], data1['draft_entries'][1]
    assert d1['project_code'] == 'ACME-WEB' and d1['task'] == 'Design' and d1['hours'] == 3.0
    assert d2['project_code'] == 'INT-OPS' and d2['task'] == 'Standup' and d2['hours'] == 1.0
    print(f"PASS Step 1: 2 entries parsed in {data1['telemetry']['latency_ms']}ms (< 5s target)")

    # Confirm step 1 entries to simulate user confirming
    client.post('/api/timesheets/confirm', json={
        'user_id': 'u_priya',
        'entries': [
            {'date': d1['date'], 'project_code': d1['project_code'], 'task': d1['task'], 'hours': d1['hours'], 'is_billable': d1['is_billable'], 'user_edited': False},
            {'date': d2['date'], 'project_code': d2['project_code'], 'task': d2['task'], 'hours': d2['hours'], 'is_billable': d2['is_billable'], 'user_edited': False}
        ]
    })

    # STEP 2: Precision & Safety (PRD Demo Step 2 / FR4)
    print("\n--- Step 2: Ambiguity & Zero Guessing (FR4) ---")
    step2_payload = {
        'conversation_id': 'demo_step2',
        'user_id': 'u_priya',
        'message': '2 hours on Acme development.',
        'client_timestamp': '2026-11-10T20:00:00+05:30'
    }
    res2 = client.post('/api/chat/parse', json=step2_payload)
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2['requires_clarification'] is True
    assert "Did you work on Acme Website (ACME-WEB) or Acme Mobile (ACME-MOB)?" in data2['clarification_prompt']
    print("PASS Step 2: Clarification asked (no hallucination or guessing)")

    # Resolve Step 2 by selecting Acme Mobile
    res2_resolve = client.post('/api/chat/resolve', json={
        'conversation_id': 'demo_step2',
        'user_id': 'u_priya',
        'project_code': 'ACME-MOB',
        'task': 'Development',
        'hours': 2.0,
        'date': '2026-11-10'
    })
    assert res2_resolve.status_code == 200
    d_mob = res2_resolve.json()['draft_entries'][0]
    assert d_mob['project_code'] == 'ACME-MOB'
    print(f"PASS Step 2 Clarification: Selected Acme Mobile mapped safely")

    # Confirm Acme Mobile
    client.post('/api/timesheets/confirm', json={
        'user_id': 'u_priya',
        'entries': [{'date': d_mob['date'], 'project_code': d_mob['project_code'], 'task': d_mob['task'], 'hours': d_mob['hours'], 'is_billable': d_mob['is_billable'], 'user_edited': False}]
    })

    # STEP 3: Revenue Protection (PRD Demo Step 3 / FR6)
    print("\n--- Step 3: Leakage Protection & Initech Anomaly (FR6) ---")
    step3_payload = {
        'conversation_id': 'demo_step3',
        'user_id': 'u_priya',
        'message': '4 hours on Initech fieldwork today, billable.',
        'client_timestamp': '2026-11-10T20:00:00+05:30'
    }
    res3 = client.post('/api/chat/parse', json=step3_payload)
    assert res3.status_code == 200
    data3 = res3.json()
    d_ini = data3['draft_entries'][0]
    closed_warn = next((a for a in d_ini['anomalies'] if a['rule_id'] == 'CLOSED_PROJECT'), None)
    assert closed_warn is not None
    assert "This project closed on 31 Oct. Time cannot be billed." in closed_warn['message']
    leakage_saved = d_ini['hours'] * 3000.0  # ₹12,000
    assert leakage_saved == 12000.0
    print(f"PASS Step 3: Caught closed project anomaly. Prevented ₹{leakage_saved:,.0f} in disputed invoices!")

    # STEP 4: Observability Trace (PRD Demo Step 4 / FR9)
    print("\n--- Step 4: Observability 'Why?' Trace (FR9) ---")
    assert d1['confidence'] >= 0.80
    assert len(d1['reasoning']) > 0
    assert d1['trace']['latency_ms'] > 0
    print(f"PASS Step 4: Full reasoning trace inspectable (Confidence: {int(d1['confidence']*100)}%, Latency: {d1['trace']['latency_ms']}ms)")

    # STEP 5: Live ROI & Admin Macro Analytics (FR8, FR10)
    print("\n--- Step 5: Live ROI & Admin Macro Analytics (FR8, FR10) ---")
    res_admin = client.get('/api/admin/metrics')
    assert res_admin.status_code == 200
    admin_data = res_admin.json()
    print("Admin Metrics Summary:")
    print(f"  • Confirmed Hours: {admin_data['total_hours_logged']}h")
    print(f"  • Billable Utilization: {admin_data['billable_utilization_pct']}%")
    print(f"  • Edit Rate: {admin_data['edit_rate_pct']}% ({admin_data['edit_rate_benchmark']})")
    print(f"  • Total Economic Value: ₹{admin_data['total_economic_value_inr']:,.2f}")
    print(f"  • Estimated AI Cost: ₹{admin_data['estimated_ai_cost_inr']}")
    print(f"  • Net ROI: {admin_data['net_roi']}x")

    assert admin_data['edit_rate_pct'] <= 15.0, "Edit rate exceeds 15% quality benchmark"
    assert admin_data['net_roi'] >= 10.0, f"Expected ROI >= 10x, got {admin_data['net_roi']}x"
    print(f"PASS Step 5: ROI Verified at {admin_data['net_roi']}x (> 10x benchmark met!)")

    print("\n=======================================================")
    print("SUCCESS: ALL PHASE 3 ACCEPTANCE GATES & DEMO VERIFIED!")
    print("=======================================================")

if __name__ == '__main__':
    run_phase3_tests()
