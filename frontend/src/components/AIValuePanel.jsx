import React, { useState } from 'react';
import { DollarSign, Clock, ShieldCheck, TrendingUp, Info, ChevronDown, ChevronUp, Cpu } from 'lucide-react';

export default function AIValuePanel({
  telemetryHistory = [],
  confirmedCount = 0,
  leakageCaughtRupees = 0,
  chatSeconds = 25
}) {
  const [showAssumptions, setShowAssumptions] = useState(false);

  // Baseline parameters
  const LOADED_HOURLY_COST = 1500; // INR/hr
  const MANUAL_BASELINE_MINUTES_PER_ENTRY = 2.0; // 2 mins per manual entry
  const GEMINI_COST_PER_MILLION_TOKENS_INR = 8.0; // ₹8 per 1M tokens

  // Total tokens
  const totalTokens = telemetryHistory.reduce(
    (sum, t) => sum + (t.input_tokens || 0) + (t.output_tokens || 0),
    0
  );

  // AI Cost in INR
  const aiCostRupees = (totalTokens / 1_000_000) * GEMINI_COST_PER_MILLION_TOKENS_INR;
  const aiCostPaise = Math.round(aiCostRupees * 100);

  // Time Saved
  const manualMinutes = confirmedCount * MANUAL_BASELINE_MINUTES_PER_ENTRY;
  const chatMinutes = chatSeconds / 60;
  const timeSavedMinutes = Math.max(0, Math.round((manualMinutes - (confirmedCount > 0 ? chatMinutes : 0)) * 10) / 10);

  // Value of Time Saved
  const valueOfTimeSavedRupees = (timeSavedMinutes / 60) * LOADED_HOURLY_COST;

  // Total Economic Value & ROI
  const totalValueRupees = valueOfTimeSavedRupees + leakageCaughtRupees;
  const effectiveCost = Math.max(aiCostRupees, 0.005);
  const liveROI = Math.round(totalValueRupees / effectiveCost);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-indigo-600 text-white flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800">Live AI Value & ROI</h3>
            <span className="text-[10px] text-slate-500">Real-Time Economic Telemetry</span>
          </div>
        </div>

        <button
          onClick={() => setShowAssumptions(!showAssumptions)}
          className="text-[10px] text-slate-500 hover:text-indigo-600 flex items-center gap-0.5 font-medium cursor-pointer"
        >
          <Info className="w-3 h-3" />
          <span>Assumptions</span>
          {showAssumptions ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Assumptions Drawer */}
      {showAssumptions && (
        <div className="px-4 py-2.5 bg-indigo-50/50 border-b border-indigo-100 text-[11px] text-slate-600 space-y-1">
          <p className="font-semibold text-indigo-900">Configurable Enterprise Parameters:</p>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <div>• Loaded Cost: <strong>₹1,500/hr</strong></div>
            <div>• Manual Baseline: <strong>2.0 min/entry</strong></div>
            <div>• Model: <strong>Gemini 2.5 Flash</strong></div>
            <div>• Model Pricing: <strong>₹8 / 1M tokens</strong></div>
          </div>
        </div>
      )}

      {/* Key Metric Tiles */}
      <div className="p-4 grid grid-cols-2 gap-3">
        {/* Live ROI Tile */}
        <div className="col-span-2 p-3 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl text-white shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-100">Live Session ROI</span>
            <div className="text-2xl font-black mt-0.5">
              {liveROI > 0 ? `${liveROI}x` : '0x'}
            </div>
            <span className="text-[10px] text-indigo-200">
              ₹{Math.round(totalValueRupees).toLocaleString('en-IN')} value created vs ₹{aiCostRupees.toFixed(3)} cost
            </span>
          </div>
          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6 text-indigo-100" />
          </div>
        </div>

        {/* Time Saved */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-medium">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            <span>Time Saved</span>
          </div>
          <div className="text-base font-bold text-slate-900 mt-1">
            {timeSavedMinutes} <span className="text-xs font-normal text-slate-500">mins</span>
          </div>
          <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
            +₹{Math.round(valueOfTimeSavedRupees).toLocaleString('en-IN')} capacity
          </div>
        </div>

        {/* Leakage Caught */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-rose-600" />
            <span>Leakage Saved</span>
          </div>
          <div className="text-base font-bold text-slate-900 mt-1">
            ₹{leakageCaughtRupees.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-500 font-medium mt-0.5">
            In disputed invoices
          </div>
        </div>

        {/* Tokens & Inference Cost */}
        <div className="col-span-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-slate-400" />
            <span>Tokens: <strong className="text-slate-700">{totalTokens}</strong></span>
          </div>
          <div>
            AI Cost: <strong className="text-slate-800">₹{aiCostRupees.toFixed(4)}</strong> ({aiCostPaise} paise)
          </div>
        </div>
      </div>
    </div>
  );
}

