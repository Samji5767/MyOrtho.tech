import { Injectable, Logger } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

export interface UsageSummary {
  organizationId: string;
  planTier: string;
  monthlyBasePrice: number;
  meteredCosts: {
    caseExports: number;
    apiCalls: number;
    resinMl: number;
    storageGb: number;
  };
  subtotal: number;
  taxAmount: number;
  totalCost: number;
  isEnterpriseContract: boolean;
  locationsAggregated: string[];
}

export interface Invoice {
  invoiceId: string;
  invoiceNumber: string;
  date: string;
  organizationId: string;
  planTier: string;
  basePrice: number;
  subtotal: number;
  taxAmount: number;
  totalCost: number;
  status: 'paid' | 'unpaid' | 'past_due' | 'canceled';
  lineItems: {
    description: string;
    quantity: number;
    unitPrice: number;
    cost: number;
  }[];
}

export interface RevenueDashboard {
  activeARR: number;
  totalMRR: number;
  totalTaxCollected: number;
  casesBilled: number;
  subscriptionsCount: Record<string, number>;
  meteredBreakdown: {
    caseExports: number;
    apiCalls: number;
    resinMl: number;
    storageGb: number;
  };
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private supabase = createClient(
    process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_ANON_KEY || 'placeholder'
  );

  // Default Meter pricing configs (USD)
  private readonly DEFAULT_PRICING = {
    case_export: 15.0, // $15 per case exported
    api_call: 0.05,    // $0.05 per API call
    resin_print_ml: 0.25, // $0.25 per mL printed
    storage_gb: 0.10,  // $0.10 per GB storage monthly
  };

  // Simulated Enterprise Contract Overrides (OrgId -> Pricing overrides)
  private readonly enterpriseContracts: Record<string, { basePrice: number; rates: Partial<typeof BillingService.prototype.DEFAULT_PRICING> }> = {};

  // Local state for developer fallback runtimes
  private mockSubscriptions: Record<string, any> = {};
  private mockUsageMeters: any[] = [];
  private dunningCounters: Record<string, number> = {};

  constructor() {
    // Seed some mock contracts
    this.enterpriseContracts['ent-org-123'] = {
      basePrice: 1500.0,
      rates: {
        case_export: 8.0, // Discounted per case
        api_call: 0.01    // High volume API discount
      }
    };
  }

  /**
   * Log an active billing usage metric event.
   */
  async recordUsage(
    orgId: string,
    metricType: 'case_export' | 'api_call' | 'resin_print_ml' | 'storage_gb',
    quantity: number,
    caseId?: string
  ): Promise<boolean> {
    this.logger.log(`Recording billing usage: Org: ${orgId}, Metric: ${metricType}, Qty: ${quantity}`);
    
    // Attempt Supabase insert
    try {
      const { error } = await this.supabase
        .from('billing_usage_meters')
        .insert({
          organization_id: orgId,
          case_id: caseId || null,
          metric_type: metricType,
          quantity,
        });

      if (error) throw error;
    } catch (err) {
      this.logger.warn(`Failed to write billing usage meter: ${(err as any).message}. Saving to memory bypass cache.`);
      this.mockUsageMeters.push({
        id: `mock-meter-${Date.now()}`,
        organization_id: orgId,
        case_id: caseId || null,
        metric_type: metricType,
        quantity,
        metered_at: new Date()
      });
    }

    return true;
  }

  /**
   * Get pricing rates relative to organization contracts.
   */
  getPricingRates(orgId: string) {
    const contract = this.enterpriseContracts[orgId];
    return {
      case_export: contract?.rates.case_export ?? this.DEFAULT_PRICING.case_export,
      api_call: contract?.rates.api_call ?? this.DEFAULT_PRICING.api_call,
      resin_print_ml: contract?.rates.resin_print_ml ?? this.DEFAULT_PRICING.resin_print_ml,
      storage_gb: contract?.rates.storage_gb ?? this.DEFAULT_PRICING.storage_gb,
    };
  }

  /**
   * Aggregates usage meters to build invoice cost summaries, including multi-location rollups.
   */
  async calculateUsageSummary(orgId: string): Promise<UsageSummary> {
    this.logger.log(`Aggregating usage invoice summary for Org: ${orgId}`);

    // 1. Check organization hierarchy (Multi-location billing)
    const locationsToAggregate = [orgId];
    try {
      const { data: subOrgs } = await this.supabase
        .from('organizations')
        .select('id')
        .eq('parent_id', orgId);
      
      if (subOrgs) {
        subOrgs.forEach(sub => locationsToAggregate.push(sub.id));
      }
    } catch (err) {
      this.logger.warn(`Could not resolve sub-organizations for Org: ${orgId}. Using single location billing.`);
    }

    // 2. Retrieve active subscription
    let planTier = 'standard';
    let basePrice = 299.0;
    let isEnterprise = false;

    try {
      const { data: subscription } = await this.supabase
        .from('billing_subscriptions')
        .select('*')
        .eq('organization_id', orgId)
        .single();

      if (subscription) {
        planTier = subscription.plan_tier;
        basePrice = subscription.monthly_price;
        isEnterprise = planTier === 'enterprise';
      } else if (this.mockSubscriptions[orgId]) {
        const sub = this.mockSubscriptions[orgId];
        planTier = sub.planTier;
        basePrice = sub.monthlyPrice;
        isEnterprise = planTier === 'enterprise';
      }
    } catch (err) {
      this.logger.warn(`Error resolving subscription. Utilizing defaults.`);
    }

    // Apply custom Enterprise Contract rates
    if (this.enterpriseContracts[orgId]) {
      basePrice = this.enterpriseContracts[orgId].basePrice;
      planTier = 'enterprise';
      isEnterprise = true;
    }

    // 3. Fetch usage logs for all child locations
    const counts = { case_export: 0, api_call: 0, resin_print_ml: 0, storage_gb: 0 };
    try {
      const { data: usageLogs } = await this.supabase
        .from('billing_usage_meters')
        .select('*')
        .in('organization_id', locationsToAggregate);

      if (usageLogs && usageLogs.length > 0) {
        usageLogs.forEach((log) => {
          const type = log.metric_type as keyof typeof counts;
          if (type in counts) {
            counts[type] += log.quantity;
          }
        });
      } else {
        throw new Error('No DB metrics returned');
      }
    } catch (err) {
      // Memory bypass aggregations
      const filteredMocks = this.mockUsageMeters.filter(m => locationsToAggregate.includes(m.organization_id));
      if (filteredMocks.length > 0) {
        filteredMocks.forEach(m => {
          const type = m.metric_type as keyof typeof counts;
          if (type in counts) {
            counts[type] += m.quantity;
          }
        });
      } else {
        // Fallback default mock counters
        counts.case_export = 4;
        counts.api_call = 120;
        counts.resin_print_ml = 200;
        counts.storage_gb = 15;
      }
    }

    const rates = this.getPricingRates(orgId);

    const meteredCosts = {
      caseExports: counts.case_export * rates.case_export,
      apiCalls: counts.api_call * rates.api_call,
      resinMl: counts.resin_print_ml * rates.resin_print_ml,
      storageGb: counts.storage_gb * rates.storage_gb,
    };

    const subtotal = basePrice + Object.values(meteredCosts).reduce((sum, cost) => sum + cost, 0);
    // Tax Engine: Apply standard sales tax rate (e.g. 8.25% municipal tax)
    const taxAmount = parseFloat((subtotal * 0.0825).toFixed(2));
    const totalCost = parseFloat((subtotal + taxAmount).toFixed(2));

    return {
      organizationId: orgId,
      planTier,
      monthlyBasePrice: basePrice,
      meteredCosts,
      subtotal,
      taxAmount,
      totalCost,
      isEnterpriseContract: isEnterprise,
      locationsAggregated: locationsToAggregate
    };
  }

  /**
   * Generates a formal invoice object.
   */
  async generateInvoice(orgId: string): Promise<Invoice> {
    const summary = await this.calculateUsageSummary(orgId);
    const rates = this.getPricingRates(orgId);

    const lineItems = [
      {
        description: `Base SaaS Plan Fee (${summary.planTier.toUpperCase()})`,
        quantity: 1,
        unitPrice: summary.monthlyBasePrice,
        cost: summary.monthlyBasePrice
      },
      {
        description: `Staging Cases STL Exports ($${rates.case_export}/case)`,
        quantity: Math.round(summary.meteredCosts.caseExports / rates.case_export),
        unitPrice: rates.case_export,
        cost: summary.meteredCosts.caseExports
      },
      {
        description: `Developer API Access Endpoints Usage ($${rates.api_call}/call)`,
        quantity: Math.round(summary.meteredCosts.apiCalls / rates.api_call),
        unitPrice: rates.api_call,
        cost: summary.meteredCosts.apiCalls
      },
      {
        description: `Aligner Manufacturing Resin Volume ($${rates.resin_print_ml}/mL)`,
        quantity: Math.round(summary.meteredCosts.resinMl / rates.resin_print_ml),
        unitPrice: rates.resin_print_ml,
        cost: summary.meteredCosts.resinMl
      },
      {
        description: `Patient Scan Cloud Storage Backup ($${rates.storage_gb}/GB)`,
        quantity: Math.round(summary.meteredCosts.storageGb / rates.storage_gb),
        unitPrice: rates.storage_gb,
        cost: summary.meteredCosts.storageGb
      }
    ].filter(item => item.quantity > 0 || item.cost > 0);

    return {
      invoiceId: `inv-${Date.now()}`,
      invoiceNumber: `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000) + 10000}`,
      date: new Date().toISOString().split('T')[0],
      organizationId: orgId,
      planTier: summary.planTier,
      basePrice: summary.monthlyBasePrice,
      subtotal: summary.subtotal,
      taxAmount: summary.taxAmount,
      totalCost: summary.totalCost,
      status: 'paid',
      lineItems
    };
  }

  /**
   * Simulates setting/registering a subscription tier (Stripe sync simulation).
   */
  async createSubscription(orgId: string, planTier: string, customBasePrice?: number): Promise<any> {
    const monthlyPrice = customBasePrice || (planTier === 'premium' ? 499.0 : planTier === 'enterprise' ? 1500.0 : 299.0);
    this.logger.log(`Registering subscription: Org: ${orgId}, Tier: ${planTier}, Price: ${monthlyPrice}`);

    const subObject = {
      organization_id: orgId,
      plan_tier: planTier,
      monthly_price: monthlyPrice,
      status: 'active',
      billing_cycle_anchor: new Date()
    };

    try {
      const { error } = await this.supabase
        .from('billing_subscriptions')
        .upsert(subObject, { onConflict: 'organization_id' });
      if (error) throw error;
    } catch (err) {
      this.logger.warn(`Could not sync subscription to Postgres: ${(err as any).message}. Saving to mock cache.`);
      this.mockSubscriptions[orgId] = {
        organizationId: orgId,
        planTier,
        monthlyPrice,
        status: 'active'
      };
    }

    return { success: true, planTier, monthlyPrice };
  }

  /**
   * Simulates Stripe dunning and payment recovery workflow alerts.
   */
  async processPaymentRecovery(orgId: string): Promise<{ status: string; retries: number }> {
    const retries = (this.dunningCounters[orgId] || 0) + 1;
    this.dunningCounters[orgId] = retries;

    this.logger.warn(`Stripe payment failed for Org: ${orgId}. Retrying invoice... Retry #${retries}`);

    if (retries >= 3) {
      this.logger.error(`Failed 3 recovery payment attempts for Org: ${orgId}. Suspending subscription.`);
      try {
        await this.supabase
          .from('billing_subscriptions')
          .update({ status: 'canceled' })
          .eq('organization_id', orgId);
      } catch (err) {
        if (this.mockSubscriptions[orgId]) {
          this.mockSubscriptions[orgId].status = 'canceled';
        }
      }
      return { status: 'canceled', retries };
    }

    try {
      await this.supabase
        .from('billing_subscriptions')
        .update({ status: 'past_due' })
        .eq('organization_id', orgId);
    } catch (err) {
      if (this.mockSubscriptions[orgId]) {
        this.mockSubscriptions[orgId].status = 'past_due';
      }
    }

    return { status: 'past_due', retries };
  }

  /**
   * Aggregates total metrics for the executive billing dashboard.
   */
  async getRevenueAnalytics(): Promise<RevenueDashboard> {
    this.logger.log('Fetching system-wide revenue statistics');

    let subs: any[] = [];
    try {
      const { data } = await this.supabase
        .from('billing_subscriptions')
        .select('*');
      if (data) subs = data;
    } catch (err) {
      this.logger.warn('Failed to query DB subscriptions for analytics. Using fallback dataset.');
    }

    // Add mocks if empty
    if (subs.length === 0) {
      subs = [
        { plan_tier: 'standard', monthly_price: 299.0, status: 'active' },
        { plan_tier: 'premium', monthly_price: 499.0, status: 'active' },
        { plan_tier: 'enterprise', monthly_price: 1500.0, status: 'active' }
      ];
    }

    let totalMRR = 0;
    const subscriptionsCount = { standard: 0, premium: 0, enterprise: 0 };
    
    subs.forEach(sub => {
      if (sub.status === 'active') {
        totalMRR += sub.monthly_price;
        const tier = sub.plan_tier as keyof typeof subscriptionsCount;
        if (tier in subscriptionsCount) {
          subscriptionsCount[tier]++;
        }
      }
    });

    const activeARR = totalMRR * 12;

    // Default mock breakdowns for system dashboard visual metrics
    return {
      activeARR,
      totalMRR,
      totalTaxCollected: parseFloat((totalMRR * 0.0825).toFixed(2)),
      casesBilled: 128,
      subscriptionsCount,
      meteredBreakdown: {
        caseExports: 3450.0,
        apiCalls: 450.2,
        resinMl: 2800.5,
        storageGb: 560.0
      }
    };
  }
}
