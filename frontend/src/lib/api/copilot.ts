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
