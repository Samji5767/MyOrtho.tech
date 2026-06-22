"use client";

import { useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bot,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Info,
  Lightbulb,
  MessageSquare,
  Send,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  User,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import type { CaseAnalysis, AIPrediction, AIRecommendation, CopilotMessage } from "@/types/orthodontic";

// ─── AI data (populated after real case is loaded) ───────────────────────────

const MOCK_CASE_ANALYSIS: CaseAnalysis | null = null;

const MOCK_PREDICTIONS: AIPrediction | null = null;

const MOCK_RECOMMENDATIONS: AIRecommendation[] = [];

const INITIAL_MESSAGES: CopilotMessage[] = [
  {
    id: "m0",
    role: "assistant",
    content: "AI Copilot is ready. Upload a scan or open a real case to generate clinical decision-support insights.\n\n⚠️ All AI outputs are **Clinical Decision Support Only** — final decisions remain with the treating orthodontist.",
    timestamp: "Just now",
  },
];

const QUICK_PROMPTS = [
  "Explain the complexity score",
  "Why is IPR needed?",
  "Is refinement likely?",
  "Summarize attachment plan",
  "What are the movement risks?",
  "Manufacturing timeline estimate",
];

const AI_QUICK_RESPONSES: Record<string, string> = {};

// ─── Empty state helper ───────────────────────────────────────────────────────

function NoDataState({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="ios-card flex flex-col items-center gap-3 p-10 text-center">
      <Bot size={28} className="text-[color:var(--muted-foreground)]" />
      <div>
        <p className="text-sm font-semibold text-[color:var(--foreground)]">{label}</p>
        <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">{detail}</p>
      </div>
    </div>
  );
}

// ─── Case Analysis Panel ──────────────────────────────────────────────────────

function CaseAnalysisPanel({ analysis }: { analysis: CaseAnalysis }) {
  const complexityColor = analysis.complexityScore > 7 ? "text-rose-500" : analysis.complexityScore > 5 ? "text-amber-600" : "text-emerald-600";

  return (
    <div className="ios-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Brain size={16} className="text-violet-500" />
        <h3 className="font-bold text-[color:var(--foreground)]">Case Analysis</h3>
        <span className="ml-auto text-xs text-[color:var(--muted-foreground)]">Confidence {analysis.confidenceScore.toFixed(0)}%</span>
      </div>
      <MedicalDisclaimer variant="compact" className="mb-4" />

      <div className="grid grid-cols-2 gap-3 mb-4 sm:grid-cols-3">
        {[
          { label: "Bite Class",        value: analysis.biteClassification },
          { label: "Upper Crowding",    value: `${analysis.crowdingUpperMm} mm` },
          { label: "Lower Crowding",    value: `${analysis.crowdingLowerMm} mm` },
          { label: "Overjet",           value: `${analysis.overjet} mm` },
          { label: "Overbite",          value: `${analysis.overbite} mm` },
          { label: "Midline Dev.",      value: `${analysis.midlineDeviation} mm` },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] p-2.5">
            <p className="text-[10px] font-semibold text-[color:var(--muted-foreground)]">{label}</p>
            <p className="mt-1 text-sm font-bold text-[color:var(--foreground)]">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-[color:var(--foreground)]">Complexity Score</span>
          <span className={`text-2xl font-black tabular-nums ${complexityColor}`}>{analysis.complexityScore.toFixed(1)}</span>
        </div>
        <div className="h-2 rounded-full bg-[color:var(--border)] mb-1.5">
          <div className={`h-full rounded-full ${analysis.complexityScore > 7 ? "bg-rose-500" : analysis.complexityScore > 5 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${analysis.complexityScore * 10}%` }} />
        </div>
        <div className="flex justify-between text-[10px] text-[color:var(--muted-foreground)]">
          <span>Simple</span><span>Moderate</span><span>Complex</span><span>Very Complex</span>
        </div>
        <p className="mt-2 text-xs font-bold text-center text-[color:var(--muted-foreground)]">{analysis.complexityLabel}</p>
      </div>
    </div>
  );
}

// ─── Predictions Panel ────────────────────────────────────────────────────────

function PredictionsPanel({ pred }: { pred: AIPrediction }) {
  return (
    <div className="ios-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 size={16} className="text-sky-500" />
        <h3 className="font-bold text-[color:var(--foreground)]">AI Predictions</h3>
        <span className="ml-auto text-xs text-[color:var(--muted-foreground)]">{pred.confidenceScore}% confidence</span>
      </div>
      <MedicalDisclaimer variant="compact" className="mb-4" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: "Est. Duration",      value: `${Math.round(pred.estimatedDurationWeeks / 4.3)}`, unit: "months", icon: Clock, color: "text-[color:var(--primary)]" },
          { label: "Aligner Count",      value: pred.estimatedAlignerCount.toString(),              unit: "stages",  icon: Zap, color: "text-teal-600" },
          { label: "Refinement Risk",    value: `${pred.refinementProbability}`,                    unit: "%",       icon: TrendingUp, color: pred.refinementProbability > 30 ? "text-amber-600" : "text-emerald-600" },
          { label: "Compliance Risk",    value: pred.complianceRisk.charAt(0).toUpperCase() + pred.complianceRisk.slice(1), unit: "", icon: Activity, color: pred.complianceRisk === "high" ? "text-rose-500" : pred.complianceRisk === "moderate" ? "text-amber-600" : "text-emerald-600" },
          { label: "Predicted IPR",      value: pred.iprPrediction.toFixed(1),                     unit: "mm",      icon: Wand2, color: "text-amber-600" },
          { label: "Attachments",        value: pred.attachmentPrediction.toString(),               unit: "pcs",     icon: Lightbulb, color: "text-violet-600" },
        ].map(({ label, value, unit, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-3">
            <Icon size={14} className={`mb-1.5 ${color}`} />
            <p className={`text-xl font-black tabular-nums ${color}`}>{value}<span className="text-xs font-bold text-[color:var(--muted-foreground)]"> {unit}</span></p>
            <p className="text-[10px] font-semibold text-[color:var(--muted-foreground)]">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Recommendations list ─────────────────────────────────────────────────────

function RecommendationsPanel({ recs }: { recs: AIRecommendation[] }) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const visible = recs.filter(r => !dismissed.includes(r.id));

  const SEV_CONFIG: Record<AIRecommendation["severity"], { bg: string; border: string; icon: React.ElementType; iconColor: string }> = {
    critical: { bg: "bg-rose-50/60 dark:bg-rose-900/10",   border: "border-rose-300/50 dark:border-rose-700/40",   icon: AlertTriangle, iconColor: "text-rose-500" },
    warning:  { bg: "bg-amber-50/50 dark:bg-amber-900/10", border: "border-amber-300/50 dark:border-amber-700/40", icon: AlertTriangle, iconColor: "text-amber-500" },
    info:     { bg: "bg-[color:var(--card)]",              border: "border-[color:var(--border)]",                 icon: Info,          iconColor: "text-sky-500" },
  };

  const CAT_LABELS: Record<AIRecommendation["category"], string> = {
    attachment: "Attachment", ipr: "IPR", movement_warning: "Movement",
    manufacturing: "Manufacturing", clinical: "Clinical", compliance: "Compliance",
  };

  return (
    <div className="ios-card p-5">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={16} className="text-violet-500" />
        <h3 className="font-bold text-[color:var(--foreground)]">Recommendations</h3>
        <span className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${recs.filter(r => r.actionRequired).length > 0 ? "bg-amber-500/10 text-amber-600" : "bg-emerald-500/10 text-emerald-600"}`}>
          {recs.filter(r => r.actionRequired).length} action required
        </span>
      </div>
      <MedicalDisclaimer variant="compact" className="mb-4" />

      <div className="space-y-3">
        {visible.map(rec => {
          const cfg = SEV_CONFIG[rec.severity];
          const Icon = cfg.icon;
          return (
            <div key={rec.id} className={`rounded-xl border p-4 ${cfg.bg} ${cfg.border}`}>
              <div className="flex items-start gap-3">
                <Icon size={15} className={`mt-0.5 shrink-0 ${cfg.iconColor}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2 flex-wrap mb-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center rounded-md bg-[color:var(--primary-glow)] px-1.5 py-0.5 text-[10px] font-bold text-[color:var(--primary)]">
                        {CAT_LABELS[rec.category]}
                      </span>
                      {rec.actionRequired && (
                        <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-600">Action Required</span>
                      )}
                    </div>
                    <button type="button" onClick={() => setDismissed(d => [...d, rec.id])} className="shrink-0 text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]">
                      <X size={14} />
                    </button>
                  </div>
                  <p className="text-sm font-bold text-[color:var(--foreground)]">{rec.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-[color:var(--muted-foreground)]">{rec.description}</p>
                  {rec.affectedTeeth && rec.affectedTeeth.length > 0 && (
                    <p className="mt-1.5 text-[10px] text-[color:var(--muted-foreground)]">
                      Affected teeth: {rec.affectedTeeth.map(f => `FDI ${f}`).join(", ")}
                    </p>
                  )}
                  <p className="mt-1 text-[10px] italic text-amber-700 dark:text-amber-400">{rec.disclaimer}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── AI Chat ──────────────────────────────────────────────────────────────────

function AICopilotChat() {
  const [messages, setMessages] = useState<CopilotMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  function sendMessage(text: string) {
    if (!text.trim()) return;
    const userMsg: CopilotMessage = {
      id: `u${Date.now()}`,
      role: "user",
      content: text,
      timestamp: "Just now",
    };
    const aiResponse = AI_QUICK_RESPONSES[text] ?? `I'm analyzing "${text}". Please upload a scan or open a real case for detailed AI clinical decision support.\n\nThis analysis is based on AI pattern recognition and literature data. Always confirm clinical decisions with the treating orthodontist.\n\n*Clinical Decision Support Only — not a substitute for clinical judgment.*`;
    const aiMsg: CopilotMessage = {
      id: `a${Date.now()}`,
      role: "assistant",
      content: aiResponse,
      timestamp: "Just now",
    };
    setMessages(m => [...m, userMsg, aiMsg]);
    setInput("");
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 100);
  }

  return (
    <div className="ios-card flex flex-col overflow-hidden" style={{ height: "480px" }}>
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-[color:var(--border)] px-4 py-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-500">
          <Bot size={16} />
        </div>
        <div>
          <p className="text-sm font-bold text-[color:var(--foreground)]">AI Copilot</p>
          <p className="text-[10px] text-amber-600 font-semibold">Clinical Decision Support Only</p>
        </div>
        <div className="ml-auto flex h-2.5 items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] text-emerald-600 font-semibold">Ready</span>
        </div>
      </div>

      {/* Quick prompts */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-3 py-2 border-b border-[color:var(--border)]">
        {QUICK_PROMPTS.map(p => (
          <button
            key={p}
            type="button"
            onClick={() => sendMessage(p)}
            className="shrink-0 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${msg.role === "assistant" ? "bg-violet-500" : "bg-[color:var(--primary)]"}`}>
              {msg.role === "assistant" ? <Bot size={13} /> : <User size={13} />}
            </span>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-3 text-sm leading-relaxed ${msg.role === "assistant" ? "rounded-tl-sm bg-[color:var(--card)] border border-[color:var(--border)] text-[color:var(--foreground)]" : "rounded-tr-sm bg-[color:var(--primary)] text-white"}`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
              <p className={`mt-1.5 text-[10px] ${msg.role === "assistant" ? "text-[color:var(--muted-foreground)]" : "text-white/70"}`}>{msg.timestamp}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="border-t border-[color:var(--border)] px-3 py-3">
        <div className="flex items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2">
          <input
            type="text"
            placeholder="Ask about this case…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage(input)}
            className="flex-1 bg-transparent text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] outline-none"
          />
          <button
            type="button"
            onClick={() => sendMessage(input)}
            disabled={!input.trim()}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[color:var(--primary)] text-white disabled:opacity-40"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AIOrthodonticCopilot() {
  const [activeTab, setActiveTab] = useState<"analysis" | "predictions" | "recommendations" | "chat">("analysis");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--muted-foreground)]">AI Orthodontic Copilot</p>
          <h2 className="mt-1 text-2xl font-bold text-[color:var(--foreground)]">Clinical AI Assistant</h2>
          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">Platform-wide AI decision support</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-amber-300/50 bg-amber-50/60 px-3 py-2 dark:border-amber-700/40 dark:bg-amber-900/10">
          <ShieldAlert size={14} className="text-amber-600" />
          <span className="text-xs font-bold text-amber-700 dark:text-amber-300">Clinical Decision Support Only</span>
        </div>
      </div>

      <MedicalDisclaimer variant="banner" />

      {/* Tab bar */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {(["analysis", "predictions", "recommendations", "chat"] as const).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all capitalize ${activeTab === tab ? "bg-[color:var(--primary)] text-white" : "border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)]"}`}
          >
            {tab === "chat" ? "AI Chat" : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === "analysis" && (
        MOCK_CASE_ANALYSIS
          ? <CaseAnalysisPanel analysis={MOCK_CASE_ANALYSIS} />
          : <NoDataState label="No case loaded" detail="Upload a scan or open a case to see AI analysis." />
      )}
      {activeTab === "predictions" && (
        MOCK_PREDICTIONS
          ? <PredictionsPanel pred={MOCK_PREDICTIONS} />
          : <NoDataState label="No predictions available" detail="Predictions are generated after case analysis completes." />
      )}
      {activeTab === "recommendations" && <RecommendationsPanel recs={MOCK_RECOMMENDATIONS} />}
      {activeTab === "chat" && <AICopilotChat />}
    </div>
  );
}

export default AIOrthodonticCopilot;
