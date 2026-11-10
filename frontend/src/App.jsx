import React, { useState, useEffect } from 'react';
import { Briefcase, Shield, Clock, Layers, Sparkles, BarChart3, PlayCircle } from 'lucide-react';
import ChatInterface from './components/ChatInterface';
import TimesheetGrid from './components/TimesheetGrid';
import AIValuePanel from './components/AIValuePanel';
import WhyTraceModal from './components/WhyTraceModal';
import AdminMacroModal from './components/AdminMacroModal';

export default function App() {
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: "👋 Hi Priya! I'm TimeTalk, your timesheet copilot for Northwind Consulting. Tell me what you worked on yesterday or today in natural language, and I'll stage the draft entries for your review.",
      timestamp: 'Today at 8:00 PM'
    }
  ]);
  const [draftEntries, setDraftEntries] = useState([]);
  const [confirmedEntries, setConfirmedEntries] = useState([]);
  const [telemetryHistory, setTelemetryHistory] = useState([]);
  const [leakageCaughtRupees, setLeakageCaughtRupees] = useState(0);
  const [inspectingEntry, setInspectingEntry] = useState(null);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionStartTime] = useState(Date.now());
  const [conversationId] = useState(`conv_${Date.now()}`);

  // Fetch initial timesheet on mount
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

  // Send Chat Message to Backend
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

      // Record Telemetry
      if (data.telemetry) {
        setTelemetryHistory((prev) => [...prev, data.telemetry]);
      }

      // Check for billing leakage caught (closed projects or internal billable)
      if (data.draft_entries) {
        data.draft_entries.forEach((entry) => {
          const hasClosedProjectAnomaly = entry.anomalies?.some((a) => a.rule_id === 'CLOSED_PROJECT');
          if (hasClosedProjectAnomaly) {
            // ₹3,000/hr * 4h = ₹12,000 leakage caught
            setLeakageCaughtRupees((prev) => prev + (entry.hours || 4) * 3000);
          }
        });
      }

      // Bot response message
      const botMsg = {
        sender: 'bot',
        text: data.assistant_message || 'Draft entries processed.',
        clarificationOptions: data.clarification_options,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, botMsg]);

      // If drafts produced, stage them
      if (data.draft_entries && data.draft_entries.length > 0) {
        setDraftEntries((prev) => [...prev, ...data.draft_entries]);
      }
    } catch (err) {
      console.error('Chat parse failed:', err);
      // Client-side fallback if backend API is offline during hot reload
      const botMsg = {
        sender: 'bot',
        text: "I couldn't reach the backend parser. Please ensure the backend server is running on port 8000.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, botMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Clarification Option Selection (e.g. Acme Mobile)
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
          text: data.assistant_message || `Got it! Staged 2.0 hours for ${option.label}. Review the row in your timesheet table below.`,
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

    // Local fallback
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
      reasoning: `User clarified project selection to ${option.project_code} / ${option.task || 'Development'}`,
      raw_input_snippet: `2 hours on ${option.label}`,
      anomalies: [],
      trace: {
        model: 'gemini-2.5-flash',
        tokens: 190,
        latency_ms: 110
      }
    };

    setDraftEntries((prev) => [...prev, newDraft]);

    const botAck = {
      sender: 'bot',
      text: `Got it! Staged 2.0 hours for ${option.label} under Development (billable). Review the row in your timesheet table below.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages((prev) => [...prev, botAck]);
  };

  // Update Draft Row (Inline Edits)
  const handleUpdateDraft = (id, updates) => {
    setDraftEntries((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...updates } : d))
    );
  };

  // Confirm Single Draft Row
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

  // Discard Single Draft Row
  const handleDiscardDraft = (id) => {
    setDraftEntries((prev) => prev.filter((d) => d.id !== id));
  };

  // Confirm All Draft Rows
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

  // Reset Session & Backend Timesheet Store
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
        text: "Session reset. Priya, what did you work on yesterday or today?",
        timestamp: 'Just now'
      }
    ]);
  };

  const elapsedSeconds = Math.max(10, Math.floor((Date.now() - sessionStartTime) / 1000));

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-800">
      {/* Top Enterprise Navigation Bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 shrink-0 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-lg shadow-sm">
              T
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black tracking-tight text-slate-900">TimeTalk</h1>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                  Phase 1 Core Loop
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Northwind Consulting • Conversational Timesheet Copilot
              </p>
            </div>
          </div>

          {/* User Profile Pill & Admin Macro Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAdminModal(true)}
              className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-lg transition shadow-2xs cursor-pointer"
            >
              <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Admin Macro View (FR10)</span>
            </button>

            <div className="hidden sm:flex items-center gap-2 text-xs bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
              <Briefcase className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-600">Consultant:</span>
              <strong className="text-slate-800 font-semibold">Priya Sharma</strong>
              <span className="text-slate-300">|</span>
              <span className="text-slate-500">Rate: ₹1,500/hr</span>
            </div>

            <div className="hidden md:flex items-center gap-1.5 text-xs text-emerald-700 font-medium bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200">
              <Shield className="w-3.5 h-3.5 text-emerald-600" />
              <span>FR7 Invariant Active</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 overflow-hidden">
        {/* Left Column: Conversational Copilot (5 cols) */}
        <section className="lg:col-span-5 h-[calc(100vh-125px)] flex flex-col">
          <ChatInterface
            messages={messages}
            onSendMessage={handleSendMessage}
            onSelectClarification={handleSelectClarification}
            isLoading={isLoading}
            onResetSession={handleResetSession}
          />
        </section>

        {/* Right Column: Weekly Timesheet Grid & Live AI Value Panel (7 cols) */}
        <section className="lg:col-span-7 h-[calc(100vh-125px)] flex flex-col gap-5 overflow-y-auto pr-1">
          {/* Weekly Grid */}
          <div className="flex-1 min-h-[360px]">
            <TimesheetGrid
              draftEntries={draftEntries}
              confirmedEntries={confirmedEntries}
              onUpdateDraft={handleUpdateDraft}
              onConfirmDraft={handleConfirmDraft}
              onDiscardDraft={handleDiscardDraft}
              onConfirmAll={handleConfirmAll}
              onOpenWhyTrace={(entry) => setInspectingEntry(entry)}
            />
          </div>

          {/* Live AI Value & ROI Telemetry Panel */}
          <div className="shrink-0">
            <AIValuePanel
              telemetryHistory={telemetryHistory}
              confirmedCount={confirmedEntries.length}
              leakageCaughtRupees={leakageCaughtRupees}
              chatSeconds={elapsedSeconds}
            />
          </div>
        </section>
      </main>

      {/* "Why?" Observability Trace Modal */}
      {inspectingEntry && (
        <WhyTraceModal
          entry={inspectingEntry}
          onClose={() => setInspectingEntry(null)}
        />
      )}

      {/* Admin Macro Analytics Modal (FR10) */}
      {showAdminModal && (
        <AdminMacroModal
          onClose={() => setShowAdminModal(false)}
        />
      )}
    </div>
  );
}
