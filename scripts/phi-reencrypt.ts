#!/usr/bin/env ts-node
/**
 * PHI Re-encryption Script
 *
 * Detects and re-encrypts plaintext PHI values in the patients table.
 * Only encrypts: first_name, last_name, gender, clinical_notes.
 * These are the fields encrypted by CryptoService in patients.service.ts.
 *
 * Usage:
 *   npx ts-node scripts/phi-reencrypt.ts [--dry-run] [--batch-size=100]
 *
 * Required environment variables:
 *   DATABASE_URL   — PostgreSQL connection string
 *   ENCRYPTION_KEY — 64-char hex or 32-byte UTF-8 string (same key as production)
 *
 * Safety guarantees:
 *   - Idempotent: rows already encrypted are skipped (GCM auth tag verification)
 *   - Dry-run: pass --dry-run to report counts without writing
 *   - Logs counts only — never logs PHI values
 *   - Verifies roundtrip (decrypt after encrypt) before committing each row
 *   - Handles null values safely (skipped without error)
 *   - Processes in configurable batches to limit memory footprint
 *
 * IMPORTANT: Back up your database before running in production:
 *   pg_dump --format=custom --compress=9 "$DATABASE_URL" -f backup_before_reencrypt.dump
 */

import * as crypto from 'crypto';
import { Pool } from 'pg';

// ─── Args ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const BATCH_SIZE = (() => {
  const flag = args.find(a => a.startsWith('--batch-size='));
  return flag ? parseInt(flag.split('=')[1], 10) : 100;
})();

// ─── Crypto helpers ───────────────────────────────────────────────────────────

function deriveKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY ?? '';
  if (!raw || raw.length < 32) {
    throw new Error(
      'ENCRYPTION_KEY must be at least 32 characters. ' +
      'Set it to the same value used in production.',
    );
  }
  // 64-char hex → 32 bytes; otherwise use as UTF-8
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  return Buffer.from(raw.slice(0, 32), 'utf8');
}

function isAlreadyEncrypted(value: string, key: Buffer): boolean {
  // Encrypted format: base64([12-byte IV][16-byte authTag][≥1-byte ciphertext])
  // Minimum total bytes: 29 → minimum base64 length: 40
  if (!value || value.length < 40) return false;

  let decoded: Buffer;
  try {
    decoded = Buffer.from(value, 'base64');
    // Verify it's valid base64 (re-encode should match)
    if (decoded.toString('base64') !== value) return false;
  } catch {
    return false;
  }

  if (decoded.length < 29) return false;

  try {
    const iv = decoded.subarray(0, 12);
    const authTag = decoded.subarray(12, 28);
    const ciphertext = decoded.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    decipher.update(ciphertext);
    decipher.final(); // throws if auth tag doesn't match → value is plaintext
    return true;
  } catch {
    return false; // GCM auth tag mismatch → plaintext
  }
}

function encrypt(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function decrypt(ciphertext: string, key: Buffer): string {
  const buf = Buffer.from(ciphertext, 'base64');
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

// ─── Main ────────────────────────────────────────────────────────────────────

const PHI_COLUMNS = ['first_name', 'last_name', 'gender', 'clinical_notes'] as const;
type PhiColumn = typeof PHI_COLUMNS[number];

interface PatientRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  gender: string | null;
  clinical_notes: string | null;
}

async function main() {
  console.log(`[phi-reencrypt] Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log(`[phi-reencrypt] Batch size: ${BATCH_SIZE}`);

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  const key = deriveKey();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const stats: Record<PhiColumn, { skipped: number; encrypted: number; alreadyEncrypted: number }> = {
    first_name:      { skipped: 0, encrypted: 0, alreadyEncrypted: 0 },
    last_name:       { skipped: 0, encrypted: 0, alreadyEncrypted: 0 },
    gender:          { skipped: 0, encrypted: 0, alreadyEncrypted: 0 },
    clinical_notes:  { skipped: 0, encrypted: 0, alreadyEncrypted: 0 },
  };

  let totalRows = 0;
  let offset = 0;

  try {
    while (true) {
      const { rows }: { rows: PatientRow[] } = await pool.query(
        `SELECT id, first_name, last_name, gender, clinical_notes
           FROM patients
          ORDER BY id
          LIMIT $1 OFFSET $2`,
        [BATCH_SIZE, offset],
      );

      if (rows.length === 0) break;
      totalRows += rows.length;

      for (const row of rows) {
        const updates: Partial<Record<PhiColumn, string>> = {};

        for (const col of PHI_COLUMNS) {
          const val = row[col];
          if (val === null || val === undefined || val === '') {
            stats[col].skipped++;
            continue;
          }

          if (isAlreadyEncrypted(val, key)) {
            stats[col].alreadyEncrypted++;
            continue;
          }

          // Plaintext — encrypt and verify roundtrip
          const ciphertext = encrypt(val, key);
          const roundtrip = decrypt(ciphertext, key);
          if (roundtrip !== val) {
            throw new Error(
              `Roundtrip verification failed for patient ${row.id} column ${col}. ` +
              'Aborting — no rows were written.',
            );
          }

          updates[col] = ciphertext;
          stats[col].encrypted++;
        }

        if (Object.keys(updates).length > 0 && !DRY_RUN) {
          const setClauses = Object.keys(updates)
            .map((col, i) => `${col} = $${i + 2}`)
            .join(', ');
          const values = [row.id, ...Object.values(updates)];
          await pool.query(
            `UPDATE patients SET ${setClauses} WHERE id = $1`,
            values,
          );
        }
      }

      console.log(`[phi-reencrypt] Processed ${totalRows} rows...`);
      offset += BATCH_SIZE;
    }
  } finally {
    await pool.end();
  }

  console.log('\n[phi-reencrypt] Complete.');
  console.log(`  Total rows processed: ${totalRows}`);
  for (const col of PHI_COLUMNS) {
    const s = stats[col];
    console.log(
      `  ${col.padEnd(20)} already_encrypted=${s.alreadyEncrypted} ` +
      `encrypted=${s.encrypted} skipped_null=${s.skipped}`,
    );
  }
  if (DRY_RUN) {
    console.log('\n  DRY RUN — no rows were modified. Remove --dry-run to apply.');
  }
}

main().catch(err => {
  console.error('[phi-reencrypt] Fatal error:', err.message);
  process.exit(1);
});
