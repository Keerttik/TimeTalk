import React, { useState } from 'react';
import { Clock, ShieldCheck, Cpu, TrendingUp, Calculator, ChevronDown, ChevronUp } from 'lucide-react';

// Real per-1M-token model pricing in INR (USD * 85)
export const MODEL_PRICING_INR_PER_1M = {
  'openai/gpt-oss-20b': { input: 6.38, output: 25.5, label: 'GPT-OSS 20B (Groq)' },
  'openai/gpt-oss-120b': { input: 12.75, output: 51.0, label: 'GPT-OSS 120B (Groq)' },
  'llama-3.3-70b-versatile': { input: 50.15, output: 67.15, label: 'LLaMA 3.3 70B (Groq)' },
  'gemini-2.5-flash': { input: 25.5, output: 212.5, label: 'Gemini 2.5 Flash' },
  'localllm-hybrid-v1': { input: 0, output: 0, label: 'Local Rules Fallback' }
};

const DEFAULT_PRICING = { input: 10.0, output: 40.0, label: 'Standard Model' };

export function calculateAiCostInr(telemetryHistory = []) {
  return telemetryHistory.reduce((sum, t) => {
    const pricing = MODEL_PRICING_INR_PER_1M[t.model] || DEFAULT_PRICING;
    const inCost = ((t.input_tokens || 0) / 1_000_000) * pricing.input;
    const outCost = ((t.output_tokens || 0) / 1_000_000) * pricing.output;
    return sum + inCost + outCost;
  }, 0);
}

export function formatRoiCap(rawRoi) {
  if (!Number.isFinite(rawRoi) || rawRoi <= 0) return '0x';
  if (rawRoi >= 1000) return '1,000x+';
  return `${Math.round(rawRoi).toLocaleString('en-IN')}x`;
}

export default function AIValuePanel({
  telemetryHistory = [],
  confirmedCount = 0,
  leakageCaughtRupees = 0,
  chatSeconds = 25,
  hourlyRate = 1500
}) {
  const [showAssumptions, setShowAssumptions] = useState(false);

  const MANUAL_BASELINE_MINUTES_PER_ENTRY = 2.0;

  const totalTokens = telemetryHistory.reduce(
    (sum, t) => sum + (t.input_tokens || 0) + (t.output_tokens || 0),
    0
  );

  // Real per-token model cost in INR
  const aiCostRupees = calculateAiCostInr(telemetryHistory);

  // Time Saved & Value
  const manualMinutes = confirmedCount * MANUAL_BASELINE_MINUTES_PER_ENTRY;
  const chatMinutes = chatSeconds / 60;
  const timeSavedMinutes = Math.max(
    0,
    Math.round((manualMinutes - (confirmedCount > 0 ? chatMinutes : 0)) * 10) / 10
  );
  const valueOfTimeSavedRupees = (timeSavedMinutes / 60) * hourlyRate;

  // Total Value vs Cost & ROI
  const totalValueRupees = valueOfTimeSavedRupees + leakageCaughtRupees;
  const canShowRoi = confirmedCount >= 3;
  const rawRoi = aiCostRupees > 0 ? totalValueRupees / aiCostRupees : totalValueRupees > 0 ? 1000 : 0;
  const roiDisplay = formatRoiCap(rawRoi);

  const activeModel =
    telemetryHistory.length > 0
      ? telemetryHistory[telemetryHistory.length - 1].model
      : 'openai/gpt-oss-20b';

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
        <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-3">
          <div className="font-mono text-[11px] bg-[#F7F8FA] border border-slate-200 px-2.5 py-1 rounded-lg text-slate-800">
            ROI = (Value of time saved + Leakage caught) / AI cost
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[11px]">
            <span>
              Rate: <strong className="text-slate-900">₹{hourlyRate.toLocaleString('en-IN')}/hr</strong>
            </span>
            <span>
              Baseline: <strong className="text-slate-900">2.0 min/entry</strong>
            </span>
            <span>
              Model: <strong className="text-slate-900">{activeModel}</strong>
            </span>
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
              {timeSavedMinutes.toFixed(1)} <span className="text-xs font-medium text-slate-500">mins</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Value: <span className="font-semibold text-slate-700">₹{Math.round(valueOfTimeSavedRupees).toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* 2. Leakage caught */}
        <div className="p-4 bg-white rounded-lg border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Leakage caught</span>
            <ShieldCheck className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-slate-900 tracking-tight">
              ₹{Math.round(leakageCaughtRupees).toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Blocked invalid billing
            </div>
          </div>
        </div>

        {/* 3. AI cost */}
        <div className="p-4 bg-white rounded-lg border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>AI cost</span>
            <Cpu className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-slate-900 tracking-tight">
              ₹{aiCostRupees.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {totalTokens.toLocaleString('en-IN')} tokens used
            </div>
          </div>
        </div>

        {/* 4. ROI (Hidden until 3+ confirmed entries, capped at 1,000x+, separate Value/Cost/ROI) */}
        <div className="p-4 bg-white rounded-lg border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>ROI</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2">
            {canShowRoi ? (
              <>
                <div className="text-xl font-bold text-blue-600 tracking-tight">
                  {roiDisplay}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                  Value ₹{Math.round(totalValueRupees).toLocaleString('en-IN')} · Cost ₹{aiCostRupees.toFixed(2)}
                </div>
              </>
            ) : (
              <>
                <div className="text-xl font-bold text-slate-300 tracking-tight">—</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Unlocks at 3 entries ({confirmedCount}/3)
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
