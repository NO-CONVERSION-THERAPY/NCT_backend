import { webcrypto } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hmacSha256, sha256 } from './crypto';

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

  it('computes HMAC-SHA256 digests', async () => {
    await expect(hmacSha256('payload', 'secret')).resolves.toBe(
      'b82fcb791acec57859b989b430a826488ce2e479fdf92326bd0a2e8375a42ba4',
    );
  });
});
