import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import * as crypto from 'crypto';
import { PG_POOL } from '../database/database.module';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async triggerWebhook(organizationId: string, event: string, payload: unknown): Promise<void> {
    const { rows: endpoints } = await this.pool.query(
      `SELECT id, url, events, secret_hash FROM webhook_endpoints
       WHERE organization_id = $1 AND is_active = true`,
      [organizationId],
    );
    if (!endpoints.length) return;

    const jsonPayload = JSON.stringify({ event, timestamp: new Date().toISOString(), data: payload });

    for (const ep of endpoints) {
      const events = ep.events as string[];
      if (!events.includes(event) && !events.includes('*')) continue;

      const signature = ep.secret_hash
        ? crypto.createHmac('sha256', ep.secret_hash as string).update(jsonPayload).digest('hex')
        : null;

      let httpCode = 0;
      let deliveryStatus: 'success' | 'failure' = 'failure';
      try {
        const res = await fetch(ep.url as string, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(signature ? { 'X-MyOrtho-Signature': `sha256=${signature}` } : {}),
          },
          body: jsonPayload,
          signal: AbortSignal.timeout(10_000),
        });
        httpCode = res.status;
        deliveryStatus = res.ok ? 'success' : 'failure';
      } catch (err: unknown) {
        this.logger.error(`Webhook delivery failed to ${ep.url}: ${(err as Error).message}`);
      }

      await this.pool.query(
        `UPDATE webhook_endpoints
         SET last_delivery_at = now(), last_delivery_status = $2, last_delivery_http_code = $3
         WHERE id = $1`,
        [ep.id, deliveryStatus, httpCode],
      );
    }
  }

  async listEndpoints(orgId: string) {
    const { rows } = await this.pool.query(
      `SELECT id, url, events, is_active, last_delivery_at, last_delivery_status, created_at
       FROM webhook_endpoints WHERE organization_id = $1 ORDER BY created_at DESC`,
      [orgId],
    );
    return rows;
  }

  async createEndpoint(orgId: string, url: string, events: string[], secret?: string) {
    const secretHash = secret ? crypto.createHash('sha256').update(secret).digest('hex') : null;
    const { rows } = await this.pool.query(
      `INSERT INTO webhook_endpoints (organization_id, url, events, secret_hash)
       VALUES ($1, $2, $3, $4) RETURNING id, url, events, is_active, created_at`,
      [orgId, url, events, secretHash],
    );
    return rows[0];
  }

  async deleteEndpoint(orgId: string, endpointId: string) {
    await this.pool.query(
      `DELETE FROM webhook_endpoints WHERE id = $1 AND organization_id = $2`,
      [endpointId, orgId],
    );
  }
}
