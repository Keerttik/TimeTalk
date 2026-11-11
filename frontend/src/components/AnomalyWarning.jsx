import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function AnomalyWarning({ anomalies = [], onFix }) {
  if (!anomalies || anomalies.length === 0) return null;

  const getFixLabel = (fix) => {
    if (!fix) return 'Fix';
    if (fix.action === 'set_non_billable') return 'Switch non-billable';
    if (fix.action === 'change_project') return 'Move to internal';
    if (fix.action === 'adjust_hours') return `Set to ${fix.value}h`;
    if (fix.action === 'remove_duplicate') return 'Remove duplicate';
    return 'Fix';
  };

  return (
    <div className="flex flex-col gap-1.5">
      {anomalies.map((anomaly, idx) => (
        <div
          key={`${anomaly.rule_id || 'rule'}_${idx}`}
          className="flex items-center justify-between gap-3 text-xs px-3 py-1.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-200"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="font-medium truncate">{anomaly.message}</span>
          </div>

          {anomaly.suggested_fix && onFix && (
            <button
              type="button"
              onClick={() => onFix(anomaly.suggested_fix)}
              className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 cursor-pointer transition whitespace-nowrap shrink-0"
            >
              {getFixLabel(anomaly.suggested_fix)}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
