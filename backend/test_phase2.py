import json
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def run_phase2_tests():
    print("==================================================")
    print("RUNNING PHASE 2 ACCEPTANCE GATES & ANOMALY ENGINE")
    print("==================================================")

    # Reset timesheet store
    client.post('/api/timesheets/reset')

    # Test Gate 1: Ambiguity & Clarification Flow (FR4)
    print("\n--- Test 1: Ambiguity & Clarification Flow (Task 2.1 / FR4) ---")
    ambig_payload = {
        'conversation_id': 'p2_conv_01',
        'user_id': 'u_priya',
        'message': '2 hours on Acme development.',
        'client_timestamp': '2026-11-10T20:00:00+05:30'
    }
    res = client.post('/api/chat/parse', json=ambig_payload)
    assert res.status_code == 200, f"Parse failed: {res.text}"
    data = res.json()
    assert data['requires_clarification'] is True, "Expected requires_clarification=True"
    assert "Did you work on Acme Website (ACME-WEB) or Acme Mobile (ACME-MOB)?" in data['clarification_prompt'], \
        f"Prompt mismatch: {data['clarification_prompt']}"
    assert data['clarification_options'] is not None and len(data['clarification_options']) == 2
    codes = [opt['project_code'] for opt in data['clarification_options']]
    assert 'ACME-WEB' in codes and 'ACME-MOB' in codes, f"Options missing codes: {codes}"
    print("PASS: System halted and asked for clarification without guessing!")

    # Resolve clarification
    resolve_payload = {
        'conversation_id': 'p2_conv_01',
        'user_id': 'u_priya',
        'project_code': 'ACME-MOB',
        'task': 'Development',
        'hours': 2.0,
        'date': '2026-11-10',
        'raw_snippet': '2 hours on Acme Mobile'
    }
    res_resolve = client.post('/api/chat/resolve', json=resolve_payload)
    assert res_resolve.status_code == 200
    res_data = res_resolve.json()
    assert len(res_data['draft_entries']) == 1
    draft_clarified = res_data['draft_entries'][0]
    assert draft_clarified['project_code'] == 'ACME-MOB'
    assert draft_clarified['confidence'] >= 0.90
    print(f"PASS: Clarification resolved to {draft_clarified['project_code']} with confidence {draft_clarified['confidence']}")

    # Test Gate 2: Closed Project Error (Rule 5 / FR6)
    print("\n--- Test 2: Closed Project Anomaly Check (Rule 5) ---")
    closed_payload = {
        'conversation_id': 'p2_conv_02',
        'user_id': 'u_priya',
        'message': '4 hours on Initech fieldwork today, billable.',
        'client_timestamp': '2026-11-10T20:00:00+05:30'
    }
    res = client.post('/api/chat/parse', json=closed_payload)
    assert res.status_code == 200
    data = res.json()
    assert len(data['draft_entries']) == 1
    entry = data['draft_entries'][0]
    assert entry['project_code'] == 'INITECH-AUD'
    anomalies = entry['anomalies']
    closed_rule = next((a for a in anomalies if a['rule_id'] == 'CLOSED_PROJECT'), None)
    assert closed_rule is not None, "CLOSED_PROJECT anomaly not detected!"
    assert closed_rule['severity'] == 'error'
    assert "This project closed on 31 Oct. Time cannot be billed." in closed_rule['message'], \
        f"Unexpected message: {closed_rule['message']}"
    assert closed_rule['suggested_fix'] is not None and closed_rule['suggested_fix']['action'] == 'change_project'
    print(f"PASS: Closed project flagged: '{closed_rule['message']}' (Severity: {closed_rule['severity']})")

    # Test Gate 3: Billable on Internal Project (Rule 3)
    print("\n--- Test 3: Billable Internal Anomaly Check (Rule 3) ---")
    internal_payload = {
        'conversation_id': 'p2_conv_03',
        'user_id': 'u_priya',
        'message': '1 hour on internal standup, billable.',
        'client_timestamp': '2026-11-10T20:00:00+05:30'
    }
    res = client.post('/api/chat/parse', json=internal_payload)
    assert res.status_code == 200
    data = res.json()
    entry = data['draft_entries'][0]
    internal_rule = next((a for a in entry['anomalies'] if a['rule_id'] == 'BILLABLE_INTERNAL'), None)
    assert internal_rule is not None, "BILLABLE_INTERNAL anomaly not detected!"
    assert "Internal projects aren't billable. Switch to non-billable?" in internal_rule['message']
    assert internal_rule['suggested_fix']['action'] == 'set_non_billable'
    print(f"PASS: Billable internal flagged: '{internal_rule['message']}'")

    # Test Gate 4: Statistical Z-Score Outlier (Rule 1)
    print("\n--- Test 4: Statistical Z-Score Outlier (Rule 1) ---")
    high_hours_payload = {
        'conversation_id': 'p2_conv_04',
        'user_id': 'u_priya',
        'message': '11 hours on Acme website development today.',
        'client_timestamp': '2026-11-10T20:00:00+05:30'
    }
    res = client.post('/api/chat/parse', json=high_hours_payload)
    assert res.status_code == 200
    data = res.json()
    entry = data['draft_entries'][0]
    z_rule = next((a for a in entry['anomalies'] if a['rule_id'] == 'UNUSUAL_HOURS'), None)
    assert z_rule is not None, "UNUSUAL_HOURS anomaly not detected!"
    assert "11.0 hrs is well above your usual 8.2 hrs. Correct?" in z_rule['message'], \
        f"Unexpected z-score message: {z_rule['message']}"
    assert z_rule['suggested_fix']['action'] == 'adjust_hours'
    print(f"PASS: Statistical outlier flagged: '{z_rule['message']}'")

    # Test Gate 5: Holiday / Weekend Anomaly (Rule 2)
    print("\n--- Test 5: Weekend / Company Holiday Anomaly (Rule 2) ---")
    holiday_payload = {
        'conversation_id': 'p2_conv_05',
        'user_id': 'u_priya',
        'message': '4 hours on Acme website development on 2026-11-06.',
        'client_timestamp': '2026-11-10T20:00:00+05:30'
    }
    res = client.post('/api/chat/parse', json=holiday_payload)
    assert res.status_code == 200
    data = res.json()
    entry = data['draft_entries'][0]
    holiday_rule = next((a for a in entry['anomalies'] if a['rule_id'] == 'WEEKEND_HOLIDAY'), None)
    assert holiday_rule is not None, "WEEKEND_HOLIDAY anomaly not detected!"
    assert "Holiday" in holiday_rule['message'] or "Friday" in holiday_rule['message']
    print(f"PASS: Holiday entry flagged: '{holiday_rule['message']}'")

    # Test Gate 6: Budget Burn Breach (Rule 4)
    print("\n--- Test 6: Budget Burn Breach >90% (Rule 4) ---")
    # ACME-WEB is at 176/200h (88%). Adding 10h pushes it to 186/200h = 93%
    budget_payload = {
        'conversation_id': 'p2_conv_06',
        'user_id': 'u_priya',
        'message': '10 hours on Acme website development today.',
        'client_timestamp': '2026-11-10T20:00:00+05:30'
    }
    res = client.post('/api/chat/parse', json=budget_payload)
    assert res.status_code == 200
    data = res.json()
    entry = data['draft_entries'][0]
    budget_rule = next((a for a in entry['anomalies'] if a['rule_id'] == 'BUDGET_BURN'), None)
    assert budget_rule is not None, "BUDGET_BURN anomaly not detected!"
    assert "ACME-WEB" in budget_rule['message'] and "% of budget" in budget_rule['message']
    print(f"PASS: Budget burn flagged: '{budget_rule['message']}'")

    # Test Gate 7: Duplicate Entry Check (Rule 6)
    print("\n--- Test 7: Duplicate Entry Check (Rule 6) ---")
    # Commit one entry first
    client.post('/api/timesheets/confirm', json={
        'user_id': 'u_priya',
        'entries': [{
            'date': '2026-11-10',
            'project_code': 'ACME-MOB',
            'task': 'Development',
            'hours': 2.0,
            'is_billable': True
        }]
    })
    # Try parsing identical entry
    dup_payload = {
        'conversation_id': 'p2_conv_07',
        'user_id': 'u_priya',
        'message': '2 hours on Acme mobile development today.',
        'client_timestamp': '2026-11-10T20:00:00+05:30'
    }
    res = client.post('/api/chat/parse', json=dup_payload)
    assert res.status_code == 200
    data = res.json()
    entry = data['draft_entries'][0]
    dup_rule = next((a for a in entry['anomalies'] if a['rule_id'] == 'DUPLICATE'), None)
    assert dup_rule is not None, "DUPLICATE anomaly not detected!"
    assert "You already logged 2.0 hrs here today." in dup_rule['message'], f"Unexpected dup message: {dup_rule['message']}"
    print(f"PASS: Duplicate entry flagged: '{dup_rule['message']}'")

    # Test Gate 8: Observability Trace ("Why?" modal data / FR9)
    print("\n--- Test 8: Observability Trace Inspection (FR9) ---")
    assert entry['trace'] is not None
    assert 'model' in entry['trace']
    assert 'tokens' in entry['trace']
    assert 'latency_ms' in entry['trace']
    assert entry['confidence'] is not None
    assert len(entry['reasoning']) > 0
    print(f"PASS: Observability trace verified: Model={entry['trace']['model']}, Latency={entry['trace']['latency_ms']}ms, Confidence={entry['confidence']}")

    print("\n=======================================================")
    print("SUCCESS: ALL PHASE 2 EXIT CRITERIA & GUARDRAILS PASSED!")
    print("=======================================================")

if __name__ == '__main__':
    run_phase2_tests()

