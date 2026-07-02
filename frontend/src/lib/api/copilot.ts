const BASE = '/api';

export interface CopilotSuggestion {
  id: string;
  suggestionType: string;
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'critical';
  module: string;
  data: Record<string, unknown>;
  status: 'open' | 'acknowledged' | 'dismissed' | 'applied';
  clinicianNote: string | null;
  createdAt: string;
}

export interface CopilotMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  intent: string | null;
  referencedModule: string | null;
  suggestions: CopilotSuggestion[];
  latencyMs: number | null;
  createdAt: string;
}

export interface CopilotConversation {
  id: string;
  caseId: string;
  planId: string | null;
  title: string | null;
  messageCount: number;
  contextSnapshot: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export async function startConversation(
  caseId: string,
  planId?: string,
): Promise<CopilotConversation> {
  const res = await fetch(`${BASE}/cases/${caseId}/copilot/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listConversations(caseId: string): Promise<CopilotConversation[]> {
  const res = await fetch(`${BASE}/cases/${caseId}/copilot/conversations`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function sendMessage(
  caseId: string,
  conversationId: string,
  content: string,
): Promise<CopilotMessage> {
  const res = await fetch(
    `${BASE}/cases/${caseId}/copilot/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    },
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getMessages(
  caseId: string,
  conversationId: string,
): Promise<CopilotMessage[]> {
  const res = await fetch(
    `${BASE}/cases/${caseId}/copilot/conversations/${conversationId}/messages`,
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listSuggestions(
  caseId: string,
  planId?: string,
): Promise<CopilotSuggestion[]> {
  const url = planId
    ? `${BASE}/cases/${caseId}/copilot/suggestions?planId=${planId}`
    : `${BASE}/cases/${caseId}/copilot/suggestions`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ─── Streaming (SSE) ─────────────────────────────────────────────────────────

export interface StreamEvent {
  type: 'meta' | 'delta' | 'done' | 'error';
  agentType?: string;
  suggestionCount?: number;
  content?: string;
  error?: string;
  messageId?: string;
  sources?: Array<{ title: string; source: string }>;
}

export async function* streamMessage(
  caseId: string,
  conversationId: string,
  content: string,
): AsyncGenerator<StreamEvent> {
  const res = await fetch(
    `${BASE}/cases/${caseId}/copilot/conversations/${conversationId}/stream`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    },
  );

  if (!res.ok) throw new Error(await res.text());
  if (!res.body) throw new Error('No response body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (!raw) continue;
      try {
        yield JSON.parse(raw) as StreamEvent;
      } catch {
        // skip malformed line
      }
    }
  }
}

export async function resolveSuggestion(
  caseId: string,
  suggestionId: string,
  status: 'acknowledged' | 'dismissed' | 'applied',
  clinicianNote?: string,
): Promise<CopilotSuggestion> {
  const res = await fetch(
    `${BASE}/cases/${caseId}/copilot/suggestions/${suggestionId}/resolve`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, clinicianNote }),
    },
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
