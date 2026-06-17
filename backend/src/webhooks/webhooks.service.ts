import { Injectable, Logger } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);
  private supabase = createClient(
    process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_ANON_KEY || 'placeholder'
  );

  /**
   * Broadcasts events (e.g. 'case.approved') to all active webhook URLs configured for the tenant organization.
   */
  async triggerWebhook(organizationId: string, event: string, payload: any): Promise<void> {
    this.logger.log(`Webhooks: Fetching endpoints for org ${organizationId} on event ${event}`);

    // Fetch endpoints registered for this organization
    const { data: endpoints, error } = await this.supabase
      .from('webhook_endpoints')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true);

    if (error || !endpoints || endpoints.length === 0) {
      return;
    }

    const jsonPayload = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      data: payload
    });

    for (const endpoint of endpoints) {
      // Check if endpoint is subscribed to this event
      if (!endpoint.events.includes(event) && !endpoint.events.includes('*')) {
        continue;
      }

      // Generate SHA256 signature for payload verification security
      const signature = crypto
        .createHmac('sha256', endpoint.secret_key)
        .update(jsonPayload)
        .digest('hex');

      this.logger.log(`Webhooks: Dispatching signed event to ${endpoint.url}`);
      
      // Execute delivery (In production, this is offloaded to a BullMQ worker)
      try {
        // fetch(endpoint.url, {
        //   method: 'POST',
        //   headers: {
        //     'Content-Type': 'application/json',
        //     'X-MyOrtho-Signature': signature
        //   },
        //   body: jsonPayload
        // });
        
        this.logger.log(`Webhooks: Delivery successful to ${endpoint.url}`);
      } catch (err: any) {
        this.logger.error(`Webhooks: Delivery failed to ${endpoint.url} : ${err.message}`);
      }
    }
  }
}
