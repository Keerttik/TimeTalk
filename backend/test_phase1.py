import json
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def run_tests():
    # 1. Health check
    res = client.get('/health')
    assert res.status_code == 200, f'Health check failed: {res.text}'
    print('PASS: /health')

    # 2. Reset timesheets
    res = client.post('/api/timesheets/reset')
    assert res.status_code == 200
    timesheets = client.get('/api/timesheets').json()
    assert len(timesheets['confirmed_entries']) == 0, 'Initial timesheet not empty'
    print('PASS: FR7 invariant verified - zero confirmed entries prior to user confirmation')

    # 3. Phase 1 Core Prompt
    payload = {
        'conversation_id': 'test_conv_01',
        'user_id': 'u_priya',
        'message': 'Spent 3 hours on the Acme design review yesterday and 1 hour on internal standup.',
        'client_timestamp': '2026-11-10T20:00:00+05:30'
    }
    res = client.post('/api/chat/parse', json=payload)
    assert res.status_code == 200, f'Chat parse failed: {res.text}'
    data = res.json()
    drafts = data['draft_entries']
    assert len(drafts) == 2, f'Expected 2 drafts, got {len(drafts)}'
    d1, d2 = drafts[0], drafts[1]

    print(f"Draft 1: {d1['project_code']} | {d1['task']} | {d1['hours']}h | Billable: {d1['is_billable']} | Date: {d1['date']}")
    print(f"Draft 2: {d2['project_code']} | {d2['task']} | {d2['hours']}h | Billable: {d2['is_billable']} | Date: {d2['date']}")

    assert d1['project_code'] == 'ACME-WEB', f"Expected ACME-WEB, got {d1['project_code']}"
    assert d1['task'] == 'Design', f"Expected Design, got {d1['task']}"
    assert d1['hours'] == 3.0, f"Expected 3.0 hours, got {d1['hours']}"
    assert d1['is_billable'] is True, 'Expected billable'
    assert d1['date'] == '2026-11-09', f"Expected 2026-11-09, got {d1['date']}"

    assert d2['project_code'] == 'INT-OPS', f"Expected INT-OPS, got {d2['project_code']}"
    assert d2['task'] == 'Standup', f"Expected Standup, got {d2['task']}"
    assert d2['hours'] == 1.0, f"Expected 1.0 hours, got {d2['hours']}"
    assert d2['is_billable'] is False, 'Expected non-billable'
    assert d2['date'] == '2026-11-09', f"Expected 2026-11-09, got {d2['date']}"

    # Check storage again - still 0 rows committed! (FR7)
    timesheets = client.get('/api/timesheets').json()
    assert len(timesheets['confirmed_entries']) == 0, 'Storage was modified before confirmation!'
    print('PASS: Storage untouched before user confirmation (FR7 preserved)')

    # 4. User clicks Confirm All
    confirm_payload = {
        'user_id': 'u_priya',
        'entries': [
            {'date': d1['date'], 'project_code': d1['project_code'], 'task': d1['task'], 'hours': d1['hours'], 'is_billable': d1['is_billable'], 'user_edited': False},
            {'date': d2['date'], 'project_code': d2['project_code'], 'task': d2['task'], 'hours': d2['hours'], 'is_billable': d2['is_billable'], 'user_edited': False}
        ]
    }
    conf_res = client.post('/api/timesheets/confirm', json=confirm_payload)
    assert conf_res.status_code == 200
    assert conf_res.json()['count'] == 2
    timesheets = client.get('/api/timesheets').json()
    assert len(timesheets['confirmed_entries']) == 2
    print('PASS: /api/timesheets/confirm committed 2 rows to active store')

    print('\n=============================================')
    print('SUCCESS: ALL PHASE 1 ACCEPTANCE GATES PASSED!')
    print('=============================================')

if __name__ == '__main__':
    run_tests()

