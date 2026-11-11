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

export const INITIAL_SEED_LEAKAGE_INR = 12000;

const PROJECTS_BY_CODE = Object.fromEntries(
  MOCK_CATALOGUE.projects.map((p) => [p.code, p])
);

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
  const fullyLoadedCostRupees = aiCostRupees + (Number(fullyLoadedMonthlyCost) || 0);

  // Time saved & Value
  const manualMinutes = confirmedCount * 2.0;
  const chatMinutes = chatSeconds / 60;
  const timeSavedMinutes = Math.max(
    0,
    Math.round((manualMinutes - (confirmedCount > 0 ? chatMinutes : 0)) * 10) / 10
  );
  const valueOfTimeSavedRupees = (timeSavedMinutes / 60) * hourlyRate;
  const totalValueRupees = valueOfTimeSavedRupees + leakageCaughtRupees;

  const canShowRoi = confirmedCount >= 3;
  const tokenRoi = aiCostRupees > 0 ? totalValueRupees / aiCostRupees : 0;
  const fullyLoadedRoi =
    fullyLoadedCostRupees > 0 ? totalValueRupees / fullyLoadedCostRupees : 0;

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
    billingValueLoggedRupees,
    timeSavedMinutes,
    valueOfTimeSavedRupees,
    leakageCaughtRupees,
    totalValueRupees,
    inputTokens,
    outputTokens,
    totalTokens,
    aiCostRupees,
    fullyLoadedMonthlyCost: Number(fullyLoadedMonthlyCost) || 0,
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

  const sameDayCount = entries.filter((e) => (Number(e.days_late) || 0) === 0).length;
  const sameDayLoggingPct =
    entries.length > 0 ? Math.round((sameDayCount / entries.length) * 100) : 0;

  // Check Flat 8h pattern:
  // 1) Identical daily hours (>= 5 days, all days have identical total)
  // 2) One project > 90% of total hours
  // 3) Logged 5+ days late (average days_late >= 5)
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
    sameDayLoggingPct,
    flat8hPattern,
    flat8hReason
  };
}

const MetricsContext = createContext(null);

export function MetricsProvider({ children }) {
  const [messages, setMessages] = useState([INITIAL_GREETING_MESSAGE]);
  const [draftEntries, setDraftEntries] = useState(INITIAL_SEED_DRAFTS);
  const [confirmedEntries, setConfirmedEntries] = useState([]);
  const [telemetryHistory, setTelemetryHistory] = useState(INITIAL_SEED_TELEMETRY);
  const [leakageCaughtRupees, setLeakageCaughtRupees] = useState(INITIAL_SEED_LEAKAGE_INR);
  const [hourlyRate, setHourlyRate] = useState(1500);
  const [fullyLoadedMonthlyCost, setFullyLoadedMonthlyCost] = useState(40);
  const [chatSeconds, setChatSeconds] = useState(25);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState(Date.now());
  const [conversationId] = useState(`conv_${Date.now()}`);

  useEffect(() => {
    fetch('/api/timesheets')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.confirmed_entries) && data.confirmed_entries.length > 0) {
          setConfirmedEntries(data.confirmed_entries);
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

        if (data.draft_entries) {
          data.draft_entries.forEach((entry) => {
            const hasClosedProjectAnomaly = entry.anomalies?.some(
              (a) => a.rule_id === 'CLOSED_PROJECT'
            );
            if (hasClosedProjectAnomaly) {
              const proj = PROJECTS_BY_CODE[entry.project_code];
              const rate = proj?.bill_rate || 3000;
              setLeakageCaughtRupees((prev) => prev + (Number(entry.hours) || 4) * rate);
            }
          });
        }

        const botMsg = {
          sender: 'bot',
          text: data.assistant_message || 'Draft entries ready for review.',
          clarificationOptions: data.clarification_options,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages((prev) => [...prev, botMsg]);

        if (data.draft_entries && data.draft_entries.length > 0) {
          setDraftEntries((prev) => [...prev, ...data.draft_entries]);
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
    [conversationId, syncActiveChatSeconds]
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
            setDraftEntries((prev) => [...prev, ...data.draft_entries]);
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
      setDraftEntries((prev) => [...prev, newDraft]);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: `Staged 2.0 hours for ${option.label} under Development.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    },
    [conversationId, syncActiveChatSeconds]
  );

  const updateDraft = useCallback((id, updates) => {
    setDraftEntries((prev) => prev.map((d) => (d.id === id ? { ...d, ...updates } : d)));
  }, []);

  const confirmDraft = useCallback(
    async (draft) => {
      syncActiveChatSeconds();
      try {
        await fetch('/api/timesheets/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: 'u_priya',
            entries: [draft]
          })
        });
      } catch (e) {
        console.warn('Confirm persistence error, committing locally:', e);
      }

      setDraftEntries((prev) => prev.filter((d) => d.id !== draft.id));
      setConfirmedEntries((prev) => [
        ...prev,
        {
          ...draft,
          status: 'confirmed',
          days_late: 0,
          id: `conf_${draft.id}`
        }
      ]);
    },
    [syncActiveChatSeconds]
  );

  const discardDraft = useCallback((id) => {
    setDraftEntries((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const confirmAll = useCallback(async () => {
    if (draftEntries.length === 0) return;
    syncActiveChatSeconds();

    try {
      await fetch('/api/timesheets/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'u_priya',
          entries: draftEntries
        })
      });
    } catch (e) {
      console.warn('Confirm all persistence error, committing locally:', e);
    }

    const newlyConfirmed = draftEntries.map((d) => ({
      ...d,
      status: 'confirmed',
      days_late: 0,
      id: `conf_${d.id}`
    }));

    setConfirmedEntries((prev) => [...prev, ...newlyConfirmed]);
    setDraftEntries([]);
  }, [draftEntries, syncActiveChatSeconds]);

  const resetSession = useCallback(async () => {
    try {
      await fetch('/api/timesheets/reset', { method: 'POST' });
    } catch (e) {
      console.log('Reset store call error:', e);
    }
    setDraftEntries(INITIAL_SEED_DRAFTS);
    setConfirmedEntries([]);
    setTelemetryHistory(INITIAL_SEED_TELEMETRY);
    setLeakageCaughtRupees(INITIAL_SEED_LEAKAGE_INR);
    setSessionStartTime(Date.now());
    setChatSeconds(25);
    setMessages([INITIAL_GREETING_MESSAGE]);
  }, []);

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
        days_late: e.days_late ?? 0
      }))
    });
    const peers = TEAM_CONSULTANTS_SEED.map(analyzeConsultantWeek);
    return [priyaLive, ...peers];
  }, [confirmedEntries]);

  const value = {
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
    setHourlyRate,
    setFullyLoadedMonthlyCost,
    sendMessage,
    selectClarification,
    updateDraft,
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

