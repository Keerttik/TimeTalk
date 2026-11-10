import React from 'react';
import { Check, CheckCheck, Trash2, HelpCircle, Calendar, Sparkles, CheckCircle2, Clock } from 'lucide-react';
import AnomalyWarning from './AnomalyWarning';
import { MOCK_CATALOGUE } from '../mockData';

export default function TimesheetGrid({
  draftEntries = [],
  confirmedEntries = [],
  onUpdateDraft,
  onConfirmDraft,
  onDiscardDraft,
  onConfirmAll,
  onOpenWhyTrace
}) {
  const projects = MOCK_CATALOGUE.projects;

  // Format date helper: "2026-11-09" -> "Mon, Nov 9"
  const formatDateHeader = (dateStr) => {
    try {
      const dt = new Date(dateStr + "T00:00:00");
      return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    } catch {
      return dateStr;
    }
  };

  const totalDraftHours = draftEntries.reduce((sum, e) => sum + (Number(e.hours) || 0), 0);
  const totalConfirmedHours = confirmedEntries.reduce((sum, e) => sum + (Number(e.hours) || 0), 0);

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Table Header / Action Toolbar */}
      <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">Weekly Timesheet Grid</h2>
            <p className="text-[11px] text-slate-500">
              Week of Nov 9 – Nov 15, 2026 • Consultant: Priya Sharma
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-right pr-2 border-r border-slate-200">
            <span className="text-slate-500 text-[11px]">Total Logged: </span>
            <span className="font-bold text-slate-900">{totalConfirmedHours}h</span>
            {draftEntries.length > 0 && (
              <span className="text-amber-600 font-semibold ml-1.5">(+{totalDraftHours}h drafts)</span>
            )}
          </div>

          {draftEntries.length > 0 && (
            <button
              onClick={onConfirmAll}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Confirm All Drafts ({draftEntries.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Table */}
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
              <th className="py-2.5 px-3">Date</th>
              <th className="py-2.5 px-3">Project</th>
              <th className="py-2.5 px-3">Task</th>
              <th className="py-2.5 px-3 w-20">Hours</th>
              <th className="py-2.5 px-3 w-24">Billing</th>
              <th className="py-2.5 px-3">Status & Guardrails</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {/* Draft Rows (Pending User Review) */}
            {draftEntries.map((draft) => {
              const selectedProject = projects.find(p => p.code === draft.project_code);
              const availableTasks = selectedProject?.tasks || [draft.task];

              return (
                <tr
                  key={draft.id}
                  className="bg-amber-50/40 hover:bg-amber-50/70 border-l-4 border-l-amber-500 transition"
                >
                  {/* Date */}
                  <td className="py-2.5 px-3 font-medium text-slate-800 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>{formatDateHeader(draft.date)}</span>
                    </div>
                  </td>

                  {/* Project Selector */}
                  <td className="py-2.5 px-3">
                    <select
                      value={draft.project_code}
                      onChange={(e) => {
                        const newCode = e.target.value;
                        const proj = projects.find(p => p.code === newCode);
                        onUpdateDraft(draft.id, {
                          project_code: newCode,
                          project_name: proj?.name || newCode,
                          task: proj?.tasks[0] || 'General',
                          is_billable: proj ? proj.is_billable : draft.is_billable,
                          user_edited: true
                        });
                      }}
                      className="text-xs bg-white border border-slate-300 rounded px-2 py-1 font-semibold text-slate-800 focus:ring-1 focus:ring-blue-500 max-w-[190px]"
                    >
                      {projects.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.code} — {p.name}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Task Selector */}
                  <td className="py-2.5 px-3">
                    <select
                      value={draft.task}
                      onChange={(e) => onUpdateDraft(draft.id, { task: e.target.value, user_edited: true })}
                      className="text-xs bg-white border border-slate-300 rounded px-2 py-1 text-slate-700 focus:ring-1 focus:ring-blue-500"
                    >
                      {availableTasks.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Hours */}
                  <td className="py-2.5 px-3">
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="24"
                      value={draft.hours}
                      onChange={(e) => onUpdateDraft(draft.id, { hours: parseFloat(e.target.value) || 0, user_edited: true })}
                      className="w-16 bg-white border border-slate-300 rounded px-2 py-1 text-center font-bold text-slate-900 focus:ring-1 focus:ring-blue-500"
                    />
                  </td>

                  {/* Billable Toggle */}
                  <td className="py-2.5 px-3">
                    <button
                      type="button"
                      onClick={() => onUpdateDraft(draft.id, { is_billable: !draft.is_billable, user_edited: true })}
                      className={`text-[11px] font-bold px-2 py-1 rounded cursor-pointer transition ${
                        draft.is_billable
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      {draft.is_billable ? 'Billable' : 'Non-Billable'}
                    </button>
                  </td>

                  {/* Status & Guardrails */}
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-300">
                        <Sparkles className="w-2.5 h-2.5" />
                        Draft (AI Generated)
                      </span>
                      {draft.user_edited && (
                        <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          User Edited
                        </span>
                      )}
                    </div>
                    {/* Inline Anomaly Warning */}
                    <AnomalyWarning
                      anomalies={draft.anomalies}
                      onFix={(fix) => {
                        const remainingAnomalies = (draft.anomalies || []).filter(a => {
                          if (fix.action === 'set_non_billable' && a.rule_id === 'BILLABLE_INTERNAL') return false;
                          if (fix.action === 'change_project' && (a.rule_id === 'CLOSED_PROJECT' || a.rule_id === 'BUDGET_BURN')) return false;
                          if (fix.action === 'adjust_hours' && a.rule_id === 'UNUSUAL_HOURS') return false;
                          return true;
                        });

                        if (fix.action === 'set_non_billable') {
                          onUpdateDraft(draft.id, { is_billable: false, user_edited: true, anomalies: remainingAnomalies });
                        } else if (fix.action === 'change_project') {
                          const proj = projects.find(p => p.code === fix.value);
                          onUpdateDraft(draft.id, {
                            project_code: fix.value,
                            project_name: proj?.name || fix.value,
                            task: proj?.tasks[0] || 'General',
                            is_billable: proj ? proj.is_billable : false,
                            user_edited: true,
                            anomalies: remainingAnomalies
                          });
                        } else if (fix.action === 'adjust_hours') {
                          onUpdateDraft(draft.id, { hours: fix.value, user_edited: true, anomalies: remainingAnomalies });
                        }
                      }}
                    />
                  </td>

                  {/* Actions */}
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onOpenWhyTrace(draft)}
                        title="Inspect AI reasoning trace"
                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded border border-blue-200 transition cursor-pointer flex items-center gap-1"
                      >
                        <HelpCircle className="w-3 h-3" />
                        Why?
                      </button>
                      <button
                        onClick={() => onConfirmDraft(draft)}
                        title="Confirm this row into timesheet"
                        className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition shadow-2xs cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDiscardDraft(draft.id)}
                        title="Discard draft"
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {/* Confirmed Rows */}
            {confirmedEntries.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50/80 transition">
                <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                  {formatDateHeader(row.date)}
                </td>
                <td className="py-2.5 px-3">
                  <span className="font-semibold text-slate-800">{row.project_code}</span>
                  <span className="text-slate-500 text-[11px] block">{row.project_name}</span>
                </td>
                <td className="py-2.5 px-3 text-slate-700 font-medium">
                  {row.task}
                </td>
                <td className="py-2.5 px-3 font-bold text-slate-900">
                  {row.hours}h
                </td>
                <td className="py-2.5 px-3">
                  <span
                    className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded ${
                      row.is_billable
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    {row.is_billable ? 'Billable' : 'Non-Billable'}
                  </span>
                </td>
                <td className="py-2.5 px-3">
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Verified & Confirmed
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right">
                  <button
                    onClick={() => onOpenWhyTrace(row)}
                    className="text-[11px] text-slate-400 hover:text-blue-600 px-2 py-1 rounded hover:bg-slate-100 transition cursor-pointer inline-flex items-center gap-1"
                  >
                    <HelpCircle className="w-3 h-3" />
                    Why?
                  </button>
                </td>
              </tr>
            ))}

            {/* Empty State */}
            {draftEntries.length === 0 && confirmedEntries.length === 0 && (
              <tr>
                <td colSpan="7" className="py-12 text-center text-slate-400">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-500" />
                  <p className="text-sm font-semibold text-slate-600">No timesheet entries for this week yet.</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Use the chat copilot on the left to log your work in natural language!
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

