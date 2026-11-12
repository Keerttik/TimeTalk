import React, { useState } from 'react';
import { Clock, ShieldCheck, CalendarCheck2, TrendingUp, Calculator, ChevronDown, ChevronUp } from 'lucide-react';
import { useMetrics, formatRoi } from '../store/metricsStore';

export default function AIValuePanel() {
  const {
    metrics,
    hourlyRate,
    fullyLoadedMonthlyCost,
    setFullyLoadedMonthlyCost
  } = useMetrics();
  const [showAssumptions, setShowAssumptions] = useState(false);

  return (
    <div className="shrink-0 flex flex-col gap-2">
      {/* Section Subtitle + Assumptions Toggle */}
      <div className="flex items-center justify-between px-0.5">
        <span className="text-xs font-medium text-slate-500">Cost vs value, live</span>

        <button
          type="button"
          onClick={() => setShowAssumptions((prev) => !prev)}
          className="text-xs text-slate-500 hover:text-blue-600 flex items-center gap-1 font-medium cursor-pointer transition"
        >
          <Calculator className="w-3.5 h-3.5" />
          <span>Assumptions</span>
          {showAssumptions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Expandable Assumptions Drawer */}
      {showAssumptions && (
        <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs text-slate-600 flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-[11px] bg-[#F7F8FA] border border-slate-200 px-2.5 py-1 rounded-lg text-slate-800">
              Modeled ROI = (session value x 20) / (token cost x 20 + platform cost per user per month)
            </span>
            <div className="flex items-center gap-2 text-[11px] bg-[#F7F8FA] border border-slate-200 px-2.5 py-1 rounded-lg">
              <span className="text-slate-500">Token ROI:</span>
              <strong className="text-slate-900">
                {metrics.canShowRoi ? formatRoi(metrics.tokenRoi) : 'Pending (3+ entries)'}
              </strong>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-[11px]">
            <div className="flex flex-col gap-0.5">
              <span className="text-slate-600">
                Assumes session value and usage stay steady across 20 working days.
              </span>
              <span className="text-slate-500 italic">
                Token cost is negligible; fully loaded cost is the real test.
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-1.5 text-slate-600">
                <span>Platform cost (₹/user/mo):</span>
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={fullyLoadedMonthlyCost}
                  onChange={(e) => setFullyLoadedMonthlyCost(Math.max(0, Number(e.target.value) || 0))}
                  className="w-16 px-2 py-0.5 bg-[#F7F8FA] border border-slate-200 rounded-lg text-slate-900 font-semibold text-center focus:outline-hidden focus:border-blue-600"
                />
              </label>
              <span>
                Rate: <strong className="text-slate-900">₹{hourlyRate.toLocaleString('en-IN')}/hr</strong>
              </span>
              <span>
                Baseline: <strong className="text-slate-900">2.0 min/entry</strong>
              </span>
              <span>
                Model: <strong className="text-slate-900">{metrics.activeModel}</strong>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Strip of 4 KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {/* 1. Time saved */}
        <div className="p-4 bg-white rounded-lg border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Time saved</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-slate-900 tracking-tight">
              {metrics.timeSavedMinutes.toFixed(1)}{' '}
              <span className="text-xs font-medium text-slate-500">mins</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Value:{' '}
              <span className="font-semibold text-slate-700">
                ₹{Math.round(metrics.valueOfTimeSavedRupees).toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Flagged value resolved */}
        <div className="p-4 bg-white rounded-lg border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Flagged value resolved</span>
            <ShieldCheck className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-slate-900 tracking-tight">
              ₹{Math.round(metrics.leakageCaughtRupees).toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Value of flagged entries the user resolved.
            </div>
          </div>
        </div>

        {/* 3. Same-day logging */}
        <div className="p-4 bg-white rounded-lg border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Same-day logging</span>
            <CalendarCheck2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-slate-900 tracking-tight">
              {metrics.sameDayLoggingPct.toFixed(0)}%
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {metrics.confirmedCount > 0
                ? `${metrics.sameDayCount} of ${metrics.confirmedCount} entries on work date`
                : 'Entries logged on work date'}
            </div>
          </div>
        </div>

        {/* 4. Modeled ROI (includes AI cost in subtitle) */}
        <div className="p-4 bg-white rounded-lg border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Modeled ROI</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2">
            {metrics.canShowRoi ? (
              <>
                <div className="text-xl font-bold text-blue-600 tracking-tight">
                  {formatRoi(metrics.fullyLoadedRoi)}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  AI cost: ₹{metrics.aiCostRupees.toFixed(2)} ({metrics.totalTokens.toLocaleString('en-IN')} tok) · Includes assumed platform cost. Illustrative, not measured.
                </div>
              </>
            ) : (
              <>
                <div className="text-base font-semibold text-slate-400 tracking-tight">Pending</div>
                <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Unlocks at 3 entries ({metrics.confirmedCount}/3) · AI cost: ₹{metrics.aiCostRupees.toFixed(2)}. Illustrative, not measured.
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
