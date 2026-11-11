import React, { useState } from 'react';
import {
  Check,
  CheckCheck,
  Trash2,
  ChevronDown,
  ChevronUp,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle
} from 'lucide-react';
import AnomalyWarning from './AnomalyWarning';
import { MOCK_CATALOGUE } from '../mockData';

export default function TimesheetGrid({
  draftEntries = [],
  confirmedEntries = [],
  onUpdateDraft,
  onResolveAnomalyFix,
  onConfirmDraft,
  onDiscardDraft,
  onConfirmAll
}) {
  const [expandedWhyId, setExpandedWhyId] = useState(null);
  const [overrideDraftId, setOverrideDraftId] = useState(null);
  const [overrideReason, setOverrideReason] = useState('');
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

  const openOverridePrompt = (draftId) => {
    setOverrideDraftId((prev) => (prev === draftId ? null : draftId));
    setOverrideReason('');
  };

  const submitOverrideConfirm = (e, draft) => {
    e.preventDefault();
    const trimmed = overrideReason.trim();
    if (!trimmed) return;
    onConfirmDraft(draft, trimmed);
    setOverrideDraftId(null);
    setOverrideReason('');
  };

  const cleanDraftCount = draftEntries.filter(
    (d) => !d.anomalies || d.anomalies.length === 0
  ).length;

  const totalDraftHours = draftEntries.reduce((sum, e) => sum + (Number(e.hours) || 0), 0);
  const totalConfirmedHours = confirmedEntries.reduce((sum, e) => sum + (Number(e.hours) || 0), 0);

  const renderInlineWhy = (row) => {
    const trace = row.trace || { model: 'openai/gpt-oss-20b', tokens: 280, latency_ms: 195 };
    const confidencePct = Math.round((row.confidence || 0.9) * 100);
    const overrideRulesText =
      Array.isArray(row.overridden_rules) && row.overridden_rules.length > 0
        ? row.overridden_rules.join(', ')
        : 'Policy warning';

    return (
      <tr className="bg-[#F7F8FA] border-b border-slate-200">
        <td colSpan="7" className="px-4 py-2.5">
          <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2 text-xs">
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

              <div className="flex items-center gap-2 shrink-0 text-[11px] text-slate-600">
                <span className="px-2 py-0.5 rounded-lg bg-[#F7F8FA] border border-slate-200">
                  Confidence: <strong className="text-slate-900">{confidencePct}%</strong>
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-[#F7F8FA] border border-slate-200">
                  Tokens: <strong className="text-slate-900">{trace.tokens ?? 'N/A'}</strong>
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-[#F7F8FA] border border-slate-200">
                  Latency: <strong className="text-slate-900">{trace.latency_ms ?? 'N/A'}ms</strong>
                </span>
              </div>
            </div>

            {row.is_override && (
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-semibold shrink-0">
                    Override logged ({overrideRulesText})
                  </span>
                  <span className="text-slate-700 truncate">
                    Reason: <strong className="text-slate-900">"{row.override_reason}"</strong>
                  </span>
                </div>
                {row.override_timestamp && (
                  <span className="text-slate-400 shrink-0">
                    {new Date(row.override_timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                )}
              </div>
            )}
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
            <p className="text-[11px] text-slate-500">Week of Nov 9 to Nov 15, 2026</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-xs text-slate-500 whitespace-nowrap">
            Confirmed: <strong className="text-slate-900">{totalConfirmedHours}h</strong>
            {draftEntries.length > 0 && (
              <span className="ml-2 text-slate-600">
                Pending: <strong className="text-slate-900">{totalDraftHours}h</strong>
              </span>
            )}
          </div>

          {cleanDraftCount > 0 && (
            <button
              type="button"
              onClick={onConfirmAll}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Confirm all ({cleanDraftCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Table Container (No horizontal scroll at 1440px) */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <table className="w-full table-fixed text-left border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-[#F7F8FA] border-b border-slate-200">
            <tr className="text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
              <th className="py-2.5 pl-4 pr-2 w-[96px]">Date</th>
              <th className="py-2.5 px-2 w-[138px]">Project</th>
              <th className="py-2.5 px-2 w-[104px]">Task</th>
              <th className="py-2.5 px-2 w-[66px]">Hours</th>
              <th className="py-2.5 px-2 w-[96px]">Billing</th>
              <th className="py-2.5 px-2 w-[116px]">Status</th>
              <th className="py-2.5 pl-2 pr-4 w-[210px] text-right">Actions</th>
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
                    <td className="py-2.5 pl-4 pr-2 font-medium text-slate-800 whitespace-nowrap">
                      {formatDateHeader(draft.date)}
                    </td>

                    {/* Project Selector (Code only in dropdown, name in small grey text below) */}
                    <td className="py-2.5 px-2">
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
                        className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 font-semibold text-slate-800 focus:outline-hidden focus:border-blue-600"
                      >
                        {projects.map((p) => (
                          <option key={p.code} value={p.code}>
                            {p.code}
                          </option>
                        ))}
                      </select>
                      <span className="text-[11px] text-slate-500 block mt-0.5 truncate">
                        {selectedProject?.name || draft.project_name}
                      </span>
                    </td>

                    {/* Task Selector */}
                    <td className="py-2.5 px-2">
                      <select
                        value={draft.task}
                        onChange={(e) =>
                          onUpdateDraft(draft.id, { task: e.target.value, user_edited: true })
                        }
                        className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-hidden focus:border-blue-600"
                      >
                        {availableTasks.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Hours */}
                    <td className="py-2.5 px-2">
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
                        className="w-14 bg-white border border-slate-200 rounded-lg px-1.5 py-1 text-center font-semibold text-slate-900 focus:outline-hidden focus:border-blue-600"
                      />
                    </td>

                    {/* Billable Toggle */}
                    <td className="py-2.5 px-2 whitespace-nowrap">
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

                    {/* Row Status (Draft grey vs Needs review amber) */}
                    <td className="py-2.5 px-2 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {needsReview ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-amber-100 text-amber-800 px-2 py-0.5 rounded-lg border border-amber-200 whitespace-nowrap">
                            <AlertTriangle className="w-3 h-3 text-amber-700 shrink-0" />
                            <span>Needs review</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg border border-slate-200 whitespace-nowrap">
                            <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                            <span>Draft</span>
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Actions ("Why?" always visible) */}
                    <td className="py-2.5 pl-2 pr-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => toggleWhy(draft.id)}
                          className={`text-[11px] font-medium px-2 py-1 rounded-lg border transition cursor-pointer inline-flex items-center gap-0.5 whitespace-nowrap shrink-0 ${
                            isExpanded
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-white text-slate-600 hover:text-blue-600 border-slate-200 hover:border-blue-200'
                          }`}
                        >
                          <span>Why?</span>
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                        {needsReview ? (
                          <button
                            type="button"
                            onClick={() => openOverridePrompt(draft.id)}
                            title="Override anomaly and confirm"
                            className={`text-[11px] font-medium px-2 py-1 rounded-lg border transition cursor-pointer whitespace-nowrap shrink-0 ${
                              overrideDraftId === draft.id
                                ? 'bg-amber-600 text-white border-amber-600'
                                : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                            }`}
                          >
                            Confirm anyway
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onConfirmDraft(draft)}
                            title="Confirm entry"
                            className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition cursor-pointer shrink-0"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onDiscardDraft(draft.id)}
                          title="Discard draft"
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-[#F7F8FA] border border-transparent hover:border-slate-200 rounded-lg transition cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Full-width Warning Sub-row beneath Needs review entry */}
                  {needsReview && (
                    <tr className="bg-amber-50/35 border-l-2 border-l-amber-500">
                      <td colSpan="7" className="px-4 pb-2.5 pt-0 space-y-2">
                        <AnomalyWarning
                          anomalies={draft.anomalies}
                          onFix={(fix) => onResolveAnomalyFix(draft, fix)}
                        />

                        {overrideDraftId === draft.id && (
                          <form
                            onSubmit={(e) => submitOverrideConfirm(e, draft)}
                            className="flex items-center gap-2 bg-white border border-amber-200 rounded-lg px-3 py-2 text-xs"
                          >
                            <span className="text-[11px] font-medium text-amber-900 whitespace-nowrap shrink-0">
                              Override reason:
                            </span>
                            <input
                              type="text"
                              autoFocus
                              value={overrideReason}
                              onChange={(e) => setOverrideReason(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                  setOverrideDraftId(null);
                                  setOverrideReason('');
                                }
                              }}
                              placeholder="Enter business reason to log and confirm..."
                              className="flex-1 min-w-0 bg-[#F7F8FA] border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-900 focus:outline-hidden focus:border-amber-500"
                            />
                            <button
                              type="submit"
                              disabled={!overrideReason.trim()}
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white text-[11px] font-medium rounded-lg transition cursor-pointer whitespace-nowrap shrink-0"
                            >
                              Log &amp; confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOverrideDraftId(null);
                                setOverrideReason('');
                              }}
                              className="px-2 py-1 text-slate-600 hover:text-slate-900 text-[11px] font-medium rounded-lg border border-slate-200 hover:bg-[#F7F8FA] transition cursor-pointer whitespace-nowrap shrink-0"
                            >
                              Cancel
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  )}

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
                    <td className="py-2.5 pl-4 pr-2 text-slate-700 whitespace-nowrap">
                      {formatDateHeader(row.date)}
                    </td>
                    <td className="py-2.5 px-2">
                      <span className="font-semibold text-slate-900 block">{row.project_code}</span>
                      <span className="text-slate-500 text-[11px] block truncate">{row.project_name}</span>
                    </td>
                    <td className="py-2.5 px-2 text-slate-700 truncate">{row.task}</td>
                    <td className="py-2.5 px-2 font-semibold text-slate-900 whitespace-nowrap">{row.hours}h</td>
                    <td className="py-2.5 px-2 whitespace-nowrap">
                      <span
                        className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-lg border whitespace-nowrap ${
                          row.is_billable
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-[#F7F8FA] text-slate-600 border-slate-200'
                        }`}
                      >
                        {row.is_billable ? 'Billable' : 'Non-billable'}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 whitespace-nowrap">
                      <div className="flex flex-col items-start gap-1">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200 whitespace-nowrap">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>Confirmed</span>
                        </span>
                        {row.is_override && (
                          <span
                            title={row.override_reason || 'Confirmed with override'}
                            className="inline-flex items-center text-[10px] font-medium text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded-lg border border-amber-200 whitespace-nowrap"
                          >
                            Override
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 pl-2 pr-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => toggleWhy(row.id)}
                        className={`text-[11px] font-medium px-2 py-1 rounded-lg border transition cursor-pointer inline-flex items-center gap-0.5 whitespace-nowrap ${
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
