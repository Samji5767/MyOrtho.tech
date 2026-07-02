import { Injectable, Logger } from '@nestjs/common';

// OpenAI text-embedding-3-small produces 1536-dimension vectors.
// Anthropic does not offer a public embedding API as of 2025-Q3.
const EMBED_MODEL = 'text-embedding-3-small';
const EMBED_DIM = 1536;

interface OpenAIEmbedResponse {
  data: Array<{ embedding: number[] }>;
}

@Injectable()
export class EmbeddingService {
  private readonly log = new Logger(EmbeddingService.name);
  private readonly apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env['COPILOT_EMBED_API_KEY'] || process.env['COPILOT_LLM_API_KEY'];
    if (!this.apiKey) {
      this.log.warn('COPILOT_EMBED_API_KEY not set — vector search disabled, RAG will run without retrieval');
    }
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  get dimension(): number {
    return EMBED_DIM;
  }

  async embed(text: string): Promise<number[] | null> {
    if (!this.apiKey) return null;
    try {
      const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ model: EMBED_MODEL, input: text }),
      });
      if (!res.ok) {
        const body = await res.text();
        this.log.error(`Embedding API error ${res.status}: ${body}`);
        return null;
      }
      const json = (await res.json()) as OpenAIEmbedResponse;
      return json.data[0]?.embedding ?? null;
    } catch (err) {
      this.log.error('Embedding request failed', (err as Error).message);
      return null;
    }
  }

  async embedBatch(texts: string[]): Promise<Array<number[] | null>> {
    if (!this.apiKey || texts.length === 0) return texts.map(() => null);
    try {
      const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
      });
      if (!res.ok) {
        this.log.error(`Batch embedding API error ${res.status}`);
        return texts.map(() => null);
      }
      const json = (await res.json()) as OpenAIEmbedResponse;
      return json.data.map(d => d.embedding ?? null);
    } catch (err) {
      this.log.error('Batch embedding request failed', (err as Error).message);
      return texts.map(() => null);
    }
  }
}
