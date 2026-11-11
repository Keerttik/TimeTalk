import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function AnomalyWarning({ anomalies = [], onFix }) {
  if (!anomalies || anomalies.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 mt-1.5">
      {anomalies.map((anomaly, idx) => (
        <div
          key={idx}
          className="flex items-center justify-between gap-2 text-[11px] px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-200"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="font-medium leading-snug">{anomaly.message}</span>
          </div>

          {anomaly.suggested_fix && onFix && (
            <button
              type="button"
              onClick={() => onFix(anomaly.suggested_fix)}
              className="text-[11px] font-medium px-2 py-0.5 rounded-lg bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 cursor-pointer transition whitespace-nowrap shrink-0"
            >
              {anomaly.suggested_fix.action === 'set_non_billable'
                ? 'Switch non-billable'
                : anomaly.suggested_fix.action === 'change_project'
                ? 'Move to internal'
                : anomaly.suggested_fix.action === 'adjust_hours'
                ? `Set to ${anomaly.suggested_fix.value}h`
                : 'Fix'}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
