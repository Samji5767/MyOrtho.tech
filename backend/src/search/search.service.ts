import { Injectable, Inject } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import { CryptoService } from '../common/crypto.service';

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

@Injectable()
export class SearchService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly cryptoService: CryptoService,
  ) {}

  async search(
    q: string,
    orgId: string,
    scope: string = 'all',
    limit = 20,
  ): Promise<{ results: SearchResult[]; total: number }> {
    if (!q || q.trim().length < 1) return { results: [], total: 0 };
    const term = q.trim().toLowerCase();
    const results: SearchResult[] = [];

    const searches: Promise<void>[] = [];

    if (scope === 'all' || scope === 'patients') {
      searches.push(this.searchPatients(term, orgId, limit, results));
    }
    if (scope === 'all' || scope === 'cases') {
      searches.push(this.searchCases(term, orgId, limit, results));
    }
    if (scope === 'all' || scope === 'protocols') {
      searches.push(this.searchProtocols(term, orgId, limit, results));
    }
    if (scope === 'all' || scope === 'materials') {
      searches.push(this.searchMaterials(term, orgId, limit, results));
    }
    if (scope === 'all' || scope === 'batches') {
      searches.push(this.searchBatches(term, orgId, limit, results));
    }

    await Promise.all(searches);

    results.sort((a, b) => b.score - a.score);
    const total = results.length;
    return { results: results.slice(0, limit), total };
  }

  private async searchPatients(term: string, orgId: string, limit: number, out: SearchResult[]) {
    const { rows } = await this.pool.query(
      `SELECT id, first_name, last_name, gender, created_at FROM patients
       WHERE organization_id = $1 LIMIT $2`,
      [orgId, limit * 3],
    );
    for (const row of rows) {
      const first = this.cryptoService.decrypt(row['first_name'] as string | null) ?? '';
      const last = this.cryptoService.decrypt(row['last_name'] as string | null) ?? '';
      const full = `${first} ${last}`.toLowerCase();
      if (!full.includes(term) && !first.toLowerCase().includes(term) && !last.toLowerCase().includes(term)) continue;
      const startScore = full.startsWith(term) ? 20 : first.toLowerCase().startsWith(term) ? 15 : 10;
      out.push({
        id: row['id'] as string,
        type: 'patient',
        title: `${first} ${last}`.trim(),
        subtitle: this.cryptoService.decrypt(row['gender'] as string | null) ?? undefined,
        meta: new Date(row['created_at'] as string).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }),
        href: `/patients/${row['id']}`,
        score: startScore,
      });
    }
  }

  private async searchCases(term: string, orgId: string, limit: number, out: SearchResult[]) {
    const { rows } = await this.pool.query(
      `SELECT c.id, c.status, c.chief_complaint, c.created_at,
              p.first_name, p.last_name
       FROM cases c
       JOIN patients p ON p.id = c.patient_id
       WHERE c.organization_id = $1 LIMIT $2`,
      [orgId, limit * 3],
    );
    for (const row of rows) {
      const complaint = ((row['chief_complaint'] as string | null) ?? '').toLowerCase();
      const status = ((row['status'] as string) ?? '').toLowerCase();
      const id = (row['id'] as string).toLowerCase();
      const first = this.cryptoService.decrypt(row['first_name'] as string | null) ?? '';
      const last = this.cryptoService.decrypt(row['last_name'] as string | null) ?? '';
      const patientName = `${first} ${last}`.toLowerCase();
      if (!complaint.includes(term) && !status.includes(term) && !id.includes(term) && !patientName.includes(term)) continue;
      out.push({
        id: row['id'] as string,
        type: 'case',
        title: `Case — ${first} ${last}`.trim(),
        subtitle: (row['chief_complaint'] as string | null) ?? undefined,
        meta: (row['status'] as string).replace(/_/g, ' '),
        href: `/cases/${row['id']}`,
        score: complaint.startsWith(term) ? 12 : 8,
      });
    }
  }

  private async searchProtocols(term: string, orgId: string, limit: number, out: SearchResult[]) {
    const { rows } = await this.pool.query(
      `SELECT id, name, description, status FROM clinical_protocols
       WHERE organization_id = $1 AND (LOWER(name) LIKE $2 OR LOWER(description) LIKE $2)
       LIMIT $3`,
      [orgId, `%${term}%`, limit],
    );
    for (const row of rows) {
      out.push({
        id: row['id'] as string,
        type: 'protocol',
        title: row['name'] as string,
        subtitle: (row['description'] as string | null) ?? undefined,
        meta: row['status'] as string,
        href: `/settings/clinical-knowledge`,
        score: (row['name'] as string).toLowerCase().startsWith(term) ? 11 : 7,
      });
    }
  }

  private async searchMaterials(term: string, orgId: string, limit: number, out: SearchResult[]) {
    const { rows } = await this.pool.query(
      `SELECT id, name, description, material_type FROM material_libraries
       WHERE organization_id = $1 AND (LOWER(name) LIKE $2 OR LOWER(description) LIKE $2)
       LIMIT $3`,
      [orgId, `%${term}%`, limit],
    );
    for (const row of rows) {
      out.push({
        id: row['id'] as string,
        type: 'material',
        title: row['name'] as string,
        subtitle: (row['description'] as string | null) ?? undefined,
        meta: row['material_type'] as string,
        href: `/settings/clinical-knowledge`,
        score: 6,
      });
    }
  }

  private async searchBatches(term: string, orgId: string, limit: number, out: SearchResult[]) {
    const { rows } = await this.pool.query(
      `SELECT id, batch_number, status, created_at FROM manufacturing_batches
       WHERE organization_id = $1 AND LOWER(batch_number) LIKE $2
       LIMIT $3`,
      [orgId, `%${term}%`, limit],
    ).catch(() => ({ rows: [] }));
    for (const row of rows) {
      out.push({
        id: row['id'] as string,
        type: 'batch',
        title: `Batch ${row['batch_number']}`,
        meta: row['status'] as string,
        href: `/manufacturing/batches`,
        score: 5,
      });
    }
  }

  async getSavedSearches(userId: string, orgId: string): Promise<SavedSearch[]> {
    const { rows } = await this.pool.query(
      `SELECT id, name, query, filters, scope, created_at FROM saved_searches
       WHERE user_id = $1 AND organization_id = $2
       ORDER BY created_at DESC LIMIT 50`,
      [userId, orgId],
    );
    return rows.map((r) => ({
      id: r['id'] as string,
      name: r['name'] as string,
      query: r['query'] as string,
      filters: (r['filters'] as Record<string, unknown>) ?? {},
      scope: r['scope'] as string,
      createdAt: r['created_at'] as string,
    }));
  }

  async saveSearch(
    userId: string,
    orgId: string,
    dto: { name: string; query: string; filters?: Record<string, unknown>; scope?: string },
  ): Promise<SavedSearch> {
    const { rows } = await this.pool.query(
      `INSERT INTO saved_searches (user_id, organization_id, name, query, filters, scope)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, orgId, dto.name, dto.query, JSON.stringify(dto.filters ?? {}), dto.scope ?? 'all'],
    );
    const r = rows[0];
    return {
      id: r['id'] as string,
      name: r['name'] as string,
      query: r['query'] as string,
      filters: (r['filters'] as Record<string, unknown>) ?? {},
      scope: r['scope'] as string,
      createdAt: r['created_at'] as string,
    };
  }

  async deleteSavedSearch(id: string, userId: string, orgId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM saved_searches WHERE id = $1 AND user_id = $2 AND organization_id = $3`,
      [id, userId, orgId],
    );
  }
}
