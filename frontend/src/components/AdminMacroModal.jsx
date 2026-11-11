import React, { useState, useEffect } from 'react';
import { X, BarChart3, ShieldAlert, Clock, CheckCircle2, Download, Briefcase } from 'lucide-react';
import { formatRoiCap } from './AIValuePanel';

export default function AdminMacroModal({ onClose, liveCostRupees, liveLeakageRupees }) {
  const [metrics, setMetrics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/metrics')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setMetrics(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch team metrics:', err);
        setIsLoading(false);
      });
  }, []);

  const confirmedEntriesCount = metrics?.total_entries_confirmed || 0;
  const effectiveCost =
    typeof liveCostRupees === 'number' && liveCostRupees > 0
      ? liveCostRupees
      : metrics?.estimated_ai_cost_inr || 0;
  const effectiveLeakage = Math.max(
    metrics?.leakage_prevented_inr || 0,
    liveLeakageRupees || 0
  );
  const totalValue = (metrics?.value_of_time_saved_inr || 0) + effectiveLeakage;
  const canShowRoi = confirmedEntriesCount >= 3;
  const roiRatio = effectiveCost > 0 ? totalValue / effectiveCost : totalValue > 0 ? 1000 : 0;
  const roiDisplay = formatRoiCap(roiRatio);

  const handleExportCSV = () => {
    if (!metrics) return;
    const rows = [
      ['Metric', 'Value'],
      ['Organization', metrics.organization],
      ['Period', metrics.sample_period],
      ['Total Conversations', metrics.total_conversations],
      ['Total Hours Logged', metrics.total_hours_logged],
      ['Billable Utilization', `${metrics.billable_utilization_pct}%`],
      ['Edit Rate', `${metrics.edit_rate_pct}%`],
      ['Billing Value Generated', `INR ${metrics.billing_value_generated_inr}`],
      ['Time Saved (Minutes)', metrics.time_saved_minutes],
      ['Value of Time Saved', `INR ${metrics.value_of_time_saved_inr}`],
      ['Leakage Prevented', `INR ${effectiveLeakage}`],
      ['AI Cost', `INR ${effectiveCost.toFixed(2)}`],
      ['Net ROI', canShowRoi ? roiDisplay : 'Pending 3+ entries']
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', 'TimeTalk_Team_Summary.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="bg-white rounded-lg border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
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
          {isLoading ? (
            <div className="py-12 text-center text-slate-500">Loading team metrics...</div>
          ) : (
            <>
              {/* Value, Cost, ROI as Separate Numbers */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-white border border-slate-200 rounded-lg">
                  <span className="text-xs font-medium text-slate-500">Total value</span>
                  <div className="text-2xl font-bold text-slate-900 mt-1">
                    ₹{Math.round(totalValue).toLocaleString('en-IN')}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Time saved + leakage caught
                  </p>
                </div>

                <div className="p-4 bg-white border border-slate-200 rounded-lg">
                  <span className="text-xs font-medium text-slate-500">AI cost</span>
                  <div className="text-2xl font-bold text-slate-900 mt-1">
                    ₹{effectiveCost.toFixed(2)}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Per-token model compute
                  </p>
                </div>

                <div className="p-4 bg-white border border-slate-200 rounded-lg">
                  <span className="text-xs font-medium text-slate-500">Net ROI</span>
                  <div className={`text-2xl font-bold mt-1 ${canShowRoi ? 'text-blue-600' : 'text-slate-300'}`}>
                    {canShowRoi ? roiDisplay : '—'}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {canShowRoi ? 'Capped at 1,000x+' : `Unlocks at 3 entries (${confirmedEntriesCount}/3)`}
                  </p>
                </div>
              </div>

              {/* 4 Core KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-white border border-slate-200 rounded-lg">
                  <div className="flex items-center gap-1.5 text-slate-500 font-medium text-xs">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    <span>Confirmed hours</span>
                  </div>
                  <div className="text-lg font-bold text-slate-900 mt-1">
                    {metrics?.total_hours_logged || 0}h
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {confirmedEntriesCount} confirmed entries
                  </span>
                </div>

                <div className="p-4 bg-white border border-slate-200 rounded-lg">
                  <div className="flex items-center gap-1.5 text-slate-500 font-medium text-xs">
                    <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                    <span>Utilization</span>
                  </div>
                  <div className="text-lg font-bold text-slate-900 mt-1">
                    {metrics?.billable_utilization_pct || 0}%
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {metrics?.billable_hours || 0}h billable / {metrics?.non_billable_hours || 0}h internal
                  </span>
                </div>

                <div className="p-4 bg-white border border-slate-200 rounded-lg">
                  <div className="flex items-center gap-1.5 text-slate-500 font-medium text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Edit rate</span>
                  </div>
                  <div className="text-lg font-bold text-slate-900 mt-1">
                    {metrics?.edit_rate_pct || 0}%
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Target &lt; 15%
                  </span>
                </div>

                <div className="p-4 bg-white border border-slate-200 rounded-lg">
                  <div className="flex items-center gap-1.5 text-slate-500 font-medium text-xs">
                    <ShieldAlert className="w-3.5 h-3.5 text-blue-600" />
                    <span>Leakage caught</span>
                  </div>
                  <div className="text-lg font-bold text-slate-900 mt-1">
                    ₹{Math.round(effectiveLeakage).toLocaleString('en-IN')}
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Closed project blocks
                  </span>
                </div>
              </div>

              {/* Economic Breakdown */}
              <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <h4 className="font-semibold text-slate-900 text-xs">Value breakdown</h4>
                  <span className="text-[11px] text-slate-500">Loaded rate: ₹1,500/hr</span>
                </div>

                <div className="divide-y divide-slate-100 text-slate-700">
                  <div className="py-2 flex items-center justify-between">
                    <div>
                      <span className="font-medium text-slate-900">Client billable value logged</span>
                      <p className="text-[11px] text-slate-500">Confirmed billable project hours</p>
                    </div>
                    <span className="font-semibold text-slate-900">
                      ₹{(metrics?.billing_value_generated_inr || 0).toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="py-2 flex items-center justify-between">
                    <div>
                      <span className="font-medium text-slate-900">Value of time saved</span>
                      <p className="text-[11px] text-slate-500">
                        {metrics?.time_saved_minutes || 0} mins saved vs manual entry
                      </p>
                    </div>
                    <span className="font-semibold text-slate-900">
                      ₹{(metrics?.value_of_time_saved_inr || 0).toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="py-2 flex items-center justify-between">
                    <div>
                      <span className="font-medium text-slate-900">Disputed invoice leakage blocked</span>
                      <p className="text-[11px] text-slate-500">
                        Invalid billing caught before submission
                      </p>
                    </div>
                    <span className="font-semibold text-slate-900">
                      ₹{Math.round(effectiveLeakage).toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="py-2 flex items-center justify-between">
                    <div>
                      <span className="font-medium text-slate-900">AI compute cost</span>
                      <p className="text-[11px] text-slate-500">Computed from per-token model pricing</p>
                    </div>
                    <span className="font-semibold text-slate-900">
                      ₹{effectiveCost.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between">
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
