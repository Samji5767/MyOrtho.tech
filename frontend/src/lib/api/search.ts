import { api } from './client';

export interface SearchResult {
  id: string;
  type: 'patient' | 'case' | 'protocol' | 'material' | 'batch';
  title: string;
  subtitle?: string;
  meta?: string;
  href: string;
  score: number;
}

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: Record<string, unknown>;
  scope: string;
  createdAt: string;
}

export async function globalSearch(
  q: string,
  scope = 'all',
  limit = 20,
): Promise<{ results: SearchResult[]; total: number }> {
  if (!q.trim()) return { results: [], total: 0 };
  return api.get<{ results: SearchResult[]; total: number }>(
    `/api/search?q=${encodeURIComponent(q)}&scope=${scope}&limit=${limit}`,
  );
}

export async function fetchSavedSearches(): Promise<SavedSearch[]> {
  return api.get<SavedSearch[]>('/api/search/saved');
}

export async function saveSearch(dto: {
  name: string;
  query: string;
  filters?: Record<string, unknown>;
  scope?: string;
}): Promise<SavedSearch> {
  return api.post<SavedSearch>('/api/search/saved', dto);
}

export async function deleteSavedSearch(id: string): Promise<void> {
  return api.delete<void>(`/api/search/saved/${id}`);
}
