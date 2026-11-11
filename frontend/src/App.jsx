import React, { useState, useEffect, useRef } from 'react';
import { Shield, BarChart3, ChevronDown, Clock } from 'lucide-react';
import ChatInterface from './components/ChatInterface';
import TimesheetGrid from './components/TimesheetGrid';
import AIValuePanel from './components/AIValuePanel';
import AdminMacroModal from './components/AdminMacroModal';
import { MetricsProvider, useMetrics } from './store/metricsStore';

function TimeTalkWorkspace() {
  const {
    messages,
    draftEntries,
    confirmedEntries,
    hourlyRate,
    isLoading,
    setHourlyRate,
    sendMessage,
    selectClarification,
    updateDraft,
    confirmDraft,
    discardDraft,
    confirmAll,
    resetSession
  } = useMetrics();

  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
            onSendMessage={sendMessage}
            onSelectClarification={selectClarification}
            isLoading={isLoading}
            onResetSession={resetSession}
          />
        </section>

        {/* Right: 4 KPI Cards (top) + Timesheet Grid (bottom) */}
        <section className="w-full lg:w-[65%] h-full min-h-0 flex flex-col gap-4">
          <AIValuePanel />

          <div className="flex-1 min-h-0 flex flex-col">
            <TimesheetGrid
              draftEntries={draftEntries}
              confirmedEntries={confirmedEntries}
              onUpdateDraft={updateDraft}
              onConfirmDraft={confirmDraft}
              onDiscardDraft={discardDraft}
              onConfirmAll={confirmAll}
            />
          </div>
        </section>
      </main>

      {showAdminModal && <AdminMacroModal onClose={() => setShowAdminModal(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <MetricsProvider>
      <TimeTalkWorkspace />
    </MetricsProvider>
  );
}
