import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;    // 96-bit IV recommended for GCM
const TAG_BYTES = 16;   // 128-bit auth tag
const ENCODING = 'base64' as const;

/**
 * AES-256-GCM field-level encryption for PHI (Protected Health Information).
 *
 * Encrypted format (base64): <12-byte IV> + <16-byte auth tag> + <ciphertext>
 * All three components are concatenated before base64 encoding so a single
 * string can be stored in a VARCHAR/TEXT column with no schema changes.
 *
 * Key requirements: ENCRYPTION_KEY env var must be exactly 32 bytes of hex
 * (64 hex characters) or exactly 32 UTF-8 bytes. See assertRequiredEnv.
 */
@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly key: Buffer;
  private readonly available: boolean;

  constructor() {
    const raw = process.env.ENCRYPTION_KEY ?? '';
    if (!raw || raw.length < 32) {
      this.available = false;
      this.key = Buffer.alloc(32);
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          'ENCRYPTION_KEY must be set to a 32+ character key in production. PHI encryption is required.',
        );
      }
      this.logger.error(
        'ENCRYPTION_KEY not set or too short — PHI fields will NOT be encrypted. ' +
        'This is a HIPAA violation in any environment with real patient data. ' +
        'Set ENCRYPTION_KEY to at least 32 characters.',
      );
    } else {
      this.available = true;
      // Accept either a 64-char hex string (32 bytes) or raw UTF-8 (first 32 bytes used)
      if (/^[0-9a-fA-F]{64}$/.test(raw)) {
        this.key = Buffer.from(raw, 'hex');
      } else {
        this.key = Buffer.from(raw.slice(0, 32), 'utf8').subarray(0, 32);
        if (this.key.length < 32) {
          this.key = Buffer.concat([this.key], 32);
        }
      }
    }
  }

  /**
   * Encrypts a plaintext string.
   * Returns null when input is null/undefined or encryption is unavailable.
   */
  encrypt(plaintext: string | null | undefined): string | null {
    if (plaintext === null || plaintext === undefined) return null;
    if (!this.available) {
      this.logger.warn('Encryption unavailable — storing PHI in plaintext (HIPAA non-compliant)');
      return plaintext;
    }

    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    // Pack: [IV (12)] + [tag (16)] + [ciphertext]
    return Buffer.concat([iv, tag, encrypted]).toString(ENCODING);
  }

  /**
   * Decrypts a value encrypted by `encrypt()`.
   * Returns null when input is null/undefined.
   * Returns the input unchanged when it is not in the expected encrypted format
   * (handles legacy plaintext rows that predate encryption).
   */
  decrypt(ciphertext: string | null | undefined): string | null {
    if (ciphertext === null || ciphertext === undefined) return null;
    if (!this.available) return ciphertext;

    try {
      const buf = Buffer.from(ciphertext, ENCODING);
      // Minimum: 12 (IV) + 16 (tag) + 1 (at least 1 byte of content)
      if (buf.length < IV_BYTES + TAG_BYTES + 1) {
        // Likely a legacy plaintext value — return as-is
        return ciphertext;
      }
      const iv  = buf.subarray(0, IV_BYTES);
      const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
      const enc = buf.subarray(IV_BYTES + TAG_BYTES);

      const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
      decipher.setAuthTag(tag);
      return decipher.update(enc) + decipher.final('utf8');
    } catch {
      // Decryption failed — value was likely stored as plaintext before encryption was enabled
      this.logger.warn('PHI decryption failed — returning raw value (may be pre-encryption plaintext)');
      return ciphertext;
    }
  }
}
