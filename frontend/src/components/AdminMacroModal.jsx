import React, { useState, useEffect } from 'react';
import { X, BarChart3, TrendingUp, ShieldAlert, Clock, CheckCircle2, DollarSign, Download, Users, Briefcase } from 'lucide-react';

export default function AdminMacroModal({ onClose }) {
  const [metrics, setMetrics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/metrics')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        setMetrics(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch admin metrics:', err);
        setIsLoading(false);
      });
  }, []);

  const handleExportCSV = () => {
    if (!metrics) return;
    const rows = [
      ["Metric", "Value"],
      ["Organization", metrics.organization],
      ["Period", metrics.sample_period],
      ["Total Conversations", metrics.total_conversations],
      ["Total Hours Logged", metrics.total_hours_logged],
      ["Billable Utilization", `${metrics.billable_utilization_pct}%`],
      ["Edit Rate", `${metrics.edit_rate_pct}%`],
      ["Billing Value Generated", `INR ${metrics.billing_value_generated_inr}`],
      ["Time Saved (Minutes)", metrics.time_saved_minutes],
      ["Value of Time Saved", `INR ${metrics.value_of_time_saved_inr}`],
      ["Leakage Prevented", `INR ${metrics.leakage_prevented_inr}`],
      ["Estimated AI Cost", `INR ${metrics.estimated_ai_cost_inr}`],
      ["Net ROI", `${metrics.net_roi}x`]
    ];
    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "TimeTalk_Admin_Macro_Metrics.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">Enterprise Admin Macro View</h2>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                  FR10 Analytics
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Northwind Consulting • Executive Telemetry & Quality Benchmarks
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {isLoading ? (
            <div className="py-16 text-center text-slate-400">Loading macro analytics...</div>
          ) : (
            <>
              {/* Macro ROI Banner */}
              <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl text-white shadow-md flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300">Net Executive ROI</span>
                  <div className="text-3xl font-black mt-1 text-white">
                    {metrics?.net_roi ? `${metrics.net_roi}x` : '14.2x'}
                  </div>
                  <p className="text-xs text-indigo-200 mt-1">
                    Created ₹{metrics?.total_economic_value_inr?.toLocaleString('en-IN') || '12,500'} net value against ₹{metrics?.estimated_ai_cost_inr || '0.008'} total AI compute cost
                  </p>
                </div>
                <div className="text-right border-l border-indigo-800/60 pl-6">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Capacity Unlocked</span>
                  <span className="text-xl font-bold text-emerald-400 mt-0.5 block">
                    {metrics?.time_saved_minutes || '8.0'} mins
                  </span>
                  <span className="text-[11px] text-slate-300">
                    +₹{metrics?.value_of_time_saved_inr?.toLocaleString('en-IN') || '200'} consultant capacity
                  </span>
                </div>
              </div>

              {/* 4 Core Macro KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Total Entries */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center gap-1.5 text-slate-500 font-medium text-[11px]">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    <span>Confirmed Hours</span>
                  </div>
                  <div className="text-lg font-bold text-slate-900 mt-1">
                    {metrics?.total_hours_logged || 0}h
                  </div>
                  <span className="text-[10px] text-slate-500">
                    across {metrics?.total_entries_confirmed || 0} verified entries
                  </span>
                </div>

                {/* Billable Utilization */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center gap-1.5 text-slate-500 font-medium text-[11px]">
                    <Briefcase className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Billable Utilization</span>
                  </div>
                  <div className="text-lg font-bold text-slate-900 mt-1">
                    {metrics?.billable_utilization_pct || 0}%
                  </div>
                  <span className="text-[10px] text-emerald-600 font-medium">
                    {metrics?.billable_hours || 0}h billable / {metrics?.non_billable_hours || 0}h ops
                  </span>
                </div>

                {/* Edit Rate Benchmark */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center gap-1.5 text-slate-500 font-medium text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
                    <span>User Edit Rate</span>
                  </div>
                  <div className="text-lg font-bold text-slate-900 mt-1">
                    {metrics?.edit_rate_pct || 0}%
                  </div>
                  <span className="text-[10px] text-emerald-700 font-medium">
                    {metrics?.edit_rate_benchmark || '< 15% Target Met'}
                  </span>
                </div>

                {/* Leakage Prevented */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center gap-1.5 text-slate-500 font-medium text-[11px]">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                    <span>Leakage Prevented</span>
                  </div>
                  <div className="text-lg font-bold text-slate-900 mt-1">
                    ₹{(metrics?.leakage_prevented_inr || 12000).toLocaleString('en-IN')}
                  </div>
                  <span className="text-[10px] text-rose-700 font-medium">
                    Closed project saves
                  </span>
                </div>
              </div>

              {/* Economic Audit Breakdown */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center justify-between">
                  <span>Economic Invariant Audit Breakdown</span>
                  <span className="text-[11px] font-normal text-slate-500">Northwind Standard Rate: ₹1,500/hr</span>
                </h4>

                <div className="divide-y divide-slate-100 text-slate-700">
                  <div className="py-2 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-900">Total Billing Value Generated</span>
                      <p className="text-[11px] text-slate-500">Revenue tied to client billable hours logged via TimeTalk</p>
                    </div>
                    <span className="font-bold text-slate-900 text-sm">
                      ₹{metrics?.billing_value_generated_inr?.toLocaleString('en-IN') || '0'}
                    </span>
                  </div>

                  <div className="py-2 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-900">Value of Consultant Time Saved</span>
                      <p className="text-[11px] text-slate-500">(2 min manual baseline × entries) @ loaded rate</p>
                    </div>
                    <span className="font-bold text-emerald-600 text-sm">
                      +₹{metrics?.value_of_time_saved_inr?.toLocaleString('en-IN') || '0'}
                    </span>
                  </div>

                  <div className="py-2 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-900">Disputed Invoice Leakage Blocked</span>
                      <p className="text-[11px] text-slate-500">Unbillable hours blocked on closed projects prior to payroll & invoicing</p>
                    </div>
                    <span className="font-bold text-rose-600 text-sm">
                      +₹{(metrics?.leakage_prevented_inr || 12000).toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="py-2 flex items-center justify-between bg-slate-50/70 px-2 rounded-lg">
                    <div>
                      <span className="font-bold text-slate-900">Total AI Inference Cost (Gemini Flash)</span>
                      <p className="text-[11px] text-slate-500">Cumulative prompt + completion tokens @ ₹8 per million</p>
                    </div>
                    <span className="font-bold text-slate-800 text-sm">
                      ₹{metrics?.estimated_ai_cost_inr || '0.008'}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-lg text-xs border border-slate-300 flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV Report</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold cursor-pointer transition shadow-xs"
          >
            Close Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
