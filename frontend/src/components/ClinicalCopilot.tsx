'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Copy, Check, Plus, ListChecks } from 'lucide-react';
import { ClinicalWarningBanner } from '@/components/ui/ClinicalWarningBanner';
import {
  startConversation,
  sendMessage,
  getMessages,
  listSuggestions,
  resolveSuggestion,
  CopilotConversation,
  CopilotMessage,
  CopilotSuggestion,
} from '@/lib/api/copilot';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SEVERITY_STYLE: Record<string, string> = {
  critical: 'border-red-300 bg-red-50 text-red-800',
  warning:  'border-amber-300 bg-amber-50 text-amber-800',
  info:     'border-blue-300 bg-blue-50 text-blue-800',
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border border-red-300',
  warning:  'bg-amber-100 text-amber-700 border border-amber-300',
  info:     'bg-blue-100 text-blue-700 border border-blue-300',
};

const MODULE_LABELS: Record<string, string> = {
  prescriptions: 'Prescriptions',
  ipr:           'IPR',
  attachments:   'Attachments',
  simulation:    'Simulation',
  segmentation:  'Segmentation',
  aligner:       'Aligner',
  pdl:           'PDL',
};

const QUICK_PROMPT_GROUPS = [
  {
    label: 'Analysis',
    prompts: ['Any Kravitz violations?', 'Overjet prediction?', 'IPR enamel safety?'],
  },
  {
    label: 'Forces',
    prompts: ['PDL stress status?', 'Anchor balance?', 'Collision risk?'],
  },
  {
    label: 'Plan',
    prompts: ['How many stages?', 'Refinement risk?', 'Manufacturing readiness?'],
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SuggestionCard({
  suggestion,
  onResolve,
}: {
  suggestion: CopilotSuggestion;
  onResolve: (id: string, status: 'acknowledged' | 'dismissed' | 'applied', note?: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState('');

  if (suggestion.status !== 'open') return null;

  return (
    <div className={`rounded border p-3 text-xs ${SEVERITY_STYLE[suggestion.severity]}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${SEVERITY_BADGE[suggestion.severity]}`}>
              {suggestion.severity}
            </span>
            <span className="text-[color:var(--muted-foreground)] opacity-70 text-[10px]">
              {MODULE_LABELS[suggestion.module] ?? suggestion.module}
            </span>
          </div>
          <p className="font-semibold text-[color:var(--foreground)]">{suggestion.title}</p>
          <p className="mt-0.5 text-[color:var(--muted-foreground)]">{suggestion.body}</p>
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-[color:var(--muted-foreground)] opacity-70 hover:opacity-100 text-xs"
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {expanded && (
        <div className="mt-2 space-y-2">
          <textarea
            placeholder="Optional clinician note…"
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={2}
            className="w-full text-xs p-1.5 border border-[color:var(--border)] rounded bg-[color:var(--background)] text-[color:var(--foreground)] resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => onResolve(suggestion.id, 'acknowledged', note || undefined)}
              className="px-2 py-1 text-xs bg-[color:var(--primary)] text-[color:var(--primary-foreground)] rounded hover:opacity-90"
            >
              Acknowledge
            </button>
            <button
              onClick={() => onResolve(suggestion.id, 'applied', note || undefined)}
              className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
            >
              Mark Applied
            </button>
            <button
              onClick={() => onResolve(suggestion.id, 'dismissed', note || undefined)}
              className="px-2 py-1 text-xs text-[color:var(--muted-foreground)] border border-[color:var(--border)] rounded hover:bg-[color:var(--accent)]"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: CopilotMessage }) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [message.content]);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-2 group relative`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
          isUser
            ? 'bg-[color:var(--primary)] text-[color:var(--primary-foreground)]'
            : 'bg-[color:var(--muted)]/30 text-[color:var(--foreground)] border border-[color:var(--border)]'
        }`}
      >
        {!isUser && (
          <div className="flex items-center gap-1 mb-1">
            <span className="text-[10px] font-semibold text-[color:var(--muted-foreground)] opacity-70 uppercase tracking-wide">
              Clinical Copilot
            </span>
            {message.referencedModule && (
              <span className="text-[10px] text-[color:var(--muted-foreground)] opacity-70">
                · {MODULE_LABELS[message.referencedModule] ?? message.referencedModule}
              </span>
            )}
          </div>
        )}
        <p className="whitespace-pre-line">{message.content}</p>
        {!isUser && message.latencyMs != null && (
          <p className="text-[10px] text-[color:var(--muted-foreground)] opacity-70 mt-1">
            {message.latencyMs}ms
          </p>
        )}
        {!isUser && (
          <p className="text-[9px] text-[color:var(--muted-foreground)] mt-1.5 border-t border-[color:var(--border)] pt-1 opacity-70">
            AI-assisted recommendation only. Final treatment decisions remain the responsibility of the licensed orthodontist.
          </p>
        )}
      </div>
      <button
        onClick={handleCopy}
        title="Copy message"
        className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-[color:var(--background)] border border-[color:var(--border)] rounded p-0.5 shadow-sm"
      >
        {copied
          ? <Check size={10} className="text-green-600" />
          : <Copy size={10} className="text-[color:var(--muted-foreground)]" />
        }
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  caseId: string;
  planId?: string;
}

type Panel = 'chat' | 'suggestions';

export default function ClinicalCopilot({ caseId, planId }: Props) {
  const [panel, setPanel] = useState<Panel>('chat');
  const [conv, setConv] = useState<CopilotConversation | null>(null);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [suggestions, setSuggestions] = useState<CopilotSuggestion[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiUnavailable, setAiUnavailable] = useState(false);
  const [resolvedExpanded, setResolvedExpanded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const openSuggestions = suggestions.filter(s => s.status === 'open').length;
  const resolvedSuggestions = suggestions.filter(s => s.status !== 'open');

  const convMeta = conv
    ? new Date(conv.createdAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleStart = useCallback(async () => {
    setStarting(true); setError(null); setAiUnavailable(false);
    try {
      const c = await startConversation(caseId, planId);
      setConv(c);
      const [msgs, sugg] = await Promise.all([
        getMessages(caseId, c.id),
        listSuggestions(caseId, planId),
      ]);
      setMessages(msgs);
      setSuggestions(sugg);
    } catch (e) {
      setError((e as Error).message);
      setAiUnavailable(true);
    } finally {
      setStarting(false);
    }
  }, [caseId, planId]);

  const handleNew = useCallback(() => {
    setConv(null);
    setMessages([]);
    setSuggestions([]);
    setInput('');
    setResolvedExpanded(false);
  }, []);

  const handleSend = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || !conv) return;
    setInput('');
    setLoading(true); setError(null);

    const optimistic: CopilotMessage = {
      id: `opt-${Date.now()}`,
      conversationId: conv.id,
      role: 'user',
      content,
      intent: null,
      referencedModule: null,
      suggestions: [],
      latencyMs: null,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);

    try {
      const reply = await sendMessage(caseId, conv.id, content);
      setMessages(prev => [...prev.filter(m => m.id !== optimistic.id), reply]);
      if (reply.suggestions.length > 0) {
        setSuggestions(prev => {
          const ids = new Set(prev.map(s => s.id));
          const newOnes = reply.suggestions.filter(s => !ids.has(s.id));
          return [...newOnes, ...prev];
        });
      }
    } catch (e) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setError((e as Error).message);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [conv, caseId, input]);

  const handleResolve = useCallback(async (
    id: string,
    status: 'acknowledged' | 'dismissed' | 'applied',
    note?: string,
  ) => {
    try {
      const updated = await resolveSuggestion(caseId, id, status, note);
      setSuggestions(prev => prev.map(s => s.id === id ? updated : s));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [caseId]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] shadow-sm flex flex-col h-[600px]">
      <style>{`
        @keyframes copilot-dot-pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.75); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* Header */}
      <div className="border-b border-[color:var(--border)] px-4 py-3 shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[color:var(--foreground)]">Clinical Copilot</h2>
            <p className="text-xs text-[color:var(--muted-foreground)] mt-0.5">
              Context-aware treatment planning assistant · AI suggestions only
            </p>
            {conv && convMeta && (
              <p className="text-[10px] text-[color:var(--muted-foreground)] opacity-70 mt-0.5">
                Conversation started · {convMeta} · {messages.length} messages
              </p>
            )}
          </div>
          {conv && (
            <div className="flex gap-1 items-center shrink-0">
              <button
                onClick={handleNew}
                className="flex items-center gap-1 border border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:bg-[color:var(--accent)] px-2 py-1 text-xs rounded"
              >
                <Plus size={10} />
                New
              </button>
              <button
                onClick={() => setPanel('chat')}
                className={`px-3 py-1 text-xs rounded border ${
                  panel === 'chat'
                    ? 'bg-[color:var(--primary)] text-[color:var(--primary-foreground)] border-[color:var(--primary)]'
                    : 'border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:bg-[color:var(--accent)]'
                }`}
              >
                Chat
              </button>
              <button
                onClick={() => setPanel('suggestions')}
                className={`px-3 py-1 text-xs rounded border relative ${
                  panel === 'suggestions'
                    ? 'bg-[color:var(--primary)] text-[color:var(--primary-foreground)] border-[color:var(--primary)]'
                    : 'border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:bg-[color:var(--accent)]'
                }`}
              >
                Suggestions
                {openSuggestions > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {openSuggestions}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-2 text-xs text-red-700 bg-red-50 rounded p-2 border border-red-200 shrink-0">
          {error}
        </div>
      )}

      {/* Not started */}
      {!conv && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-[color:var(--muted)]/30 flex items-center justify-center mb-3">
            <span className="text-2xl">🩺</span>
          </div>
          <p className="text-sm font-medium text-[color:var(--foreground)] mb-1">Clinical Copilot</p>
          {aiUnavailable ? (
            <div className="mb-4 max-w-xs text-left">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">
                AI Copilot unavailable
              </p>
              <p className="text-xs text-[color:var(--muted-foreground)]">
                The AI service could not be reached. Rule-based clinical checks are still available — use the Suggestions tab or manual review workflow. Retry when connectivity is restored.
              </p>
            </div>
          ) : (
            <p className="text-xs text-[color:var(--muted-foreground)] mb-4 max-w-xs">
              Ask questions about this treatment plan. The copilot scans prescriptions, IPR, simulation, attachments, and PDL data to provide context-aware answers.
            </p>
          )}
          <button
            onClick={handleStart}
            disabled={starting}
            className="px-4 py-2 text-sm bg-[color:var(--primary)] text-[color:var(--primary-foreground)] rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {starting ? 'Starting…' : aiUnavailable ? 'Retry' : 'Start Conversation'}
          </button>
        </div>
      )}

      {/* Chat panel */}
      {conv && panel === 'chat' && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
            {messages.length === 0 && (
              <div className="text-xs text-[color:var(--muted-foreground)] opacity-70 text-center mt-4">
                No messages yet. Ask a question or use a quick prompt below.
              </div>
            )}
            {messages.map(m => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {loading && (
              <div className="flex justify-start mb-2">
                <div className="bg-[color:var(--muted)]/30 border border-[color:var(--border)] rounded-lg px-3 py-2.5 flex items-center gap-1.5">
                  <span className="text-[10px] text-[color:var(--muted-foreground)] font-medium uppercase tracking-wide mr-1">
                    Analyzing
                  </span>
                  {[0, 1, 2].map(i => (
                    <span
                      key={i}
                      className="block h-1.5 w-1.5 rounded-full bg-[color:var(--primary)]"
                      style={{ animation: `copilot-dot-pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick prompts */}
          <div className="px-4 py-2 border-t border-[color:var(--border)] shrink-0 space-y-1.5">
            {QUICK_PROMPT_GROUPS.map(group => (
              <div key={group.label}>
                <p className="text-[9px] font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)] opacity-70 mb-1">
                  {group.label}
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  {group.prompts.map(p => (
                    <button
                      key={p}
                      onClick={() => handleSend(p)}
                      disabled={loading}
                      className="text-[10px] px-2 py-0.5 rounded-full border border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:bg-[color:var(--accent)] disabled:opacity-40"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="px-4 py-2 border-t border-[color:var(--border)] flex gap-2 items-end shrink-0">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder="Ask about prescriptions, IPR, attachments, simulation… (Enter to send)"
              rows={2}
              className="flex-1 text-xs p-2 border border-[color:var(--border)] rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-[color:var(--primary)] bg-[color:var(--background)] text-[color:var(--foreground)] disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="px-3 py-2 text-xs bg-[color:var(--primary)] text-[color:var(--primary-foreground)] rounded-lg hover:opacity-90 disabled:opacity-50 shrink-0"
            >
              Send
            </button>
          </div>
        </>
      )}

      {/* Suggestions panel */}
      {conv && panel === 'suggestions' && (
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {suggestions.length === 0 && (
            <div className="flex flex-col items-center justify-center mt-8 text-center px-4">
              <ListChecks size={28} className="text-[color:var(--muted-foreground)] opacity-40 mb-2" />
              <p className="text-xs font-medium text-[color:var(--foreground)] mb-1">No open suggestions</p>
              <p className="text-xs text-[color:var(--muted-foreground)] max-w-xs">
                Ask the copilot about prescriptions, IPR, collisions, or PDL stress to generate clinical suggestions.
              </p>
            </div>
          )}
          {openSuggestions === 0 && suggestions.length > 0 && (
            <p className="text-xs text-green-700 bg-green-50 rounded p-3 border border-green-200">
              All suggestions have been reviewed. No open items.
            </p>
          )}
          {suggestions.map(s => (
            <SuggestionCard key={s.id} suggestion={s} onResolve={handleResolve} />
          ))}
          {resolvedSuggestions.length > 0 && (
            <div className="mt-2 border-t border-[color:var(--border)] pt-2">
              <button
                onClick={() => setResolvedExpanded(e => !e)}
                className="flex items-center gap-1.5 text-xs font-semibold text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] w-full text-left mb-1"
              >
                <span>{resolvedExpanded ? '▲' : '▼'}</span>
                Resolved ({resolvedSuggestions.length})
              </button>
              {resolvedExpanded && resolvedSuggestions.map(s => (
                <div key={s.id} className="text-xs text-[color:var(--muted-foreground)] opacity-70 py-1 flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${SEVERITY_BADGE[s.severity]}`}>
                    {s.severity}
                  </span>
                  <span className="line-through">{s.title}</span>
                  <span className="capitalize">[{s.status}]</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Disclaimer */}
      <div className="border-t border-[color:var(--border)] px-4 py-2 shrink-0">
        <ClinicalWarningBanner message="AI-assisted recommendation only. Final treatment decisions remain the responsibility of the licensed orthodontist." />
      </div>
    </div>
  );
}
