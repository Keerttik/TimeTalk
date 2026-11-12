import React from 'react';
import { X, BarChart3, Download, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useMetrics, formatRoi } from '../store/metricsStore';

export default function AdminMacroModal({ onClose }) {
  const { metrics, teamConsultants, overrideLogs, hourlyRate } = useMetrics();

  const reviewCount = teamConsultants.filter((c) => c.reviewSuggested).length;
  const totalOverrideCount = teamConsultants.reduce(
    (sum, c) => sum + (c.overrideCount || 0),
    0
  );

  const handleExportCSV = () => {
    const rows = [
      ['Section', 'Metric', 'Value'],
      ['Session KPIs', 'Time Saved (Minutes)', metrics.timeSavedMinutes.toFixed(1)],
      ['Session KPIs', 'Session Value (INR)', Math.round(metrics.totalValueRupees)],
      ['Session KPIs', 'Flagged Value Resolved (INR)', Math.round(metrics.leakageCaughtRupees)],
      ['Session KPIs', 'Policy Overrides (Session)', metrics.overrideCount],
      ['Session KPIs', 'Same-Day Logging %', `${metrics.sameDayLoggingPct.toFixed(1)}%`],
      ['Session KPIs', 'Reconstructed %', `${metrics.reconstructedPct.toFixed(1)}%`],
      ['Session KPIs', 'Avg Log Lag (Days)', metrics.avgLogLagDays.toFixed(1)],
      ['Session KPIs', 'Tokens', metrics.totalTokens],
      ['Session KPIs', 'AI Token Cost (INR)', metrics.aiCostRupees.toFixed(2)],
      ['Session KPIs', '20-Day Projected Value (INR)', Math.round(metrics.projectedMonthlyValueRupees)],
      ['Session KPIs', '20-Day Platform + Token Cost (INR)', metrics.fullyLoadedCostRupees.toFixed(2)],
      ['Session KPIs', 'Modeled ROI', metrics.canShowRoi ? formatRoi(metrics.fullyLoadedRoi) : 'Pending 3+ entries'],
      ['Session KPIs', 'Token ROI (Reference)', metrics.canShowRoi ? formatRoi(metrics.tokenRoi) : 'Pending 3+ entries'],
      ['Session KPIs', 'Client Billable Value Logged (Context, not counted in ROI)', Math.round(metrics.billingValueLoggedRupees)],
      [],
      ['Consultant', 'Confirmed Hours', 'Utilization %', 'Edit Rate %', 'Same-Day %', 'Reconstructed %', 'Avg Log Lag (Days)', 'Overrides', 'Review Suggested'],
      ...teamConsultants.map((c) => [
        c.name,
        `${c.confirmedHours.toFixed(1)}h`,
        `${c.utilizationPct}%`,
        `${c.editRatePct}%`,
        `${c.sameDayLoggingPct}%`,
        `${c.reconstructedPct}%`,
        c.avgLogLagDays.toFixed(1),
        c.overrideCount || 0,
        c.reviewSuggested ? `Review suggested (${c.reviewReason})` : 'Clear'
      ])
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', 'TimeTalk_Team_View.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="bg-white rounded-lg border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 text-white rounded-lg">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Team view</h2>
              <p className="text-xs text-slate-500">
                Northwind Consulting (demo data) · Cost vs value, live
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-[#F7F8FA] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs bg-[#F7F8FA]">
          {/* Shared-Store KPI Summary (Identical to Main KPI Cards) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-white border border-slate-200 rounded-lg">
              <span className="text-xs font-medium text-slate-500">Time saved</span>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {metrics.timeSavedMinutes.toFixed(1)}{' '}
                <span className="text-xs font-medium text-slate-500">mins</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Value: <strong className="text-slate-700">₹{Math.round(metrics.valueOfTimeSavedRupees).toLocaleString('en-IN')}</strong>
              </p>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-lg">
              <span className="text-xs font-medium text-slate-500">Flagged value resolved</span>
              <div className="text-xl font-bold text-slate-900 mt-1">
                ₹{Math.round(metrics.leakageCaughtRupees).toLocaleString('en-IN')}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Value of flagged entries the user resolved.
              </p>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-lg">
              <span className="text-xs font-medium text-slate-500">Same-day logging</span>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {metrics.sameDayLoggingPct.toFixed(0)}%
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {metrics.confirmedCount > 0
                  ? `${metrics.sameDayCount} of ${metrics.confirmedCount} entries on work date`
                  : 'Entries logged on work date'}
              </p>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-lg">
              <span className="text-xs font-medium text-slate-500">Modeled ROI</span>
              {metrics.canShowRoi ? (
                <>
                  <div className="text-xl font-bold text-blue-600 mt-1">
                    {formatRoi(metrics.fullyLoadedRoi)}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    AI cost: ₹{metrics.aiCostRupees.toFixed(2)} ({metrics.totalTokens.toLocaleString('en-IN')} tok) · Includes assumed platform cost. Illustrative, not measured.
                  </p>
                </>
              ) : (
                <>
                  <div className="text-base font-semibold text-slate-400 mt-1">Pending</div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    Unlocks at 3 entries ({metrics.confirmedCount}/3) · AI cost: ₹{metrics.aiCostRupees.toFixed(2)}. Illustrative, not measured.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Consultants Table */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-slate-900">
                  Consultant logging discipline ({teamConsultants.length} consultants, Nov 9 to Nov 13)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Review suggested highlights uniform hours on one project logged 5+ days after the work date
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-[#F7F8FA] text-slate-700 border border-slate-200">
                  {totalOverrideCount} {totalOverrideCount === 1 ? 'override' : 'overrides'}
                </span>
                <span className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                  {reviewCount} review suggested
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[#F7F8FA] border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4">Consultant</th>
                    <th className="py-2.5 px-3 text-right">Confirmed hours</th>
                    <th className="py-2.5 px-3 text-right">Utilization</th>
                    <th className="py-2.5 px-3 text-right">Edit rate</th>
                    <th className="py-2.5 px-3 text-right">Same-day %</th>
                    <th className="py-2.5 px-3 text-right">Reconstructed %</th>
                    <th className="py-2.5 px-3 text-right">Avg log lag (days)</th>
                    <th className="py-2.5 px-3 text-right">Overrides</th>
                    <th className="py-2.5 px-4">Review suggested</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {teamConsultants.map((c) => (
                    <tr
                      key={c.id}
                      className={
                        c.reviewSuggested
                          ? 'bg-amber-50/35'
                          : c.isLiveUser
                          ? 'bg-blue-50/30'
                          : 'bg-white hover:bg-[#F7F8FA]'
                      }
                    >
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">{c.name}</span>
                          {c.isLiveUser && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                              Live
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500">{c.role}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
                        {c.confirmedHours.toFixed(1)}h
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-700">
                        {c.utilizationPct.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-700">
                        {c.editRatePct.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-slate-800">
                        {c.sameDayLoggingPct.toFixed(0)}%
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-700">
                        {c.reconstructedPct.toFixed(0)}%
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-700">
                        {c.avgLogLagDays.toFixed(1)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {c.overrideCount > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-semibold text-[11px]">
                            {c.overrideCount}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        {c.reviewSuggested ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 self-start text-[11px] font-medium px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 border border-amber-200">
                              <AlertTriangle className="w-3 h-3 text-amber-700" />
                              Review suggested
                            </span>
                            <span className="text-[10px] text-amber-900">{c.reviewReason}</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
                            <CheckCircle2 className="w-3 h-3 text-slate-400" />
                            Clear
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Session Override Log (shown when Confirm anyway is used) */}
          {overrideLogs.length > 0 && (
            <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <h4 className="font-semibold text-slate-900 text-xs">
                  Logged overrides (this session)
                </h4>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                  {overrideLogs.length} {overrideLogs.length === 1 ? 'override' : 'overrides'}
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {overrideLogs.map((entry) => (
                  <div key={entry.id} className="py-2 flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium text-slate-900">
                        {entry.project_code} · {entry.task} · {entry.hours}h ({entry.date})
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        Reason: "{entry.override_reason}"
                      </div>
                    </div>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-lg bg-[#F7F8FA] text-slate-600 border border-slate-200 shrink-0">
                      {(entry.overridden_rules || []).join(', ') || 'Policy override'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Value Breakdown */}
          <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h4 className="font-semibold text-slate-900 text-xs">Value breakdown</h4>
              <span className="text-[11px] text-slate-500">
                Loaded rate: ₹{hourlyRate.toLocaleString('en-IN')}/hr · 20 working days/mo
              </span>
            </div>

            <div className="divide-y divide-slate-100 text-slate-700">
              <div className="py-2 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">Client billable value logged</span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-lg bg-[#F7F8FA] text-slate-600 border border-slate-200">
                      Context, not counted in ROI
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Confirmed billable project hours in this session
                  </p>
                </div>
                <span className="font-semibold text-slate-900">
                  ₹{Math.round(metrics.billingValueLoggedRupees).toLocaleString('en-IN')}
                </span>
              </div>

              <div className="py-2 flex items-center justify-between">
                <div>
                  <span className="font-medium text-slate-900">Value of time saved (session / 20d projected)</span>
                  <p className="text-[11px] text-slate-500">
                    {metrics.timeSavedMinutes.toFixed(1)} mins saved vs manual entry
                  </p>
                </div>
                <span className="font-semibold text-slate-900">
                  ₹{Math.round(metrics.valueOfTimeSavedRupees).toLocaleString('en-IN')} / ₹{Math.round(metrics.valueOfTimeSavedRupees * 20).toLocaleString('en-IN')}
                </span>
              </div>

              <div className="py-2 flex items-center justify-between">
                <div>
                  <span className="font-medium text-slate-900">Flagged value resolved (session / 20d projected)</span>
                  <p className="text-[11px] text-slate-500">
                    Value of flagged entries the user resolved.
                  </p>
                </div>
                <span className="font-semibold text-slate-900">
                  ₹{Math.round(metrics.leakageCaughtRupees).toLocaleString('en-IN')} / ₹{Math.round(metrics.leakageCaughtRupees * 20).toLocaleString('en-IN')}
                </span>
              </div>

              <div className="py-2 flex items-center justify-between">
                <div>
                  <span className="font-medium text-slate-900">Monthly fully loaded cost</span>
                  <p className="text-[11px] text-slate-500">
                    Token cost (₹{metrics.aiCostRupees.toFixed(2)} x 20 = ₹{metrics.projectedMonthlyTokenCostRupees.toFixed(2)}) + ₹{metrics.fullyLoadedMonthlyCost}/user/mo platform &amp; infra
                  </p>
                </div>
                <span className="font-semibold text-slate-900">
                  ₹{metrics.fullyLoadedCostRupees.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-1.5 bg-white hover:bg-[#F7F8FA] text-slate-700 font-medium rounded-lg text-xs border border-slate-200 flex items-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium cursor-pointer transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
