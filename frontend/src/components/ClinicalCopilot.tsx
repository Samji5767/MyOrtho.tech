'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
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

const QUICK_PROMPTS = [
  'Are there any Kravitz violations?',
  'What is the predicted overjet?',
  'Any IPR enamel safety concerns?',
  'Are there attachment collisions?',
  'How many stages in the aligner plan?',
  'PDL stress status?',
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
            <span className="text-gray-500 text-[10px]">{MODULE_LABELS[suggestion.module] ?? suggestion.module}</span>
          </div>
          <p className="font-semibold text-gray-900">{suggestion.title}</p>
          <p className="mt-0.5 text-gray-700">{suggestion.body}</p>
        </div>
        <button onClick={() => setExpanded(e => !e)} className="text-gray-400 hover:text-gray-600 text-xs">
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
            className="w-full text-xs p-1.5 border border-gray-300 rounded bg-white text-gray-800 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => onResolve(suggestion.id, 'acknowledged', note || undefined)}
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
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
              className="px-2 py-1 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
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
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-2`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-900 border border-gray-200'
        }`}
      >
        {!isUser && (
          <div className="flex items-center gap-1 mb-1">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
              Clinical Copilot
            </span>
            {message.referencedModule && (
              <span className="text-[10px] text-gray-400">
                · {MODULE_LABELS[message.referencedModule] ?? message.referencedModule}
              </span>
            )}
          </div>
        )}
        <p className="whitespace-pre-line">{message.content}</p>
        {!isUser && message.latencyMs != null && (
          <p className="text-[10px] text-gray-400 mt-1">{message.latencyMs}ms</p>
        )}
      </div>
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const openSuggestions = suggestions.filter(s => s.status === 'open').length;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleStart = useCallback(async () => {
    setStarting(true); setError(null);
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
    } finally {
      setStarting(false);
    }
  }, [caseId, planId]);

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
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm flex flex-col h-[600px]">
      {/* Header */}
      <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Clinical Copilot</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Context-aware treatment planning assistant · AI suggestions only
          </p>
        </div>
        {conv && (
          <div className="flex gap-1">
            <button
              onClick={() => setPanel('chat')}
              className={`px-3 py-1 text-xs rounded border ${
                panel === 'chat' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => setPanel('suggestions')}
              className={`px-3 py-1 text-xs rounded border relative ${
                panel === 'suggestions' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
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

      {/* Error */}
      {error && (
        <div className="mx-4 mt-2 text-xs text-red-700 bg-red-50 rounded p-2 border border-red-200 shrink-0">
          {error}
        </div>
      )}

      {/* Not started */}
      {!conv && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-3">
            <span className="text-2xl">🩺</span>
          </div>
          <p className="text-sm font-medium text-gray-900 mb-1">Clinical Copilot</p>
          <p className="text-xs text-gray-500 mb-4 max-w-xs">
            Ask questions about this treatment plan. The copilot scans prescriptions, IPR, simulation, attachments, and PDL data to provide context-aware answers.
          </p>
          <button
            onClick={handleStart}
            disabled={starting}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {starting ? 'Starting…' : 'Start Conversation'}
          </button>
        </div>
      )}

      {/* Chat panel */}
      {conv && panel === 'chat' && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
            {messages.length === 0 && (
              <div className="text-xs text-gray-400 text-center mt-4">
                No messages yet. Ask a question or use a quick prompt below.
              </div>
            )}
            {messages.map(m => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {loading && (
              <div className="flex justify-start mb-2">
                <div className="bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-500 italic">
                  Analyzing…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick prompts */}
          <div className="px-4 py-1.5 border-t border-gray-100 flex gap-1.5 flex-wrap shrink-0">
            {QUICK_PROMPTS.map(p => (
              <button
                key={p}
                onClick={() => handleSend(p)}
                disabled={loading}
                className="text-[10px] px-2 py-0.5 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="px-4 py-2 border-t border-gray-200 flex gap-2 items-end shrink-0">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about prescriptions, IPR, attachments, simulation… (Enter to send)"
              rows={2}
              className="flex-1 text-xs p-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="px-3 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 shrink-0"
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
            <p className="text-xs text-gray-400 text-center mt-8">
              No suggestions yet. Send a message to scan the treatment plan.
            </p>
          )}
          {openSuggestions === 0 && suggestions.length > 0 && (
            <p className="text-xs text-green-700 bg-green-50 rounded p-3 border border-green-200">
              All suggestions have been reviewed. No open items.
            </p>
          )}
          {suggestions.map(s => (
            <SuggestionCard key={s.id} suggestion={s} onResolve={handleResolve} />
          ))}
          {suggestions.filter(s => s.status !== 'open').length > 0 && (
            <div className="mt-2 border-t border-gray-200 pt-2">
              <p className="text-xs font-semibold text-gray-400 mb-1">Resolved</p>
              {suggestions.filter(s => s.status !== 'open').map(s => (
                <div key={s.id} className="text-xs text-gray-400 py-1 flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${SEVERITY_BADGE[s.severity]}`}>
                    {s.severity}
                  </span>
                  <span className="line-through">{s.title}</span>
                  <span className="capitalize text-gray-400">[{s.status}]</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Disclaimer */}
      <div className="border-t border-gray-200 px-4 py-1.5 shrink-0">
        <p className="text-[10px] text-amber-700">
          All Copilot responses are automated suggestions only. Clinician review and approval required for all clinical decisions.
        </p>
      </div>
    </div>
  );
}
