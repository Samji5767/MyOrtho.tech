'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  startConversation,
  streamMessage,
  type CopilotConversation,
  type StreamEvent,
} from '@/lib/api/copilot';

// ─── Types ─────────────────────────────────────────────────────────────────

type AgentType = 'clinical' | 'planning' | 'cad' | 'manufacturing' | 'practice' | 'support';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  agentType?: AgentType;
  sources?: Array<{ title: string; source: string }>;
  streaming?: boolean;
}

// ─── Config ─────────────────────────────────────────────────────────────────

const AGENT_LABELS: Record<AgentType, string> = {
  clinical:      'Clinical',
  planning:      'Planning',
  cad:           'CAD',
  manufacturing: 'Mfg',
  practice:      'Practice',
  support:       'Support',
};

const AGENT_COLORS: Record<AgentType, string> = {
  clinical:      'bg-rose-500/10 text-rose-600 border-rose-200',
  planning:      'bg-blue-500/10 text-blue-600 border-blue-200',
  cad:           'bg-violet-500/10 text-violet-600 border-violet-200',
  manufacturing: 'bg-amber-500/10 text-amber-600 border-amber-200',
  practice:      'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  support:       'bg-gray-500/10 text-gray-600 border-gray-200',
};

const QUICK_PROMPTS: Record<AgentType, string[]> = {
  clinical:      ['Any Kravitz violations?', 'IPR enamel safety?', 'PDL stress status?'],
  planning:      ['How many stages?', 'Arch coordination score?', 'Staging summary?'],
  cad:           ['Attachment collisions?', 'Shell thickness?', 'Mesh valid?'],
  manufacturing: ['Production timeline?', 'Material specs?', 'QC checklist?'],
  practice:      ['CDT codes?', 'Next appointment?', 'Billing notes?'],
  support:       ['Upload requirements?', 'File formats?', 'API docs?'],
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function AgentBadge({ agentType }: { agentType: AgentType }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${AGENT_COLORS[agentType]}`}
    >
      {AGENT_LABELS[agentType]}
    </span>
  );
}

function CitationsRow({ sources }: { sources: Array<{ title: string; source: string }> }) {
  if (sources.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {sources.map(s => (
        <span
          key={s.source}
          title={s.title}
          className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 border border-slate-200"
        >
          {s.source}
        </span>
      ))}
    </div>
  );
}

function MessageRow({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2.5 text-xs leading-relaxed ${
          isUser
            ? 'rounded-tr-none bg-blue-600 text-white'
            : 'rounded-tl-none bg-slate-50 border border-slate-200 text-slate-900'
        }`}
      >
        {!isUser && msg.agentType && (
          <div className="mb-1">
            <AgentBadge agentType={msg.agentType} />
          </div>
        )}
        <p className="whitespace-pre-wrap">
          {msg.content}
          {msg.streaming && (
            <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-current opacity-60" />
          )}
        </p>
        {!isUser && msg.sources && <CitationsRow sources={msg.sources} />}
      </div>
    </div>
  );
}

// ─── Main Widget ─────────────────────────────────────────────────────────────

interface Props {
  caseId: string;
  planId?: string;
}

type PanelState = 'closed' | 'panel';

export default function CopilotWidget({ caseId, planId }: Props) {
  const [panelState, setPanelState] = useState<PanelState>('closed');
  const [agentType, setAgentType] = useState<AgentType>('planning');
  const [conv, setConv] = useState<CopilotConversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const openPanel = useCallback(async () => {
    setPanelState('panel');
    if (conv) return;
    setStarting(true);
    setError(null);
    try {
      const c = await startConversation(caseId, planId);
      setConv(c);
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: 'AI Copilot ready. Select a specialist agent above or ask any question about this case.',
      }]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  }, [caseId, planId, conv]);

  const send = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || !conv || busy) return;
    setInput('');
    setBusy(true);
    setError(null);

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content,
    };
    setMessages(prev => [...prev, userMsg]);

    const assistantId = `a-${Date.now()}`;
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      streaming: true,
    };
    setMessages(prev => [...prev, assistantMsg]);

    try {
      let detectedAgent: AgentType = agentType;
      let sources: Array<{ title: string; source: string }> = [];

      for await (const event of streamMessage(caseId, conv.id, content)) {
        if (event.type === 'meta') {
          if (event.agentType) {
            detectedAgent = event.agentType as AgentType;
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantId ? { ...m, agentType: detectedAgent } : m,
              ),
            );
          }
          if (event.sources) {
            sources = event.sources;
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantId ? { ...m, sources } : m,
              ),
            );
          }
        } else if (event.type === 'delta' && event.content) {
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantId
                ? { ...m, content: m.content + event.content! }
                : m,
            ),
          );
        } else if (event.type === 'done') {
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantId ? { ...m, streaming: false } : m,
            ),
          );
        } else if (event.type === 'error') {
          setError(event.error ?? 'Unknown error');
          setMessages(prev => prev.filter(m => m.id !== assistantId));
        }
      }
    } catch (e) {
      setError((e as Error).message);
      setMessages(prev => prev.filter(m => m.id !== assistantId));
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }, [caseId, conv, input, agentType, busy]);

  const handleKey = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    },
    [send],
  );

  const quickPrompts = QUICK_PROMPTS[agentType];

  // ── Closed state ─────────────────────────────────────────────────────────
  if (panelState === 'closed') {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={openPanel}
          aria-label="Open AI Copilot"
          className="group flex items-center gap-2.5 rounded-full bg-blue-600 px-4 py-3 text-white shadow-lg shadow-blue-600/30 transition-all hover:bg-blue-700 hover:shadow-blue-600/40 hover:pr-5"
        >
          <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          <span className="text-sm font-semibold">AI Copilot</span>
        </button>
      </div>
    );
  }

  // ── Panel state ───────────────────────────────────────────────────────────
  return (
    <div className="fixed bottom-6 right-6 z-50 flex w-[380px] flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10"
      style={{ height: '520px' }}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2.5 border-b border-slate-100 px-4 py-3">
        <svg className="h-5 w-5 shrink-0 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900">AI Copilot</p>
          <p className="text-[10px] text-amber-600 font-medium truncate">Clinical Decision Support Only</p>
        </div>
        <button
          onClick={() => setPanelState('closed')}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Close"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Agent selector */}
      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-100 px-3 py-2 [&::-webkit-scrollbar]:hidden">
        {(Object.keys(AGENT_LABELS) as AgentType[]).map(a => (
          <button
            key={a}
            onClick={() => setAgentType(a)}
            className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all ${
              agentType === a
                ? `${AGENT_COLORS[a]} border-current`
                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
            }`}
          >
            {AGENT_LABELS[a]}
          </button>
        ))}
      </div>

      {/* Loading / error */}
      {starting && (
        <div className="flex flex-1 items-center justify-center text-xs text-slate-400">
          Starting conversation…
        </div>
      )}
      {error && !starting && (
        <div className="mx-3 mt-2 shrink-0 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Messages */}
      {!starting && (
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.map(m => (
            <MessageRow key={m.id} msg={m} />
          ))}
          {busy && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="text-xs text-slate-400 italic">Thinking…</div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Quick prompts */}
      {!starting && conv && (
        <div className="flex shrink-0 gap-1 overflow-x-auto border-t border-slate-100 px-3 py-1.5 [&::-webkit-scrollbar]:hidden">
          {quickPrompts.map(p => (
            <button
              key={p}
              onClick={() => send(p)}
              disabled={busy}
              className="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-40"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      {!starting && conv && (
        <div className="flex shrink-0 items-end gap-2 border-t border-slate-100 px-3 py-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask a question… (Enter to send)"
            rows={2}
            className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <button
            onClick={() => send()}
            disabled={busy || !input.trim()}
            className="mb-0.5 rounded-xl bg-blue-600 p-2.5 text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
            aria-label="Send"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
      )}

      {/* Disclaimer */}
      <div className="shrink-0 border-t border-slate-100 px-3 py-1.5">
        <p className="text-[9px] text-amber-700">
          AI suggestions only. Clinician review required for all clinical decisions.
        </p>
      </div>
    </div>
  );
}
