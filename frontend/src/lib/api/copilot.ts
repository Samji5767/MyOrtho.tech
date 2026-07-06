import { api } from './client';

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

export const startConversation = (
  caseId: string,
  planId?: string,
): Promise<CopilotConversation> =>
  api.post<CopilotConversation>(`/api/cases/${caseId}/copilot/conversations`, { planId });

export const listConversations = (caseId: string): Promise<CopilotConversation[]> =>
  api.get<CopilotConversation[]>(`/api/cases/${caseId}/copilot/conversations`);

export const sendMessage = (
  caseId: string,
  conversationId: string,
  content: string,
): Promise<CopilotMessage> =>
  api.post<CopilotMessage>(
    `/api/cases/${caseId}/copilot/conversations/${conversationId}/messages`,
    { content },
  );

export const getMessages = (
  caseId: string,
  conversationId: string,
): Promise<CopilotMessage[]> =>
  api.get<CopilotMessage[]>(
    `/api/cases/${caseId}/copilot/conversations/${conversationId}/messages`,
  );

export const listSuggestions = (
  caseId: string,
  planId?: string,
): Promise<CopilotSuggestion[]> => {
  const url = planId
    ? `/api/cases/${caseId}/copilot/suggestions?planId=${planId}`
    : `/api/cases/${caseId}/copilot/suggestions`;
  return api.get<CopilotSuggestion[]>(url);
};

// ─── Streaming (SSE) — must use raw fetch; api client does not support streaming ─

export interface StreamEvent {
  type: 'meta' | 'delta' | 'done' | 'error';
  agentType?: string;
  suggestionCount?: number;
  content?: string;
  error?: string;
  messageId?: string;
  sources?: Array<{ title: string; source: string }>;
}

const STREAM_BASE = typeof process !== 'undefined' ? (process.env.NEXT_PUBLIC_API_URL ?? '') : '';

export async function* streamMessage(
  caseId: string,
  conversationId: string,
  content: string,
): AsyncGenerator<StreamEvent> {
  const res = await fetch(
    `${STREAM_BASE}/api/cases/${caseId}/copilot/conversations/${conversationId}/stream`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
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

export const resolveSuggestion = (
  caseId: string,
  suggestionId: string,
  status: 'acknowledged' | 'dismissed' | 'applied',
  clinicianNote?: string,
): Promise<CopilotSuggestion> =>
  api.patch<CopilotSuggestion>(
    `/api/cases/${caseId}/copilot/suggestions/${suggestionId}/resolve`,
    { status, clinicianNote },
  );
