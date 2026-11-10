import React from 'react';
import { AlertTriangle, AlertOctagon, CheckCircle2 } from 'lucide-react';

export default function AnomalyWarning({ anomalies = [], onFix }) {
  if (!anomalies || anomalies.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 mt-1">
      {anomalies.map((anomaly, idx) => {
        const isError = anomaly.severity === 'error';
        return (
          <div
            key={idx}
            className={`flex items-center justify-between text-xs px-2.5 py-1.5 rounded border ${
              isError
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            <div className="flex items-center gap-1.5 flex-1">
              {isError ? (
                <AlertOctagon className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              )}
              <span className="font-medium">{anomaly.message}</span>
            </div>

            {anomaly.suggested_fix && onFix && (
              <button
                type="button"
                onClick={() => onFix(anomaly.suggested_fix)}
                className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded shadow-xs cursor-pointer transition whitespace-nowrap ${
                  isError
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'bg-amber-600 hover:bg-amber-700 text-white'
                }`}
              >
                {anomaly.suggested_fix.action === 'set_non_billable'
                  ? 'Switch Non-Billable'
                  : anomaly.suggested_fix.action === 'change_project'
                  ? 'Change to Internal'
                  : anomaly.suggested_fix.action === 'adjust_hours'
                  ? `Set to ${anomaly.suggested_fix.value}h`
                  : 'Auto-Fix'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

