import { BillingService } from './billing.service';

function makePool(rows: Record<string, unknown>[] = []) {
  return { query: jest.fn().mockResolvedValue({ rows }) } as any;
}

describe('BillingService', () => {
  // Stripe is optional — null here for pure unit tests
  function makeService(pool: any) {
    // Bypass constructor's Stripe init by injecting via reflection
    const svc = Object.create(BillingService.prototype) as BillingService;
    (svc as any).pool = pool;
    (svc as any).stripe = null;
    (svc as any).logger = { warn: jest.fn(), log: jest.fn(), debug: jest.fn(), error: jest.fn() };
    return svc;
  }

  // ─── listPlans ─────────────────────────────────────────────────────────────

  describe('listPlans', () => {
    it('returns mapped plan objects from the database', async () => {
      const pool = makePool([
        { slug: 'payg', name: 'Pay-As-You-Go', price_usd_cents: 0, is_unlimited: false, max_cases_per_month: null },
        { slug: 'unlimited_professional', name: 'Unlimited Professional', price_usd_cents: 49900, is_unlimited: true, max_cases_per_month: null },
      ]);
      const svc = makeService(pool);
      const plans = await svc.listPlans();

      expect(plans).toHaveLength(2);
      expect(plans[0].slug).toBe('payg');
      expect(plans[0].priceUsdCents).toBe(0);
      expect(plans[1].priceUsdCents).toBe(49900);
      expect(plans[1].isUnlimited).toBe(true);
    });

    it('returns an empty array when no active plans exist', async () => {
      const svc = makeService(makePool([]));
      expect(await svc.listPlans()).toEqual([]);
    });
  });

  // ─── calculateUsageSummary ─────────────────────────────────────────────────

  describe('calculateUsageSummary', () => {
    it('returns active unlimited subscription data', async () => {
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce({
            rows: [{
              status: 'active', cases_this_period: 12, current_period_end: '2026-07-28',
              slug: 'unlimited_professional', name: 'Unlimited Professional',
              price_usd_cents: 49900, max_cases_per_month: null, is_unlimited: true,
            }],
          })
          .mockResolvedValueOnce({ rows: [{ balance: 500 }] }),
      } as any;
      const svc = makeService(pool);
      const summary = await svc.calculateUsageSummary('org-1');

      expect(summary.planSlug).toBe('unlimited_professional');
      expect(summary.isUnlimited).toBe(true);
      expect(summary.casesThisPeriod).toBe(12);
      expect(summary.creditBalance).toBe(500);
    });

    it('returns default no-plan values when there is no active subscription', async () => {
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] }),
      } as any;
      const svc = makeService(pool);
      const summary = await svc.calculateUsageSummary('org-2');

      expect(summary.planSlug).toBe('none');
      expect(summary.status).toBe('none');
      expect(summary.creditBalance).toBe(0);
    });
  });

  // ─── generateInvoice ──────────────────────────────────────────────────────

  describe('generateInvoice', () => {
    it('returns a paid invoice for an active subscription', async () => {
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce({
            rows: [{
              status: 'active', cases_this_period: 3, current_period_end: null,
              slug: 'unlimited_professional', name: 'Unlimited Professional',
              price_usd_cents: 49900, max_cases_per_month: null, is_unlimited: true,
            }],
          })
          .mockResolvedValueOnce({ rows: [] }),
      } as any;
      const svc = makeService(pool);
      const invoice = await svc.generateInvoice('org-3');

      expect(invoice.status).toBe('paid');
      expect(invoice.totalCents).toBe(49900);
      expect(invoice.lineItems).toHaveLength(1);
      expect(invoice.invoiceId).toMatch(/^INV-/);
    });

    it('returns an unpaid invoice with zero total when there is no subscription', async () => {
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] }),
      } as any;
      const svc = makeService(pool);
      const invoice = await svc.generateInvoice('org-4');

      expect(invoice.status).toBe('unpaid');
      expect(invoice.totalCents).toBe(0);
      expect(invoice.lineItems).toHaveLength(0);
    });
  });

  // ─── createSubscription ────────────────────────────────────────────────────

  describe('createSubscription', () => {
    it('throws BadRequestException for unknown plan slug', async () => {
      const pool = { query: jest.fn().mockResolvedValue({ rows: [] }) } as any;
      const svc = makeService(pool);
      await expect(svc.createSubscription('org-1', 'nonexistent_plan')).rejects.toThrow();
    });

    it('creates subscription and returns subscriptionId', async () => {
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [{ id: 'plan-uuid' }] }) // plan lookup
          .mockResolvedValueOnce({ rows: [] })                     // cancel existing
          .mockResolvedValueOnce({ rows: [{ id: 'sub-uuid' }] }), // insert new
      } as any;
      const svc = makeService(pool);
      const result = await svc.createSubscription('org-1', 'unlimited_professional');
      expect(result.subscriptionId).toBe('sub-uuid');
    });
  });
});
