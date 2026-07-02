import type { Pool, PoolClient } from 'pg';

/**
 * Executes `fn` inside a PostgreSQL transaction with `app.current_org_id`
 * set to `orgId` for the duration of the transaction.
 *
 * This activates the RLS policies defined in migration 036_rls_phi_tables.sql,
 * which use `app_current_org_id()` → `current_setting('app.current_org_id', true)`.
 *
 * The parameter is LOCAL to the transaction (set via `set_config(..., true)`) so
 * it is automatically cleared when the transaction ends and the connection is
 * returned to the pool — no cross-tenant leakage is possible.
 *
 * ARCHITECTURE NOTE: Existing services that call `pool.query()` directly are NOT
 * protected by RLS because they do not acquire a dedicated client and therefore
 * cannot set the session variable before their queries. Those services rely on
 * application-layer `WHERE organization_id = $N` clauses for tenant isolation.
 * New services that query RLS-protected tables (audit_events, patient_notes,
 * patient_consents, fhir_exports, etc.) should use this utility.
 */
export async function withTenantContext<T>(
  pool: Pool,
  orgId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // set_config(name, value, is_local) with is_local=true binds the setting to
    // the current transaction — automatically cleared on COMMIT / ROLLBACK.
    await client.query('SELECT set_config($1, $2, true)', ['app.current_org_id', orgId]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
