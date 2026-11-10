import React from 'react';
import { X, CheckCircle, ShieldAlert, Cpu, Sparkles } from 'lucide-react';

export default function WhyTraceModal({ entry, onClose }) {
  if (!entry) return null;

  const trace = entry.trace || {
    model: "gemini-2.5-flash",
    tokens: 280,
    latency_ms: 195
  };

  const confidencePct = Math.round((entry.confidence || 0.90) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">AI Observability Trace</h3>
              <p className="text-xs text-slate-500">Inspection & Audit Reasoning</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Raw Snippet */}
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Raw Input Text</span>
            <div className="mt-1 p-2.5 bg-slate-100 rounded-lg text-slate-800 font-mono text-[11px] border border-slate-200">
              "{entry.raw_input_snippet || 'Manual draft entry'}"
            </div>
          </div>

          {/* Grounding & Matching */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-lg">
              <span className="text-[11px] font-medium text-blue-700 block">Matched Project & Task</span>
              <span className="font-semibold text-slate-900 text-sm mt-0.5 block">
                {entry.project_code} / {entry.task}
              </span>
              <span className="text-slate-600 text-[11px]">{entry.project_name}</span>
            </div>

            <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-lg">
              <span className="text-[11px] font-medium text-emerald-700 block">Confidence Score</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-bold text-slate-900 text-sm">{confidencePct}%</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                  confidencePct >= 80 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {confidencePct >= 80 ? 'High Confidence' : 'Ambiguous'}
                </span>
              </div>
              <span className="text-slate-500 text-[10px]">Threshold: ≥80% for auto-draft</span>
            </div>
          </div>

          {/* Reasoning Narrative */}
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Matching Rationale</span>
            <p className="mt-1 p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 leading-relaxed">
              {entry.reasoning || `Matched activity to ${entry.project_code} catalogue entry based on semantic similarity.`}
            </p>
          </div>

          {/* Rule Evaluation Status */}
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Guardrail Invariants Evaluated</span>
            <div className="mt-1.5 space-y-1">
              <div className="flex items-center justify-between p-1.5 bg-slate-50 rounded border border-slate-100">
                <span className="text-slate-700 font-medium">1. Closed Project Invariant</span>
                {entry.anomalies?.some(a => a.rule_id === 'CLOSED_PROJECT') ? (
                  <span className="text-rose-600 font-bold flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Flagged</span>
                ) : (
                  <span className="text-emerald-600 font-medium flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Passed</span>
                )}
              </div>
              <div className="flex items-center justify-between p-1.5 bg-slate-50 rounded border border-slate-100">
                <span className="text-slate-700 font-medium">2. Internal Non-Billable Invariant</span>
                {entry.anomalies?.some(a => a.rule_id === 'BILLABLE_INTERNAL') ? (
                  <span className="text-amber-600 font-bold flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Flagged</span>
                ) : (
                  <span className="text-emerald-600 font-medium flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Passed</span>
                )}
              </div>
              <div className="flex items-center justify-between p-1.5 bg-slate-50 rounded border border-slate-100">
                <span className="text-slate-700 font-medium">3. Statistical Z-Score Outlier (&gt;10.4h)</span>
                {entry.anomalies?.some(a => a.rule_id === 'UNUSUAL_HOURS') ? (
                  <span className="text-amber-600 font-bold flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Flagged</span>
                ) : (
                  <span className="text-emerald-600 font-medium flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Passed</span>
                )}
              </div>
            </div>
          </div>

          {/* Telemetry Footer */}
          <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-slate-400" />
              Engine: <strong className="text-slate-700 font-semibold">{trace.model}</strong>
            </span>
            <span>Latency: <strong className="text-slate-700 font-semibold">{trace.latency_ms}ms</strong></span>
            <span>Tokens: <strong className="text-slate-700 font-semibold">{trace.tokens}</strong></span>
          </div>
        </div>

        <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold cursor-pointer transition shadow-xs"
          >
            Close Trace
          </button>
        </div>
      </div>
    </div>
  );
}
