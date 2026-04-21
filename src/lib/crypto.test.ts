import { webcrypto } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encryptObject, sha256 } from './crypto';
import { stableStringify } from './json';

function createSecretKey(): string {
  return Buffer.from(
    Uint8Array.from({ length: 32 }, (_, index) => index + 1),
  ).toString('base64');
}

function decodeBase64(value: string): Uint8Array {
  return Uint8Array.from(Buffer.from(value, 'base64'));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

async function decryptEnvelope(
  secret: string,
  envelope: {
    iv: string;
    ciphertext: string;
  },
): Promise<string> {
  const key = await webcrypto.subtle.importKey(
    'raw',
    toArrayBuffer(decodeBase64(secret)),
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  );
  const plaintext = await webcrypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: toArrayBuffer(decodeBase64(envelope.iv)),
    },
    key,
    toArrayBuffer(decodeBase64(envelope.ciphertext)),
  );

  return new TextDecoder().decode(plaintext);
}

describe('crypto helpers', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', webcrypto);
    vi.stubGlobal('atob', (value: string) =>
      Buffer.from(value, 'base64').toString('binary'),
    );
    vi.stubGlobal('btoa', (value: string) =>
      Buffer.from(value, 'binary').toString('base64'),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('computes SHA-256 digests', async () => {
    await expect(sha256('abc')).resolves.toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('encrypts JSON payloads into decryptable AES-GCM envelopes', async () => {
    const secret = createSecretKey();
    const payload = {
      name: 'Zhang San',
      city: 'Shanghai',
    };

    const envelope = await encryptObject(payload, secret);

    expect(envelope.algorithm).toBe('AES-GCM');
    expect(envelope.iv).toBeTruthy();
    expect(envelope.ciphertext).toBeTruthy();
    await expect(
      decryptEnvelope(secret, envelope),
    ).resolves.toBe(stableStringify(payload));
  });

  it('rejects invalid encryption key lengths', async () => {
    const invalidSecret = Buffer.from('short-key').toString('base64');

    await expect(
      encryptObject({ ok: true }, invalidSecret),
    ).rejects.toThrow(
      'ENCRYPTION_KEY must be a base64-encoded 32-byte value.',
    );
  });
});
