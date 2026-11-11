import React, { useState } from 'react';
import { Check, CheckCheck, Trash2, ChevronDown, ChevronUp, Calendar, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import AnomalyWarning from './AnomalyWarning';
import { MOCK_CATALOGUE } from '../mockData';

export default function TimesheetGrid({
  draftEntries = [],
  confirmedEntries = [],
  onUpdateDraft,
  onConfirmDraft,
  onDiscardDraft,
  onConfirmAll
}) {
  const [expandedWhyId, setExpandedWhyId] = useState(null);
  const projects = MOCK_CATALOGUE.projects;

  const formatDateHeader = (dateStr) => {
    try {
      const dt = new Date(dateStr + 'T00:00:00');
      return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const toggleWhy = (id) => {
    setExpandedWhyId((prev) => (prev === id ? null : id));
  };

  const totalDraftHours = draftEntries.reduce((sum, e) => sum + (Number(e.hours) || 0), 0);
  const totalConfirmedHours = confirmedEntries.reduce((sum, e) => sum + (Number(e.hours) || 0), 0);

  const renderInlineWhy = (row) => {
    const trace = row.trace || { model: 'openai/gpt-oss-20b', tokens: 280, latency_ms: 195 };
    const confidencePct = Math.round((row.confidence || 0.9) * 100);

    return (
      <tr className="bg-[#F7F8FA] border-b border-slate-200">
        <td colSpan="7" className="px-4 py-3">
          <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col gap-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mr-2">
                  Match explanation
                </span>
                <span className="text-slate-800">
                  {row.reasoning || `Matched activity to ${row.project_code} / ${row.task} from catalogue.`}
                </span>
                {row.raw_input_snippet && (
                  <span className="ml-2 font-mono text-[11px] text-slate-500 bg-[#F7F8FA] border border-slate-200 px-1.5 py-0.5 rounded-lg">
                    "{row.raw_input_snippet}"
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 shrink-0 text-[11px] text-slate-600">
                <span className="px-2 py-0.5 rounded-lg bg-[#F7F8FA] border border-slate-200">
                  Confidence: <strong className="text-slate-900">{confidencePct}%</strong>
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-[#F7F8FA] border border-slate-200">
                  Tokens: <strong className="text-slate-900">{trace.tokens ?? '—'}</strong>
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-[#F7F8FA] border border-slate-200">
                  Latency: <strong className="text-slate-900">{trace.latency_ms ?? '—'}ms</strong>
                </span>
              </div>
            </div>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-white rounded-lg border border-slate-200 overflow-hidden">
      {/* Toolbar */}
      <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#F7F8FA] border border-slate-200 flex items-center justify-center text-blue-600">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 leading-tight">Weekly timesheet</h2>
            <p className="text-[11px] text-slate-500">Week of Nov 9 – Nov 15, 2026</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-xs text-slate-500">
            Confirmed: <strong className="text-slate-900">{totalConfirmedHours}h</strong>
            {draftEntries.length > 0 && (
              <span className="ml-2 text-slate-600">
                Pending: <strong className="text-slate-900">{totalDraftHours}h</strong>
              </span>
            )}
          </div>

          {draftEntries.length > 0 && (
            <button
              type="button"
              onClick={onConfirmAll}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Confirm all ({draftEntries.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Table Container */}
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-[#F7F8FA] border-b border-slate-200">
            <tr className="text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
              <th className="py-2.5 px-4">Date</th>
              <th className="py-2.5 px-3">Project</th>
              <th className="py-2.5 px-3">Task</th>
              <th className="py-2.5 px-3 w-20">Hours</th>
              <th className="py-2.5 px-3 w-28">Billing</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {/* Draft / Needs Review Rows */}
            {draftEntries.map((draft) => {
              const selectedProject = projects.find((p) => p.code === draft.project_code);
              const availableTasks = selectedProject?.tasks || [draft.task];
              const needsReview = Array.isArray(draft.anomalies) && draft.anomalies.length > 0;
              const isExpanded = expandedWhyId === draft.id;

              return (
                <React.Fragment key={draft.id}>
                  <tr
                    className={`transition ${
                      needsReview
                        ? 'bg-amber-50/35 hover:bg-amber-50/55 border-l-2 border-l-amber-500'
                        : 'bg-white hover:bg-[#F7F8FA] border-l-2 border-l-slate-300'
                    }`}
                  >
                    {/* Date */}
                    <td className="py-2.5 px-4 font-medium text-slate-800 whitespace-nowrap">
                      {formatDateHeader(draft.date)}
                    </td>

                    {/* Project Selector */}
                    <td className="py-2.5 px-3">
                      <select
                        value={draft.project_code}
                        onChange={(e) => {
                          const newCode = e.target.value;
                          const proj = projects.find((p) => p.code === newCode);
                          onUpdateDraft(draft.id, {
                            project_code: newCode,
                            project_name: proj?.name || newCode,
                            task: proj?.tasks[0] || 'General',
                            is_billable: proj ? proj.is_billable : draft.is_billable,
                            user_edited: true
                          });
                        }}
                        className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 font-medium text-slate-800 focus:outline-hidden focus:border-blue-600 max-w-[185px]"
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
                        onChange={(e) =>
                          onUpdateDraft(draft.id, { task: e.target.value, user_edited: true })
                        }
                        className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-hidden focus:border-blue-600"
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
                        onChange={(e) =>
                          onUpdateDraft(draft.id, {
                            hours: parseFloat(e.target.value) || 0,
                            user_edited: true
                          })
                        }
                        className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-1 text-center font-semibold text-slate-900 focus:outline-hidden focus:border-blue-600"
                      />
                    </td>

                    {/* Billable Toggle */}
                    <td className="py-2.5 px-3">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateDraft(draft.id, {
                            is_billable: !draft.is_billable,
                            user_edited: true
                          })
                        }
                        className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border cursor-pointer transition whitespace-nowrap ${
                          draft.is_billable
                            ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                            : 'bg-[#F7F8FA] text-slate-600 border-slate-200 hover:bg-slate-200/70'
                        }`}
                      >
                        {draft.is_billable ? 'Billable' : 'Non-billable'}
                      </button>
                    </td>

                    {/* Row Status (Draft grey vs Needs review amber) + Inline Anomaly */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {needsReview ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-amber-100 text-amber-800 px-2 py-0.5 rounded-lg border border-amber-200">
                            <AlertTriangle className="w-3 h-3 text-amber-700" />
                            Needs review
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg border border-slate-200">
                            <Clock className="w-3 h-3 text-slate-500" />
                            Draft
                          </span>
                        )}
                        {draft.user_edited && (
                          <span className="text-[10px] font-medium text-slate-500 bg-[#F7F8FA] border border-slate-200 px-1.5 py-0.5 rounded-lg">
                            Edited
                          </span>
                        )}
                      </div>

                      <AnomalyWarning
                        anomalies={draft.anomalies}
                        onFix={(fix) => {
                          const remainingAnomalies = (draft.anomalies || []).filter((a) => {
                            if (fix.action === 'set_non_billable' && a.rule_id === 'BILLABLE_INTERNAL') return false;
                            if (fix.action === 'change_project' && (a.rule_id === 'CLOSED_PROJECT' || a.rule_id === 'BUDGET_BURN')) return false;
                            if (fix.action === 'adjust_hours' && a.rule_id === 'UNUSUAL_HOURS') return false;
                            return true;
                          });

                          if (fix.action === 'set_non_billable') {
                            onUpdateDraft(draft.id, {
                              is_billable: false,
                              user_edited: true,
                              anomalies: remainingAnomalies
                            });
                          } else if (fix.action === 'change_project') {
                            const proj = projects.find((p) => p.code === fix.value);
                            onUpdateDraft(draft.id, {
                              project_code: fix.value,
                              project_name: proj?.name || fix.value,
                              task: proj?.tasks[0] || 'General',
                              is_billable: proj ? proj.is_billable : false,
                              user_edited: true,
                              anomalies: remainingAnomalies
                            });
                          } else if (fix.action === 'adjust_hours') {
                            onUpdateDraft(draft.id, {
                              hours: fix.value,
                              user_edited: true,
                              anomalies: remainingAnomalies
                            });
                          }
                        }}
                      />
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => toggleWhy(draft.id)}
                          className={`text-[11px] font-medium px-2 py-1 rounded-lg border transition cursor-pointer inline-flex items-center gap-1 ${
                            isExpanded
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-white text-slate-600 hover:text-blue-600 border-slate-200 hover:border-blue-200'
                          }`}
                        >
                          <span>Why?</span>
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => onConfirmDraft(draft)}
                          title="Confirm entry"
                          className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDiscardDraft(draft.id)}
                          title="Discard draft"
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-[#F7F8FA] border border-transparent hover:border-slate-200 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && renderInlineWhy(draft)}
                </React.Fragment>
              );
            })}

            {/* Confirmed Rows (Green) */}
            {confirmedEntries.map((row) => {
              const isExpanded = expandedWhyId === row.id;
              return (
                <React.Fragment key={row.id}>
                  <tr className="bg-white hover:bg-[#F7F8FA] transition border-l-2 border-l-emerald-500">
                    <td className="py-2.5 px-4 text-slate-700 whitespace-nowrap">
                      {formatDateHeader(row.date)}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-semibold text-slate-900">{row.project_code}</span>
                      <span className="text-slate-500 text-[11px] block">{row.project_name}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">{row.task}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{row.hours}h</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-lg border ${
                          row.is_billable
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-[#F7F8FA] text-slate-600 border-slate-200'
                        }`}
                      >
                        {row.is_billable ? 'Billable' : 'Non-billable'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Confirmed
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => toggleWhy(row.id)}
                        className={`text-[11px] font-medium px-2 py-1 rounded-lg border transition cursor-pointer inline-flex items-center gap-1 ${
                          isExpanded
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-white text-slate-600 hover:text-blue-600 border-slate-200 hover:border-blue-200'
                        }`}
                      >
                        <span>Why?</span>
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    </td>
                  </tr>
                  {isExpanded && renderInlineWhy(row)}
                </React.Fragment>
              );
            })}

            {/* Empty State */}
            {draftEntries.length === 0 && confirmedEntries.length === 0 && (
              <tr>
                <td colSpan="7" className="py-16 text-center text-slate-400">
                  <Clock className="w-7 h-7 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-medium text-slate-600">No timesheet entries yet</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Use the chat on the left or select a prompt above to stage drafts.
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
