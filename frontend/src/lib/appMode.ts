/**
 * Production/demo mode guard.
 *
 * Default is PRODUCTION MODE — no fake patients, no mock data.
 * Demo mode only activates when NEXT_PUBLIC_ENABLE_DEMO_DATA=true at build time.
 * The env var is inlined at build time (NEXT_PUBLIC_ prefix), so the condition
 * tree-shakes cleanly in production bundles.
 */

export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_DEMO_DATA === 'true';
}

export function isProductionMode(): boolean {
  return !isDemoMode();
}
