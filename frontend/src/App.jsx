import React, { useState, useEffect, useRef } from 'react';
import { Shield, BarChart3, ChevronDown, Clock } from 'lucide-react';
import ChatInterface from './components/ChatInterface';
import TimesheetGrid from './components/TimesheetGrid';
import AIValuePanel, { calculateAiCostInr } from './components/AIValuePanel';
import AdminMacroModal from './components/AdminMacroModal';

export default function App() {
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: "Hi Priya — tell me what you worked on yesterday or this week in plain English, and I'll prepare draft entries for your review.",
      timestamp: 'Today'
    }
  ]);
  const [draftEntries, setDraftEntries] = useState([]);
  const [confirmedEntries, setConfirmedEntries] = useState([]);
  const [telemetryHistory, setTelemetryHistory] = useState([]);
  const [leakageCaughtRupees, setLeakageCaughtRupees] = useState(0);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [hourlyRate, setHourlyRate] = useState(1500);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionStartTime] = useState(Date.now());
  const [conversationId] = useState(`conv_${Date.now()}`);
  const profileMenuRef = useRef(null);

  useEffect(() => {
    fetch('/api/timesheets')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.confirmed_entries) {
          setConfirmedEntries(data.confirmed_entries);
        }
      })
      .catch((err) => console.log('Backend starting or unreachable:', err));
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSendMessage = async (userText) => {
    const userMsg = {
      sender: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId,
          user_id: 'u_priya',
          message: userText,
          client_timestamp: '2026-11-10T20:00:00+05:30'
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();

      if (data.telemetry) {
        setTelemetryHistory((prev) => [...prev, data.telemetry]);
      }

      if (data.draft_entries) {
        data.draft_entries.forEach((entry) => {
          const hasClosedProjectAnomaly = entry.anomalies?.some((a) => a.rule_id === 'CLOSED_PROJECT');
          if (hasClosedProjectAnomaly) {
            setLeakageCaughtRupees((prev) => prev + (entry.hours || 4) * 3000);
          }
        });
      }

      const botMsg = {
        sender: 'bot',
        text: data.assistant_message || 'Draft entries ready for review.',
        clarificationOptions: data.clarification_options,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, botMsg]);

      if (data.draft_entries && data.draft_entries.length > 0) {
        setDraftEntries((prev) => [...prev, ...data.draft_entries]);
      }
    } catch (err) {
      console.error('Chat parse failed:', err);
      const botMsg = {
        sender: 'bot',
        text: "Couldn't reach the backend parser. Check that the API server is running on port 8000.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, botMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectClarification = async (option) => {
    const userMsg = {
      sender: 'user',
      text: `Selected: ${option.label}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId,
          user_id: 'u_priya',
          project_code: option.project_code,
          task: option.task || 'Development',
          hours: 2.0,
          date: '2026-11-10',
          raw_snippet: `2 hours on ${option.label}`
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.telemetry) {
          setTelemetryHistory((prev) => [...prev, data.telemetry]);
        }
        if (data.draft_entries && data.draft_entries.length > 0) {
          setDraftEntries((prev) => [...prev, ...data.draft_entries]);
        }
        const botAck = {
          sender: 'bot',
          text: data.assistant_message || `Staged 2.0 hours for ${option.label}.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages((prev) => [...prev, botAck]);
        return;
      }
    } catch (e) {
      console.warn('Backend resolve error, using local fallback:', e);
    } finally {
      setIsLoading(false);
    }

    const newDraft = {
      id: `draft_${Date.now()}_clarified`,
      date: '2026-11-10',
      project_code: option.project_code,
      project_name: option.project_code === 'ACME-MOB' ? 'Acme Mobile App' : 'Acme Website Redesign',
      task: option.task || 'Development',
      hours: 2.0,
      is_billable: true,
      status: 'draft',
      user_edited: false,
      confidence: 0.95,
      reasoning: `Clarified project selection to ${option.project_code} / ${option.task || 'Development'}`,
      raw_input_snippet: `2 hours on ${option.label}`,
      anomalies: [],
      trace: {
        model: 'openai/gpt-oss-20b',
        tokens: 190,
        latency_ms: 110
      }
    };

    setDraftEntries((prev) => [...prev, newDraft]);
    setMessages((prev) => [
      ...prev,
      {
        sender: 'bot',
        text: `Staged 2.0 hours for ${option.label} under Development.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  const handleUpdateDraft = (id, updates) => {
    setDraftEntries((prev) => prev.map((d) => (d.id === id ? { ...d, ...updates } : d)));
  };

  const handleConfirmDraft = async (draft) => {
    try {
      await fetch('/api/timesheets/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'u_priya',
          entries: [draft]
        })
      });
    } catch (e) {
      console.warn('Confirm persistence error, committing locally:', e);
    }

    setDraftEntries((prev) => prev.filter((d) => d.id !== draft.id));
    setConfirmedEntries((prev) => [
      ...prev,
      {
        ...draft,
        status: 'confirmed',
        id: `conf_${draft.id}`
      }
    ]);
  };

  const handleDiscardDraft = (id) => {
    setDraftEntries((prev) => prev.filter((d) => d.id !== id));
  };

  const handleConfirmAll = async () => {
    if (draftEntries.length === 0) return;

    try {
      await fetch('/api/timesheets/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'u_priya',
          entries: draftEntries
        })
      });
    } catch (e) {
      console.warn('Confirm all persistence error, committing locally:', e);
    }

    const newlyConfirmed = draftEntries.map((d) => ({
      ...d,
      status: 'confirmed',
      id: `conf_${d.id}`
    }));

    setConfirmedEntries((prev) => [...prev, ...newlyConfirmed]);
    setDraftEntries([]);
  };

  const handleResetSession = async () => {
    try {
      await fetch('/api/timesheets/reset', { method: 'POST' });
    } catch (e) {
      console.log('Reset store call error:', e);
    }
    setDraftEntries([]);
    setConfirmedEntries([]);
    setTelemetryHistory([]);
    setLeakageCaughtRupees(0);
    setMessages([
      {
        sender: 'bot',
        text: "Session reset. Priya, what did you work on yesterday or this week?",
        timestamp: 'Just now'
      }
    ]);
  };

  const elapsedSeconds = Math.max(10, Math.floor((Date.now() - sessionStartTime) / 1000));
  const liveCostRupees = calculateAiCostInr(telemetryHistory);

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-[#F7F8FA] text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 shrink-0">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-4">
          {/* Logo & Company */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <Clock className="w-4 h-4" />
            </div>
            <div className="flex items-baseline gap-2.5">
              <h1 className="text-base font-bold tracking-tight text-slate-900">TimeTalk</h1>
              <span className="text-xs text-slate-500">
                Northwind Consulting (demo data)
              </span>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-600 bg-[#F7F8FA] px-3 py-1.5 rounded-lg border border-slate-200">
              <Shield className="w-3.5 h-3.5 text-blue-600" />
              <span>Nothing submits without your approval</span>
            </div>

            <button
              type="button"
              onClick={() => setShowAdminModal(true)}
              className="flex items-center gap-1.5 text-xs font-medium bg-white hover:bg-[#F7F8FA] text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg transition cursor-pointer"
            >
              <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
              <span>Team view</span>
            </button>

            {/* Avatar Menu for Priya & Rate */}
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => setShowProfileMenu((prev) => !prev)}
                className="flex items-center gap-2 text-xs bg-white hover:bg-[#F7F8FA] border border-slate-200 px-2.5 py-1 rounded-lg transition cursor-pointer"
              >
                <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 font-semibold text-[11px] flex items-center justify-center">
                  PS
                </span>
                <span className="font-medium text-slate-800">Priya</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-600">₹{hourlyRate.toLocaleString('en-IN')}/hr</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-lg p-3 z-40 text-xs">
                  <div className="pb-2 mb-2 border-b border-slate-100">
                    <div className="font-semibold text-slate-900">Priya Sharma</div>
                    <div className="text-[11px] text-slate-500">Senior Consultant · Northwind</div>
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-medium text-slate-500 block">
                      Loaded hourly rate
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[1200, 1500, 2000].map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => {
                            setHourlyRate(rate);
                            setShowProfileMenu(false);
                          }}
                          className={`py-1 rounded-lg border text-[11px] font-medium cursor-pointer transition ${
                            hourlyRate === rate
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-[#F7F8FA] text-slate-700 border-slate-200 hover:border-blue-300'
                          }`}
                        >
                          ₹{rate}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Single-Screen Workspace (1440x900, no page scroll) */}
      <main className="flex-1 min-h-0 max-w-[1440px] w-full mx-auto p-4 lg:p-6 flex flex-col lg:flex-row gap-4 overflow-hidden">
        {/* Left: Chat (35% width) */}
        <section className="w-full lg:w-[35%] h-full min-h-0 flex flex-col">
          <ChatInterface
            messages={messages}
            onSendMessage={handleSendMessage}
            onSelectClarification={handleSelectClarification}
            isLoading={isLoading}
            onResetSession={handleResetSession}
          />
        </section>

        {/* Right: 4 KPI Cards (top) + Timesheet Grid (bottom) */}
        <section className="w-full lg:w-[65%] h-full min-h-0 flex flex-col gap-4">
          <AIValuePanel
            telemetryHistory={telemetryHistory}
            confirmedCount={confirmedEntries.length}
            leakageCaughtRupees={leakageCaughtRupees}
            chatSeconds={elapsedSeconds}
            hourlyRate={hourlyRate}
          />

          <div className="flex-1 min-h-0 flex flex-col">
            <TimesheetGrid
              draftEntries={draftEntries}
              confirmedEntries={confirmedEntries}
              onUpdateDraft={handleUpdateDraft}
              onConfirmDraft={handleConfirmDraft}
              onDiscardDraft={handleDiscardDraft}
              onConfirmAll={handleConfirmAll}
            />
          </div>
        </section>
      </main>

      {showAdminModal && (
        <AdminMacroModal
          onClose={() => setShowAdminModal(false)}
          liveCostRupees={liveCostRupees}
          liveLeakageRupees={leakageCaughtRupees}
        />
      )}
    </div>
  );
}
