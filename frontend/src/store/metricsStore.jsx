import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { MOCK_CATALOGUE, TEAM_CONSULTANTS_SEED } from '../mockData';

// Real per-1M-token model pricing in INR (USD * 85)
export const MODEL_PRICING_INR_PER_1M = {
  'openai/gpt-oss-20b': { input: 6.38, output: 25.5, label: 'GPT-OSS 20B (Groq)' },
  'openai/gpt-oss-120b': { input: 12.75, output: 51.0, label: 'GPT-OSS 120B (Groq)' },
  'llama-3.3-70b-versatile': { input: 50.15, output: 67.15, label: 'LLaMA 3.3 70B (Groq)' },
  'gemini-2.5-flash': { input: 25.5, output: 212.5, label: 'Gemini 2.5 Flash' },
  'localllm-hybrid-v1': { input: 0, output: 0, label: 'Local Rules Fallback' }
};

const DEFAULT_PRICING = { input: 10.0, output: 40.0, label: 'Standard Model' };
export const WORKING_DAYS_PER_MONTH = 20;

export const INITIAL_GREETING_MESSAGE = {
  sender: 'bot',
  text: "Hi Priya, tell me what you worked on yesterday or this week in plain English, and I'll prepare draft entries for your review.",
  timestamp: 'Today'
};

// Seeded demo state: 1 Needs review (amber, closed INITECH-AUD) + 1 Draft (grey)
export const INITIAL_SEED_DRAFTS = [
  {
    id: 'seed_initech_1',
    date: '2026-11-10',
    project_code: 'INITECH-AUD',
    project_name: 'Initech Audit Support',
    task: 'Fieldwork',
    hours: 4,
    is_billable: true,
    status: 'draft',
    user_edited: false,
    confidence: 0.95,
    reasoning: 'Matched "Initech fieldwork" to INITECH-AUD / Fieldwork from Northwind catalogue.',
    raw_input_snippet: '4 hours on Initech fieldwork today, billable.',
    anomalies: [
      {
        rule_id: 'CLOSED_PROJECT',
        severity: 'error',
        message: 'This project closed on 31 Oct. Time cannot be billed.',
        suggested_fix: {
          action: 'change_project',
          value: 'INT-OPS'
        }
      }
    ],
    trace: {
      model: 'openai/gpt-oss-20b',
      tokens: 1120,
      latency_ms: 410
    }
  },
  {
    id: 'seed_acme_2',
    date: '2026-11-09',
    project_code: 'ACME-WEB',
    project_name: 'Acme Website Redesign',
    task: 'Design',
    hours: 3,
    is_billable: true,
    status: 'draft',
    user_edited: false,
    confidence: 0.92,
    reasoning: 'Matched "Acme design review" to ACME-WEB / Design.',
    raw_input_snippet: '3 hours on Acme design review yesterday.',
    anomalies: [],
    trace: {
      model: 'openai/gpt-oss-20b',
      tokens: 1072,
      latency_ms: 380
    }
  }
];

export const INITIAL_SEED_TELEMETRY = [
  {
    model: 'openai/gpt-oss-20b',
    input_tokens: 742,
    output_tokens: 1450,
    latency_ms: 410
  }
];

// Disputed billing prevented starts at 0 and increments only when the user resolves an anomaly
export const INITIAL_SEED_LEAKAGE_INR = 0;

const PROJECTS_BY_CODE = Object.fromEntries(
  MOCK_CATALOGUE.projects.map((p) => [p.code, p])
);

function formatHoursCompact(hours) {
  const n = Number(hours) || 0;
  return Number.isInteger(n) ? `${n}h` : `${n.toFixed(1)}h`;
}

export function reconcileDraftDuplicates(drafts = [], confirmed = []) {
  return drafts.map((draft) => {
    const existingAnomalies = (draft.anomalies || []).filter(
      (a) => a.rule_id !== 'DUPLICATE'
    );
    const matchingConfirmed = confirmed.find(
      (c) =>
        c.date === draft.date &&
        c.project_code === draft.project_code &&
        (c.task || '').toLowerCase() === (draft.task || '').toLowerCase()
    );

    if (!matchingConfirmed) {
      return {
        ...draft,
        anomalies: existingAnomalies
      };
    }

    const dupAnomaly = {
      rule_id: 'DUPLICATE',
      severity: 'warning',
      message: `Already logged ${formatHoursCompact(matchingConfirmed.hours)} here`,
      suggested_fix: {
        action: 'remove_duplicate',
        value: draft.id
      }
    };

    return {
      ...draft,
      anomalies: [...existingAnomalies, dupAnomaly]
    };
  });
}

function getPreventedBillingForDraft(draft, ruleIdsToCount = ['CLOSED_PROJECT', 'DUPLICATE']) {
  if (!draft || !draft.is_billable) return 0;
  const anomalies = draft.anomalies || [];
  const hasCountable = anomalies.some((a) => ruleIdsToCount.includes(a.rule_id));
  if (!hasCountable) return 0;
  const proj = PROJECTS_BY_CODE[draft.project_code];
  const rate = proj?.bill_rate || 0;
  return (Number(draft.hours) || 0) * rate;
}

export function normalizeTelemetry(rawTelemetry, draftEntries = []) {
  if (!rawTelemetry || typeof rawTelemetry !== 'object') {
    if (!draftEntries || draftEntries.length === 0) return null;
    const traceTokens = draftEntries.reduce((sum, e) => sum + (Number(e?.trace?.tokens) || 0), 0);
    const total = traceTokens > 0 ? traceTokens : draftEntries.length * 420;
    return {
      model: draftEntries[0]?.trace?.model || 'openai/gpt-oss-20b',
      input_tokens: Math.round(total * 0.4),
      output_tokens: Math.round(total * 0.6),
      latency_ms: Number(draftEntries[0]?.trace?.latency_ms) || 350
    };
  }

  let inputTokens = Number(
    rawTelemetry.input_tokens ?? rawTelemetry.prompt_tokens ?? rawTelemetry.promptTokenCount ?? 0
  );
  let outputTokens = Number(
    rawTelemetry.output_tokens ??
      rawTelemetry.completion_tokens ??
      rawTelemetry.candidatesTokenCount ??
      0
  );

  const totalField = Number(rawTelemetry.total_tokens ?? rawTelemetry.tokens ?? 0);
  if (inputTokens <= 0 && outputTokens <= 0) {
    if (totalField > 0) {
      inputTokens = Math.round(totalField * 0.4);
      outputTokens = Math.max(1, totalField - inputTokens);
    } else {
      const traceTotal = draftEntries.reduce((sum, e) => sum + (Number(e?.trace?.tokens) || 0), 0);
      const fallbackTotal = traceTotal > 0 ? traceTotal : 360 + draftEntries.length * 120;
      inputTokens = Math.round(fallbackTotal * 0.45);
      outputTokens = Math.max(1, fallbackTotal - inputTokens);
    }
  }

  return {
    model: rawTelemetry.model || 'openai/gpt-oss-20b',
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    latency_ms: Number(rawTelemetry.latency_ms) || 250
  };
}

export function calculateAiCostInr(telemetryHistory = []) {
  return telemetryHistory.reduce((sum, t) => {
    const pricing = MODEL_PRICING_INR_PER_1M[t.model] || DEFAULT_PRICING;
    const inCost = ((Number(t.input_tokens) || 0) / 1_000_000) * pricing.input;
    const outCost = ((Number(t.output_tokens) || 0) / 1_000_000) * pricing.output;
    return sum + inCost + outCost;
  }, 0);
}

export function formatRoi(rawRoi) {
  if (!Number.isFinite(rawRoi) || rawRoi <= 0) return '0x';
  if (rawRoi < 10) return `${rawRoi.toFixed(1)}x`;
  return `${Math.round(rawRoi).toLocaleString('en-IN')}x`;
}

export function computeSharedMetrics({
  confirmedEntries = [],
  telemetryHistory = [],
  leakageCaughtRupees = 0,
  chatSeconds = 25,
  hourlyRate = 1500,
  fullyLoadedMonthlyCost = 40
}) {
  const confirmedCount = confirmedEntries.length;
  const totalConfirmedHours = confirmedEntries.reduce((sum, e) => sum + (Number(e.hours) || 0), 0);
  const billableHours = confirmedEntries.reduce(
    (sum, e) => sum + (e.is_billable ? Number(e.hours) || 0 : 0),
    0
  );
  const nonBillableHours = Math.max(0, totalConfirmedHours - billableHours);
  const billableUtilizationPct =
    totalConfirmedHours > 0 ? Math.round((billableHours / totalConfirmedHours) * 1000) / 10 : 0;

  const editedCount = confirmedEntries.filter((e) => Boolean(e.user_edited)).length;
  const editRatePct =
    confirmedCount > 0 ? Math.round((editedCount / confirmedCount) * 1000) / 10 : 0;
  const overrideCount = confirmedEntries.filter((e) => Boolean(e.is_override)).length;

  // Context only (not counted in ROI)
  const billingValueLoggedRupees = confirmedEntries.reduce((sum, e) => {
    if (!e.is_billable) return sum;
    const proj = PROJECTS_BY_CODE[e.project_code];
    return sum + (Number(e.hours) || 0) * (proj?.bill_rate || 0);
  }, 0);

  // Tokens & AI Cost
  const inputTokens = telemetryHistory.reduce((sum, t) => sum + (Number(t.input_tokens) || 0), 0);
  const outputTokens = telemetryHistory.reduce((sum, t) => sum + (Number(t.output_tokens) || 0), 0);
  const totalTokens = inputTokens + outputTokens;
  const aiCostRupees = calculateAiCostInr(telemetryHistory);

  // Time saved & session value
  const manualMinutes = confirmedCount * 2.0;
  const chatMinutes = chatSeconds / 60;
  const timeSavedMinutes = Math.max(
    0,
    Math.round((manualMinutes - (confirmedCount > 0 ? chatMinutes : 0)) * 10) / 10
  );
  const valueOfTimeSavedRupees = (timeSavedMinutes / 60) * hourlyRate;
  const totalValueRupees = valueOfTimeSavedRupees + leakageCaughtRupees;

  // Monthly projection (20 working days):
  // Fully loaded ROI = (session value * 20) / (token cost * 20 + fully loaded monthly cost)
  const monthlyPlatformCost = Number(fullyLoadedMonthlyCost) || 0;
  const projectedMonthlyValueRupees = totalValueRupees * WORKING_DAYS_PER_MONTH;
  const projectedMonthlyTokenCostRupees = aiCostRupees * WORKING_DAYS_PER_MONTH;
  const fullyLoadedCostRupees = projectedMonthlyTokenCostRupees + monthlyPlatformCost;

  const canShowRoi = confirmedCount >= 3;
  const tokenRoi =
    projectedMonthlyTokenCostRupees > 0
      ? projectedMonthlyValueRupees / projectedMonthlyTokenCostRupees
      : 0;
  const fullyLoadedRoi =
    fullyLoadedCostRupees > 0 ? projectedMonthlyValueRupees / fullyLoadedCostRupees : 0;

  const activeModel =
    telemetryHistory.length > 0
      ? telemetryHistory[telemetryHistory.length - 1].model
      : 'openai/gpt-oss-20b';

  return {
    confirmedCount,
    totalConfirmedHours: Math.round(totalConfirmedHours * 10) / 10,
    billableHours: Math.round(billableHours * 10) / 10,
    nonBillableHours: Math.round(nonBillableHours * 10) / 10,
    billableUtilizationPct,
    editRatePct,
    overrideCount,
    billingValueLoggedRupees,
    timeSavedMinutes,
    valueOfTimeSavedRupees,
    leakageCaughtRupees,
    totalValueRupees,
    projectedMonthlyValueRupees,
    projectedMonthlyTokenCostRupees,
    inputTokens,
    outputTokens,
    totalTokens,
    aiCostRupees,
    fullyLoadedMonthlyCost: monthlyPlatformCost,
    fullyLoadedCostRupees,
    tokenRoi,
    fullyLoadedRoi,
    canShowRoi,
    activeModel
  };
}

export function analyzeConsultantWeek(consultant) {
  const entries = consultant.entries || [];
  const confirmedHours = entries.reduce((sum, e) => sum + (Number(e.hours) || 0), 0);
  const billableHours = entries.reduce(
    (sum, e) => sum + (e.is_billable ? Number(e.hours) || 0 : 0),
    0
  );
  const utilizationPct =
    confirmedHours > 0 ? Math.round((billableHours / confirmedHours) * 1000) / 10 : 0;
  const editedCount = entries.filter((e) => Boolean(e.user_edited)).length;
  const editRatePct =
    entries.length > 0 ? Math.round((editedCount / entries.length) * 1000) / 10 : 0;
  const entryOverrides = entries.filter((e) => Boolean(e.is_override)).length;
  const overrideCount = entryOverrides > 0 ? entryOverrides : Number(consultant.override_count) || 0;

  const sameDayCount = entries.filter((e) => (Number(e.days_late) || 0) === 0).length;
  const sameDayLoggingPct =
    entries.length > 0 ? Math.round((sameDayCount / entries.length) * 100) : 0;

  const hoursByDay = {};
  const hoursByProject = {};
  entries.forEach((e) => {
    hoursByDay[e.date] = (hoursByDay[e.date] || 0) + (Number(e.hours) || 0);
    hoursByProject[e.project_code] = (hoursByProject[e.project_code] || 0) + (Number(e.hours) || 0);
  });

  const dailyTotals = Object.values(hoursByDay);
  const identicalDailyHours =
    dailyTotals.length >= 5 && dailyTotals.every((h) => h === dailyTotals[0] && h > 0);

  let topProjectCode = '';
  let topProjectShare = 0;
  if (confirmedHours > 0) {
    Object.entries(hoursByProject).forEach(([code, hrs]) => {
      const share = hrs / confirmedHours;
      if (share > topProjectShare) {
        topProjectShare = share;
        topProjectCode = code;
      }
    });
  }
  const oneProjectOver90 = topProjectShare > 0.9;

  const avgDaysLate =
    entries.length > 0
      ? entries.reduce((sum, e) => sum + (Number(e.days_late) || 0), 0) / entries.length
      : 0;
  const logged5PlusDaysLate = avgDaysLate >= 5;

  const flat8hPattern = identicalDailyHours && oneProjectOver90 && logged5PlusDaysLate;
  const flat8hReason = flat8hPattern
    ? `${dailyTotals[0].toFixed(1)}h/day · ${Math.round(topProjectShare * 100)}% ${topProjectCode} · ${Math.round(avgDaysLate)}d late`
    : null;

  return {
    id: consultant.id,
    name: consultant.name,
    role: consultant.role,
    isLiveUser: Boolean(consultant.isLiveUser),
    confirmedHours: Math.round(confirmedHours * 10) / 10,
    utilizationPct,
    editRatePct,
    overrideCount,
    sameDayLoggingPct,
    flat8hPattern,
    flat8hReason
  };
}

const DEMO_MODE_STORAGE_KEY = 'timetalk_demo_mode';

export function getInitialDemoMode() {
  if (typeof window === 'undefined') return 'seeded';
  const params = new URLSearchParams(window.location.search);
  const urlMode = params.get('demo') || params.get('mode');
  if (urlMode === 'empty' || urlMode === 'start_empty') return 'empty';
  if (urlMode === 'seeded') return 'seeded';
  const saved = window.localStorage.getItem(DEMO_MODE_STORAGE_KEY);
  return saved === 'empty' ? 'empty' : 'seeded';
}

const MetricsContext = createContext(null);

export function MetricsProvider({ children }) {
  const [demoMode, setDemoModeState] = useState(getInitialDemoMode);
  const isStartEmpty = demoMode === 'empty';

  const [messages, setMessages] = useState(() =>
    isStartEmpty ? [] : [INITIAL_GREETING_MESSAGE]
  );
  const [draftEntries, setDraftEntries] = useState(() =>
    isStartEmpty ? [] : INITIAL_SEED_DRAFTS
  );
  const [confirmedEntries, setConfirmedEntries] = useState([]);
  const [telemetryHistory, setTelemetryHistory] = useState(() =>
    isStartEmpty ? [] : INITIAL_SEED_TELEMETRY
  );
  const [leakageCaughtRupees, setLeakageCaughtRupees] = useState(INITIAL_SEED_LEAKAGE_INR);
  const [hourlyRate, setHourlyRate] = useState(1500);
  const [fullyLoadedMonthlyCost, setFullyLoadedMonthlyCost] = useState(40);
  const [chatSeconds, setChatSeconds] = useState(() => (isStartEmpty ? 0 : 25));
  const [isLoading, setIsLoading] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState(Date.now());
  const [conversationId] = useState(`conv_${Date.now()}`);

  useEffect(() => {
    if (getInitialDemoMode() === 'empty') {
      fetch('/api/timesheets/reset', { method: 'POST' }).catch((err) =>
        console.log('Backend starting or unreachable:', err)
      );
      return;
    }

    fetch('/api/timesheets')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.confirmed_entries) && data.confirmed_entries.length > 0) {
          setConfirmedEntries(data.confirmed_entries);
          setDraftEntries((prev) => reconcileDraftDuplicates(prev, data.confirmed_entries));
        }
      })
      .catch((err) => console.log('Backend starting or unreachable:', err));
  }, []);

  const syncActiveChatSeconds = useCallback(() => {
    setChatSeconds(Math.max(10, Math.min(90, Math.floor((Date.now() - sessionStartTime) / 1000))));
  }, [sessionStartTime]);

  const sendMessage = useCallback(
    async (userText) => {
      const userMsg = {
        sender: 'user',
        text: userText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      syncActiveChatSeconds();

      try {
        const response = await fetch('/api/chat/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversation_id: conversationId,
            user_id: 'u_priya',
            message: userText,
            client_timestamp: '2026-11-10T20:00:00+05:30'
          })
        });

        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();
        const normalized = normalizeTelemetry(data.telemetry, data.draft_entries);
        if (normalized) {
          setTelemetryHistory((prev) => [...prev, normalized]);
        }

        const botMsg = {
          sender: 'bot',
          text: data.assistant_message || 'Draft entries ready for review.',
          clarificationOptions: data.clarification_options,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages((prev) => [...prev, botMsg]);

        if (data.draft_entries && data.draft_entries.length > 0) {
          setDraftEntries((prev) =>
            reconcileDraftDuplicates([...prev, ...data.draft_entries], confirmedEntries)
          );
        }
      } catch (err) {
        console.error('Chat parse failed:', err);
        setMessages((prev) => [
          ...prev,
          {
            sender: 'bot',
            text: "Couldn't reach the backend parser. Check that the API server is running on port 8000.",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [conversationId, confirmedEntries, syncActiveChatSeconds]
  );

  const selectClarification = useCallback(
    async (option) => {
      const userMsg = {
        sender: 'user',
        text: `Selected: ${option.label}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      syncActiveChatSeconds();

      try {
        const res = await fetch('/api/chat/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversation_id: conversationId,
            user_id: 'u_priya',
            project_code: option.project_code,
            task: option.task || 'Development',
            hours: 2.0,
            date: '2026-11-10',
            raw_snippet: `2 hours on ${option.label}`
          })
        });

        if (res.ok) {
          const data = await res.json();
          const normalized = normalizeTelemetry(data.telemetry, data.draft_entries);
          if (normalized) {
            setTelemetryHistory((prev) => [...prev, normalized]);
          }
          if (data.draft_entries && data.draft_entries.length > 0) {
            setDraftEntries((prev) =>
              reconcileDraftDuplicates([...prev, ...data.draft_entries], confirmedEntries)
            );
          }
          setMessages((prev) => [
            ...prev,
            {
              sender: 'bot',
              text: data.assistant_message || `Staged 2.0 hours for ${option.label}.`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          ]);
          return;
        }
      } catch (e) {
        console.warn('Backend resolve error, using local fallback:', e);
      } finally {
        setIsLoading(false);
      }

      const newDraft = {
        id: `draft_${Date.now()}_clarified`,
        date: '2026-11-10',
        project_code: option.project_code,
        project_name:
          option.project_code === 'ACME-MOB' ? 'Acme Mobile App' : 'Acme Website Redesign',
        task: option.task || 'Development',
        hours: 2.0,
        is_billable: true,
        status: 'draft',
        user_edited: false,
        confidence: 0.95,
        reasoning: `Clarified project selection to ${option.project_code} / ${option.task || 'Development'}`,
        raw_input_snippet: `2 hours on ${option.label}`,
        anomalies: [],
        trace: {
          model: 'openai/gpt-oss-20b',
          tokens: 255,
          latency_ms: 110
        }
      };

      setTelemetryHistory((prev) => [
        ...prev,
        { model: 'openai/gpt-oss-20b', input_tokens: 180, output_tokens: 75, latency_ms: 110 }
      ]);
      setDraftEntries((prev) =>
        reconcileDraftDuplicates([...prev, newDraft], confirmedEntries)
      );
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: `Staged 2.0 hours for ${option.label} under Development.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    },
    [conversationId, confirmedEntries, syncActiveChatSeconds]
  );

  const updateDraft = useCallback(
    (id, updates) => {
      setDraftEntries((prev) => {
        let preventedDelta = 0;
        const next = prev.map((d) => {
          if (d.id !== id) return d;
          const updated = { ...d, ...updates };
          const hadClosed = (d.anomalies || []).some((a) => a.rule_id === 'CLOSED_PROJECT');
          const resolvedClosedManually =
            hadClosed &&
            ((updates.project_code && updates.project_code !== d.project_code) ||
              updates.is_billable === false);
          if (resolvedClosedManually) {
            preventedDelta += getPreventedBillingForDraft(d, ['CLOSED_PROJECT']);
            updated.anomalies = (updated.anomalies || []).filter(
              (a) => a.rule_id !== 'CLOSED_PROJECT'
            );
          }
          return updated;
        });

        if (preventedDelta > 0) {
          setLeakageCaughtRupees((curr) => curr + preventedDelta);
        }
        return reconcileDraftDuplicates(next, confirmedEntries);
      });
    },
    [confirmedEntries]
  );

  const resolveAnomalyFix = useCallback(
    (draft, fix) => {
      if (!draft || !fix) return;

      if (fix.action === 'remove_duplicate') {
        const prevented = getPreventedBillingForDraft(draft, ['DUPLICATE']);
        if (prevented > 0) {
          setLeakageCaughtRupees((curr) => curr + prevented);
        }
        setDraftEntries((prev) => prev.filter((d) => d.id !== draft.id));
        return;
      }

      if (fix.action === 'change_project') {
        const prevented = getPreventedBillingForDraft(draft, ['CLOSED_PROJECT']);
        if (prevented > 0) {
          setLeakageCaughtRupees((curr) => curr + prevented);
        }
        const proj = PROJECTS_BY_CODE[fix.value];
        const remainingAnomalies = (draft.anomalies || []).filter(
          (a) => a.rule_id !== 'CLOSED_PROJECT' && a.rule_id !== 'BUDGET_BURN'
        );
        setDraftEntries((prev) =>
          reconcileDraftDuplicates(
            prev.map((d) =>
              d.id === draft.id
                ? {
                    ...d,
                    project_code: fix.value,
                    project_name: proj?.name || fix.value,
                    task: proj?.tasks[0] || 'General',
                    is_billable: proj ? proj.is_billable : false,
                    user_edited: true,
                    anomalies: remainingAnomalies
                  }
                : d
            ),
            confirmedEntries
          )
        );
        return;
      }

      if (fix.action === 'set_non_billable') {
        const remainingAnomalies = (draft.anomalies || []).filter(
          (a) => a.rule_id !== 'BILLABLE_INTERNAL'
        );
        setDraftEntries((prev) =>
          reconcileDraftDuplicates(
            prev.map((d) =>
              d.id === draft.id
                ? { ...d, is_billable: false, user_edited: true, anomalies: remainingAnomalies }
                : d
            ),
            confirmedEntries
          )
        );
        return;
      }

      if (fix.action === 'adjust_hours') {
        const remainingAnomalies = (draft.anomalies || []).filter(
          (a) => a.rule_id !== 'UNUSUAL_HOURS'
        );
        setDraftEntries((prev) =>
          reconcileDraftDuplicates(
            prev.map((d) =>
              d.id === draft.id
                ? { ...d, hours: fix.value, user_edited: true, anomalies: remainingAnomalies }
                : d
            ),
            confirmedEntries
          )
        );
      }
    },
    [confirmedEntries]
  );

  const confirmDraft = useCallback(
    async (draft, overrideReason = '') => {
      syncActiveChatSeconds();
      const trimmedReason = typeof overrideReason === 'string' ? overrideReason.trim() : '';
      const hasAnomalies = Array.isArray(draft.anomalies) && draft.anomalies.length > 0;
      const isOverride = Boolean(trimmedReason && hasAnomalies);
      const overriddenRules = isOverride ? draft.anomalies.map((a) => a.rule_id) : [];
      const overriddenMessages = isOverride ? draft.anomalies.map((a) => a.message) : [];
      const overrideTimestamp = isOverride ? new Date().toISOString() : null;

      const confirmPayloadEntry = {
        ...draft,
        is_override: isOverride,
        override_reason: isOverride ? trimmedReason : null,
        overridden_rules: overriddenRules,
        overridden_messages: overriddenMessages,
        override_timestamp: overrideTimestamp
      };

      try {
        await fetch('/api/timesheets/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: 'u_priya',
            entries: [confirmPayloadEntry]
          })
        });
      } catch (e) {
        console.warn('Confirm persistence error, committing locally:', e);
      }

      const confirmedItem = {
        ...draft,
        status: 'confirmed',
        days_late: 0,
        id: `conf_${draft.id}`,
        is_override: isOverride,
        override_reason: isOverride ? trimmedReason : null,
        overridden_rules: overriddenRules,
        overridden_messages: overriddenMessages,
        override_timestamp: overrideTimestamp
      };

      const nextConfirmed = [...confirmedEntries, confirmedItem];
      setConfirmedEntries(nextConfirmed);
      setDraftEntries((prev) =>
        reconcileDraftDuplicates(
          prev.filter((d) => d.id !== draft.id),
          nextConfirmed
        )
      );
    },
    [confirmedEntries, syncActiveChatSeconds]
  );

  const discardDraft = useCallback((id) => {
    setDraftEntries((prev) => {
      const target = prev.find((d) => d.id === id);
      const prevented = getPreventedBillingForDraft(target, ['CLOSED_PROJECT', 'DUPLICATE']);
      if (prevented > 0) {
        setLeakageCaughtRupees((curr) => curr + prevented);
      }
      return prev.filter((d) => d.id !== id);
    });
  }, []);

  // Confirm ONLY clean Draft rows (zero anomalies); Needs review rows require individual resolution
  const confirmAll = useCallback(async () => {
    const cleanDrafts = draftEntries.filter(
      (d) => !d.anomalies || d.anomalies.length === 0
    );
    if (cleanDrafts.length === 0) return;
    syncActiveChatSeconds();

    try {
      await fetch('/api/timesheets/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'u_priya',
          entries: cleanDrafts
        })
      });
    } catch (e) {
      console.warn('Confirm all persistence error, committing locally:', e);
    }

    const cleanIds = new Set(cleanDrafts.map((d) => d.id));
    const newlyConfirmed = cleanDrafts.map((d) => ({
      ...d,
      status: 'confirmed',
      days_late: 0,
      id: `conf_${d.id}`
    }));

    const nextConfirmed = [...confirmedEntries, ...newlyConfirmed];
    setConfirmedEntries(nextConfirmed);
    setDraftEntries((prev) =>
      reconcileDraftDuplicates(
        prev.filter((d) => !cleanIds.has(d.id)),
        nextConfirmed
      )
    );
  }, [draftEntries, confirmedEntries, syncActiveChatSeconds]);

  const resetSession = useCallback(
    async (targetMode = demoMode) => {
      const mode = targetMode === 'empty' ? 'empty' : 'seeded';
      try {
        await fetch('/api/timesheets/reset', { method: 'POST' });
      } catch (e) {
        console.log('Reset store call error:', e);
      }
      if (mode === 'empty') {
        setDraftEntries([]);
        setConfirmedEntries([]);
        setTelemetryHistory([]);
        setLeakageCaughtRupees(0);
        setSessionStartTime(Date.now());
        setChatSeconds(0);
        setMessages([]);
      } else {
        setDraftEntries(INITIAL_SEED_DRAFTS);
        setConfirmedEntries([]);
        setTelemetryHistory(INITIAL_SEED_TELEMETRY);
        setLeakageCaughtRupees(INITIAL_SEED_LEAKAGE_INR);
        setSessionStartTime(Date.now());
        setChatSeconds(25);
        setMessages([INITIAL_GREETING_MESSAGE]);
      }
    },
    [demoMode]
  );

  const setDemoMode = useCallback(
    async (nextMode) => {
      const normalized = nextMode === 'empty' ? 'empty' : 'seeded';
      setDemoModeState(normalized);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(DEMO_MODE_STORAGE_KEY, normalized);
      }
      await resetSession(normalized);
    },
    [resetSession]
  );

  const metrics = useMemo(
    () =>
      computeSharedMetrics({
        confirmedEntries,
        telemetryHistory,
        leakageCaughtRupees,
        chatSeconds,
        hourlyRate,
        fullyLoadedMonthlyCost
      }),
    [
      confirmedEntries,
      telemetryHistory,
      leakageCaughtRupees,
      chatSeconds,
      hourlyRate,
      fullyLoadedMonthlyCost
    ]
  );

  const teamConsultants = useMemo(() => {
    const priyaLive = analyzeConsultantWeek({
      id: 'u_priya',
      name: 'Priya Sharma',
      role: 'Senior Consultant (You)',
      isLiveUser: true,
      entries: confirmedEntries.map((e) => ({
        date: e.date,
        project_code: e.project_code,
        hours: e.hours,
        is_billable: e.is_billable,
        user_edited: e.user_edited,
        is_override: e.is_override,
        days_late: e.days_late ?? 0
      }))
    });
    const peers = TEAM_CONSULTANTS_SEED.map(analyzeConsultantWeek);
    return [priyaLive, ...peers];
  }, [confirmedEntries]);

  const overrideLogs = useMemo(
    () => confirmedEntries.filter((e) => Boolean(e.is_override)),
    [confirmedEntries]
  );

  const value = {
    demoMode,
    messages,
    draftEntries,
    confirmedEntries,
    telemetryHistory,
    leakageCaughtRupees,
    hourlyRate,
    fullyLoadedMonthlyCost,
    chatSeconds,
    isLoading,
    metrics,
    teamConsultants,
    overrideLogs,
    setDemoMode,
    setHourlyRate,
    setFullyLoadedMonthlyCost,
    sendMessage,
    selectClarification,
    updateDraft,
    resolveAnomalyFix,
    confirmDraft,
    discardDraft,
    confirmAll,
    resetSession
  };

  return <MetricsContext.Provider value={value}>{children}</MetricsContext.Provider>;
}

export function useMetrics() {
  const ctx = useContext(MetricsContext);
  if (!ctx) {
    throw new Error('useMetrics must be used within a MetricsProvider');
  }
  return ctx;
}
