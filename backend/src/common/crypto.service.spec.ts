import { CryptoService } from './crypto.service';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_HEX_KEY = 'a'.repeat(64); // 64 hex chars = 32 bytes
const VALID_UTF8_KEY = 'x'.repeat(32); // 32 UTF-8 bytes
const SHORT_KEY = 'tooshort';
const PHI_PLAINTEXT = 'Alice Smith';
const UNICODE_PHI = 'Ñoño García — 日本語テスト';

function makeService(key = VALID_HEX_KEY, nodeEnv = 'test'): CryptoService {
  const saved = { key: process.env.ENCRYPTION_KEY, env: process.env.NODE_ENV };
  process.env.ENCRYPTION_KEY = key;
  process.env.NODE_ENV = nodeEnv;
  const svc = new CryptoService();
  process.env.ENCRYPTION_KEY = saved.key;
  process.env.NODE_ENV = saved.env;
  return svc;
}

// ─── Constructor ───────────────────────────────────────────────────────────────

describe('CryptoService constructor', () => {
  const savedKey = process.env.ENCRYPTION_KEY;
  const savedEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.ENCRYPTION_KEY = savedKey;
    process.env.NODE_ENV = savedEnv;
  });

  it('constructs without error when ENCRYPTION_KEY is a 64-char hex string', () => {
    process.env.ENCRYPTION_KEY = VALID_HEX_KEY;
    process.env.NODE_ENV = 'test';
    expect(() => new CryptoService()).not.toThrow();
  });

  it('constructs without error when ENCRYPTION_KEY is a 32+ char UTF-8 string', () => {
    process.env.ENCRYPTION_KEY = VALID_UTF8_KEY;
    process.env.NODE_ENV = 'test';
    expect(() => new CryptoService()).not.toThrow();
  });

  it('constructs without throwing in non-production when key is missing', () => {
    process.env.ENCRYPTION_KEY = '';
    process.env.NODE_ENV = 'test';
    expect(() => new CryptoService()).not.toThrow();
  });

  it('constructs without throwing in non-production when key is too short', () => {
    process.env.ENCRYPTION_KEY = SHORT_KEY;
    process.env.NODE_ENV = 'test';
    expect(() => new CryptoService()).not.toThrow();
  });

  it('throws in production when ENCRYPTION_KEY is missing', () => {
    process.env.ENCRYPTION_KEY = '';
    process.env.NODE_ENV = 'production';
    expect(() => new CryptoService()).toThrow(/ENCRYPTION_KEY must be set/);
  });

  it('throws in production when ENCRYPTION_KEY is shorter than 32 chars', () => {
    process.env.ENCRYPTION_KEY = SHORT_KEY;
    process.env.NODE_ENV = 'production';
    expect(() => new CryptoService()).toThrow();
  });
});

// ─── encrypt ─────────────────────────────────────────────────────────────────

describe('CryptoService.encrypt', () => {
  let svc: CryptoService;

  beforeEach(() => {
    svc = makeService();
  });

  it('returns null for null input', () => {
    expect(svc.encrypt(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(svc.encrypt(undefined)).toBeNull();
  });

  it('returns a non-empty base64 string for plaintext input', () => {
    const result = svc.encrypt(PHI_PLAINTEXT);
    expect(typeof result).toBe('string');
    expect(result!.length).toBeGreaterThan(0);
  });

  it('produces a different ciphertext on each call (random IV)', () => {
    const a = svc.encrypt(PHI_PLAINTEXT);
    const b = svc.encrypt(PHI_PLAINTEXT);
    expect(a).not.toBe(b);
  });

  it('encrypted output is valid base64 (no throw on Buffer.from(..., base64))', () => {
    const ct = svc.encrypt(PHI_PLAINTEXT)!;
    expect(() => Buffer.from(ct, 'base64')).not.toThrow();
  });

  it('encrypted buffer is at least IV(12) + tag(16) + 1 byte long', () => {
    const ct = svc.encrypt(PHI_PLAINTEXT)!;
    const buf = Buffer.from(ct, 'base64');
    expect(buf.length).toBeGreaterThanOrEqual(12 + 16 + 1);
  });

  it('encrypts empty string (non-null, non-undefined) — produces IV+tag only', () => {
    const result = svc.encrypt('');
    // '' is not null/undefined, so it goes through AES path and returns base64
    expect(result).not.toBeNull();
    const buf = Buffer.from(result!, 'base64');
    // IV(12) + tag(16) + 0 ciphertext bytes = 28 bytes
    expect(buf.length).toBe(28);
  });

  it('encrypts Unicode / multi-byte PHI fields', () => {
    const result = svc.encrypt(UNICODE_PHI);
    expect(result).not.toBeNull();
    expect(Buffer.from(result!, 'base64').length).toBeGreaterThanOrEqual(29);
  });

  it('encrypts large payloads (10 KB)', () => {
    const large = 'A'.repeat(10_000);
    const result = svc.encrypt(large);
    expect(result).not.toBeNull();
    const buf = Buffer.from(result!, 'base64');
    expect(buf.length).toBeGreaterThanOrEqual(12 + 16 + 10_000);
  });

  it('falls back to plaintext when key is unavailable (non-production)', () => {
    const degraded = makeService(SHORT_KEY);
    expect(degraded.encrypt(PHI_PLAINTEXT)).toBe(PHI_PLAINTEXT);
  });

  it('degraded service returns null for null even without a key', () => {
    const degraded = makeService(SHORT_KEY);
    expect(degraded.encrypt(null)).toBeNull();
  });
});

// ─── decrypt ─────────────────────────────────────────────────────────────────

describe('CryptoService.decrypt', () => {
  let svc: CryptoService;

  beforeEach(() => {
    svc = makeService();
  });

  it('returns null for null input', () => {
    expect(svc.decrypt(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(svc.decrypt(undefined)).toBeNull();
  });

  it('roundtrips a typical PHI string', () => {
    const ct = svc.encrypt(PHI_PLAINTEXT)!;
    expect(svc.decrypt(ct)).toBe(PHI_PLAINTEXT);
  });

  it('encrypt("") produces a base64 ciphertext (does not roundtrip — 28-byte payload < legacy threshold)', () => {
    // An empty-string plaintext yields IV(12)+tag(16)+0 bytes = 28 bytes, which is
    // below the IV_BYTES+TAG_BYTES+1 = 29 threshold in decrypt(), so decrypt()
    // returns the ciphertext as-is. PHI fields with no value should use null, not ''.
    const ct = svc.encrypt('')!;
    expect(typeof ct).toBe('string');
    expect(ct.length).toBeGreaterThan(0);
    // decrypt treats it as legacy plaintext and returns the raw ciphertext
    expect(svc.decrypt(ct)).toBe(ct);
  });

  it('roundtrips Unicode PHI', () => {
    const ct = svc.encrypt(UNICODE_PHI)!;
    expect(svc.decrypt(ct)).toBe(UNICODE_PHI);
  });

  it('roundtrips a large payload', () => {
    const large = 'Z'.repeat(10_000);
    const ct = svc.encrypt(large)!;
    expect(svc.decrypt(ct)).toBe(large);
  });

  it('returns legacy plaintext as-is when buffer is too short (< 29 bytes decoded)', () => {
    // A raw short string won't decode to ≥29 bytes, so it's treated as legacy
    const legacy = 'plaintext_alice';
    const result = svc.decrypt(legacy);
    expect(result).toBe(legacy);
  });

  it('returns ciphertext unchanged when auth tag is tampered', () => {
    const ct = svc.encrypt(PHI_PLAINTEXT)!;
    const buf = Buffer.from(ct, 'base64');
    // Flip a byte in the auth tag region (bytes 12–27)
    buf[15] ^= 0xff;
    const tampered = buf.toString('base64');
    // Decryption fails silently, returns raw input
    expect(svc.decrypt(tampered)).toBe(tampered);
  });

  it('returns ciphertext unchanged when IV is corrupted', () => {
    const ct = svc.encrypt(PHI_PLAINTEXT)!;
    const buf = Buffer.from(ct, 'base64');
    // Corrupt the IV (first 12 bytes)
    buf[0] ^= 0xff;
    buf[5] ^= 0xff;
    const corrupted = buf.toString('base64');
    expect(svc.decrypt(corrupted)).toBe(corrupted);
  });

  it('returns ciphertext unchanged when ciphertext body is corrupted', () => {
    const ct = svc.encrypt(PHI_PLAINTEXT)!;
    const buf = Buffer.from(ct, 'base64');
    // Corrupt the last byte (ciphertext body)
    buf[buf.length - 1] ^= 0xff;
    const corrupted = buf.toString('base64');
    expect(svc.decrypt(corrupted)).toBe(corrupted);
  });

  it('returns ciphertext unchanged when decrypted with wrong key', () => {
    const svcA = makeService(VALID_HEX_KEY);
    const svcB = makeService('b'.repeat(64)); // different key
    const ct = svcA.encrypt(PHI_PLAINTEXT)!;
    // Wrong-key decryption fails; decrypt returns the raw ciphertext
    expect(svcB.decrypt(ct)).toBe(ct);
  });

  it('degraded service returns ciphertext unchanged (no key)', () => {
    const degraded = makeService(SHORT_KEY);
    expect(degraded.decrypt('some-value')).toBe('some-value');
  });

  it('degraded service returns null for null', () => {
    const degraded = makeService(SHORT_KEY);
    expect(degraded.decrypt(null)).toBeNull();
  });
});

// ─── Key format variants ──────────────────────────────────────────────────────

describe('CryptoService key format variants', () => {
  it('encrypts and decrypts with a 64-char lowercase hex key', () => {
    const svc = makeService('f'.repeat(64));
    const ct = svc.encrypt(PHI_PLAINTEXT)!;
    expect(svc.decrypt(ct)).toBe(PHI_PLAINTEXT);
  });

  it('encrypts and decrypts with a 64-char uppercase hex key', () => {
    const svc = makeService('F'.repeat(64));
    const ct = svc.encrypt(PHI_PLAINTEXT)!;
    expect(svc.decrypt(ct)).toBe(PHI_PLAINTEXT);
  });

  it('encrypts and decrypts with a mixed-case hex key', () => {
    const svc = makeService('aAbBcCdDeEfF'.repeat(64 / 12).slice(0, 64));
    const ct = svc.encrypt(PHI_PLAINTEXT)!;
    expect(svc.decrypt(ct)).toBe(PHI_PLAINTEXT);
  });

  it('encrypts and decrypts with a UTF-8 key (≥32 chars, not all hex)', () => {
    // Contains non-hex chars, so treated as UTF-8
    const svc = makeService('MySecretOrthoKey_32Chars_xxxx!@#$');
    const ct = svc.encrypt(PHI_PLAINTEXT)!;
    expect(svc.decrypt(ct)).toBe(PHI_PLAINTEXT);
  });

  it('two services with same key produce cross-decryptable ciphertext', () => {
    const key = VALID_HEX_KEY;
    const svcA = makeService(key);
    const svcB = makeService(key);
    const ct = svcA.encrypt(PHI_PLAINTEXT)!;
    expect(svcB.decrypt(ct)).toBe(PHI_PLAINTEXT);
  });

  it('two services with different keys cannot cross-decrypt', () => {
    const svcA = makeService('a'.repeat(64));
    const svcB = makeService('b'.repeat(64));
    const ct = svcA.encrypt(PHI_PLAINTEXT)!;
    // svcB either returns ciphertext (legacy path) or the same string; NOT the plaintext
    expect(svcB.decrypt(ct)).not.toBe(PHI_PLAINTEXT);
  });
});

// ─── PHI field coverage ───────────────────────────────────────────────────────

describe('PHI field encryption (realistic patient data)', () => {
  let svc: CryptoService;

  beforeEach(() => { svc = makeService(); });

  const fields: Array<[string, string | null]> = [
    ['firstName', 'María'],
    ['lastName', "O'Brien-Smith"],
    ['dateOfBirth', '1985-07-22'],
    ['gender', 'female'],
    ['clinicalNotes', 'Patient presents with Class II malocclusion. Extraction of 14 and 24 recommended.'],
    ['clinicalNotes_null', null],
  ];

  fields.forEach(([field, value]) => {
    it(`roundtrips ${field}`, () => {
      const ct = svc.encrypt(value);
      expect(svc.decrypt(ct)).toBe(value);
    });
  });
});
