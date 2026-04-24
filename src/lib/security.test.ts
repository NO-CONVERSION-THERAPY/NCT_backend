import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { stableStringify } from './json';
import {
  assertCachedMotherServiceAuth,
  assertToken,
  unwrapSignedPayloadEnvelope,
  verifyServiceRequestWithPublicKey,
} from './security';

const encoder = new TextEncoder();

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  return view.buffer.slice(
    view.byteOffset,
    view.byteOffset + view.byteLength
  ) as ArrayBuffer;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function toPem(buffer: ArrayBuffer, label: string): string {
  const base64 = bytesToBase64(new Uint8Array(buffer));
  const chunks = base64.match(/.{1,64}/g) ?? [];
  return [
    `-----BEGIN ${label}-----`,
    ...chunks,
    `-----END ${label}-----`,
  ].join('\n');
}

async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    toArrayBuffer(encoder.encode(value))
  );
  return bytesToBase64Url(new Uint8Array(digest));
}

async function generateSigningKeyPair(): Promise<{
  privateCryptoKey: CryptoKey;
  publicKey: string;
}> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256'
    },
    true,
    ['sign', 'verify']
  ) as CryptoKeyPair;
  const publicKey = await crypto.subtle.exportKey('spki', keyPair.publicKey) as ArrayBuffer;

  return {
    privateCryptoKey: keyPair.privateKey,
    publicKey: toPem(publicKey, 'PUBLIC KEY'),
  };
}

async function signServiceRequestForTest(input: {
  body?: string;
  method: string;
  privateKey: CryptoKey;
  url: string;
}) {
  const timestamp = new Date().toISOString();
  const nonce = crypto.randomUUID();
  const bodyHash = await sha256Base64Url(input.body ?? '');
  const url = new URL(input.url);
  const canonical = [
    'NCT-SERVICE-AUTH-V1',
    input.method.toUpperCase(),
    `${url.pathname}${url.search}`,
    timestamp,
    nonce,
    bodyHash,
  ].join('\n');
  const signature = await crypto.subtle.sign(
    {
      name: 'ECDSA',
      hash: 'SHA-256'
    },
    input.privateKey,
    toArrayBuffer(encoder.encode(canonical))
  );

  return {
    'x-nct-auth-alg': 'ECDSA-P256-SHA256',
    'x-nct-key-id': 'mother-main',
    'x-nct-timestamp': timestamp,
    'x-nct-nonce': nonce,
    'x-nct-body-sha256': bodyHash,
    'x-nct-signature': bytesToBase64Url(new Uint8Array(signature)),
  };
}

async function signPayloadEnvelopeForTest<T>(
  keyId: string,
  privateKey: CryptoKey,
  payload: T
) {
  const signedAt = new Date().toISOString();
  const nonce = crypto.randomUUID();
  const payloadHash = await sha256Base64Url(stableStringify(payload));
  const canonical = [
    'NCT-PAYLOAD-SIGNATURE-V1',
    keyId,
    signedAt,
    nonce,
    payloadHash,
  ].join('\n');
  const signature = await crypto.subtle.sign(
    {
      name: 'ECDSA',
      hash: 'SHA-256'
    },
    privateKey,
    toArrayBuffer(encoder.encode(canonical))
  );

  return {
    payload,
    signature: {
      algorithm: 'ECDSA-P256-SHA256',
      kid: keyId,
      signedAt,
      nonce,
      payloadHash,
      value: bytesToBase64Url(new Uint8Array(signature)),
    },
  };
}

function createApp(expectedToken?: string) {
  const app = new Hono();

  app.get('/', (context) => {
    const authError = assertToken(
      context,
      expectedToken,
      'Write',
    );
    if (authError) {
      return authError;
    }

    return context.json({
      ok: true,
    });
  });

  return app;
}

describe('assertToken', () => {
  it('allows requests when a token is not required', async () => {
    const response = await createApp().request('/');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it('accepts bearer tokens from the authorization header', async () => {
    const response = await createApp('secret').request('/', {
      headers: {
        authorization: 'Bearer secret',
      },
    });

    expect(response.status).toBe(200);
  });

  it('accepts x-api-token headers', async () => {
    const response = await createApp('secret').request('/', {
      headers: {
        'x-api-token': 'secret',
      },
    });

    expect(response.status).toBe(200);
  });

  it('rejects invalid tokens with a 401 response', async () => {
    const response = await createApp('secret').request('/', {
      headers: {
        authorization: 'Bearer wrong',
      },
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'Write token is invalid.',
    });
  });
});

describe('verifyServiceRequestWithPublicKey', () => {
  it('accepts signed mother service requests verified by the cached public key', async () => {
    const { privateCryptoKey, publicKey } = await generateSigningKeyPair();
    const body = JSON.stringify({ hello: 'sub' });
    const headers = await signServiceRequestForTest({
      body,
      method: 'POST',
      privateKey: privateCryptoKey,
      url: 'https://sub.example.com/api/export/nct_databack?afterVersion=1',
    });
    const request = new Request(
      'https://sub.example.com/api/export/nct_databack?afterVersion=1',
      {
        method: 'POST',
        headers,
        body,
      }
    );

    await expect(
      verifyServiceRequestWithPublicKey(request, {}, publicKey)
    ).resolves.toEqual({ ok: true });
  });
});

describe('assertCachedMotherServiceAuth', () => {
  it('rejects requests before the mother service public key is cached', async () => {
    const app = new Hono();

    app.get('/', async (context) => {
      const authError = await assertCachedMotherServiceAuth(context, {}, null);
      return authError ?? context.json({ ok: true });
    });

    const response = await app.request('/');
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'Mother service public key is not cached. Run a mother report first.'
    });
  });
});

describe('unwrapSignedPayloadEnvelope', () => {
  it('verifies and unwraps signed mother payload envelopes with the cached public key', async () => {
    const { privateCryptoKey, publicKey } = await generateSigningKeyPair();
    const payload = {
      currentVersion: 2,
      records: [],
    };
    const envelope = await signPayloadEnvelopeForTest(
      'mother-main',
      privateCryptoKey,
      payload
    );

    await expect(
      unwrapSignedPayloadEnvelope(
        {},
        envelope,
        {
          publicKey,
          requireSignature: true,
        }
      )
    ).resolves.toEqual(payload);
  });

  it('rejects unsigned payloads when signature is required', async () => {
    await expect(
      unwrapSignedPayloadEnvelope(
        {},
        {
          currentVersion: 2,
          records: [],
        },
        {
          publicKey: '-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----',
          requireSignature: true,
        }
      )
    ).rejects.toThrow('Signed payload envelope is required.');
  });
});
