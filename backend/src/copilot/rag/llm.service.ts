import { Injectable, Logger } from '@nestjs/common';

export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface StreamEvent {
  type: 'delta' | 'done' | 'error' | 'meta';
  content?: string;
  error?: string;
  agentType?: string;
  suggestionCount?: number;
}

type Provider = 'anthropic' | 'openai';

// Anthropic claude-haiku-4-5 — fast and cost-effective for clinical Q&A
const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';
// OpenAI gpt-4o-mini as alternative
const OPENAI_MODEL = 'gpt-4o-mini';

@Injectable()
export class LlmService {
  private readonly log = new Logger(LlmService.name);
  private readonly provider: Provider | null;
  private readonly apiKey: string | undefined;

  constructor() {
    const raw = (process.env['COPILOT_LLM_PROVIDER'] ?? '').toLowerCase();
    this.apiKey = process.env['COPILOT_LLM_API_KEY'];
    if (raw === 'anthropic' && this.apiKey) {
      this.provider = 'anthropic';
      this.log.log('LLM provider: Anthropic (claude-haiku)');
    } else if (raw === 'openai' && this.apiKey) {
      this.provider = 'openai';
      this.log.log('LLM provider: OpenAI (gpt-4o-mini)');
    } else {
      this.provider = null;
      if (!raw) {
        this.log.warn('COPILOT_LLM_PROVIDER not set — streaming copilot will use rule engine fallback');
      } else {
        this.log.warn(`Unknown provider "${raw}" or missing COPILOT_LLM_API_KEY — streaming disabled`);
      }
    }
  }

  isConfigured(): boolean {
    return this.provider !== null && !!this.apiKey;
  }

  async complete(messages: LlmMessage[], system: string): Promise<string> {
    if (!this.isConfigured()) return '';
    if (this.provider === 'anthropic') return this.anthropicComplete(messages, system);
    return this.openaiComplete(messages, system);
  }

  async *stream(messages: LlmMessage[], system: string): AsyncGenerator<string> {
    if (!this.isConfigured()) return;
    if (this.provider === 'anthropic') {
      yield* this.anthropicStream(messages, system);
    } else {
      yield* this.openaiStream(messages, system);
    }
  }

  // ─── Anthropic ────────────────────────────────────────────────────────────

  private async anthropicComplete(messages: LlmMessage[], system: string): Promise<string> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1024,
        system,
        messages,
      }),
    });
    if (!res.ok) {
      throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as { content: Array<{ text: string }> };
    return json.content.map(c => c.text).join('');
  }

  private async *anthropicStream(messages: LlmMessage[], system: string): AsyncGenerator<string> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1024,
        stream: true,
        system,
        messages,
      }),
    });

    if (!res.ok) {
      throw new Error(`Anthropic streaming error ${res.status}: ${await res.text()}`);
    }
    if (!res.body) throw new Error('No response body from Anthropic');

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
        if (!raw || raw === '[DONE]') continue;
        try {
          const ev = JSON.parse(raw) as { type: string; delta?: { type: string; text?: string } };
          if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta' && ev.delta.text) {
            yield ev.delta.text;
          }
        } catch {
          // ignore malformed SSE line
        }
      }
    }
  }

  // ─── OpenAI ───────────────────────────────────────────────────────────────

  private async openaiComplete(messages: LlmMessage[], system: string): Promise<string> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        max_tokens: 1024,
        messages: [{ role: 'system', content: system }, ...messages],
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI API error ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as { choices: Array<{ message: { content: string } }> };
    return json.choices[0]?.message.content ?? '';
  }

  private async *openaiStream(messages: LlmMessage[], system: string): AsyncGenerator<string> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        max_tokens: 1024,
        stream: true,
        messages: [{ role: 'system', content: system }, ...messages],
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI streaming error ${res.status}: ${await res.text()}`);
    }
    if (!res.body) throw new Error('No response body from OpenAI');

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
        if (!raw || raw === '[DONE]') continue;
        try {
          const ev = JSON.parse(raw) as { choices: Array<{ delta?: { content?: string } }> };
          const text = ev.choices?.[0]?.delta?.content;
          if (text) yield text;
        } catch {
          // ignore malformed SSE line
        }
      }
    }
  }
}
