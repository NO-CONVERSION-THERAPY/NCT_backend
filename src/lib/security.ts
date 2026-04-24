import type { Context } from 'hono';
import { stableStringify } from './json';

const encoder = new TextEncoder();
const SERVICE_SIGNATURE_ALGORITHM = 'ECDSA-P256-SHA256';
const DEFAULT_MAX_SKEW_MS = 5 * 60 * 1000;

type ServiceAuthEnv = {
  SERVICE_AUTH_MAX_SKEW_MS?: string;
};

type SignedPayloadEnvelope<T> = {
  payload: T;
  signature: {
    algorithm: typeof SERVICE_SIGNATURE_ALGORITHM;
    kid: string;
    signedAt: string;
    nonce: string;
    payloadHash: string;
    value: string;
  };
};

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  return view.buffer.slice(
    view.byteOffset,
    view.byteOffset + view.byteLength
  ) as ArrayBuffer;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64ToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const paddingLength = (4 - (normalized.length % 4)) % 4;
  const binary = atob(`${normalized}${'='.repeat(paddingLength)}`);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function readPemBody(value: string): string {
  return String(value || '')
    .trim()
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
}

function readToken(request: Request): string | null {
  const authorization = request.headers.get('authorization');
  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length).trim();
  }

  return request.headers.get('x-api-token');
}

function getServiceAuthMaxSkewMs(env: ServiceAuthEnv): number {
  return Math.max(
    1000,
    Number(env.SERVICE_AUTH_MAX_SKEW_MS ?? String(DEFAULT_MAX_SKEW_MS))
  );
}

async function sha256Base64Url(input: string | ArrayBuffer): Promise<string> {
  const bytes = typeof input === 'string'
    ? encoder.encode(input)
    : new Uint8Array(input);
  const digest = await crypto.subtle.digest('SHA-256', toArrayBuffer(bytes));
  return bytesToBase64Url(new Uint8Array(digest));
}

async function importSigningPublicKey(value: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'spki',
    toArrayBuffer(base64ToBytes(readPemBody(value))),
    {
      name: 'ECDSA',
      namedCurve: 'P-256'
    },
    false,
    ['verify']
  );
}

function buildRequestCanonicalString(input: {
  bodyHash: string;
  method: string;
  nonce: string;
  pathWithSearch: string;
  timestamp: string;
}): string {
  return [
    'NCT-SERVICE-AUTH-V1',
    input.method.toUpperCase(),
    input.pathWithSearch,
    input.timestamp,
    input.nonce,
    input.bodyHash,
  ].join('\n');
}

function buildPayloadCanonicalString(input: {
  keyId: string;
  nonce: string;
  payloadHash: string;
  signedAt: string;
}): string {
  return [
    'NCT-PAYLOAD-SIGNATURE-V1',
    input.keyId,
    input.signedAt,
    input.nonce,
    input.payloadHash,
  ].join('\n');
}

function getHeader(request: Request, name: string): string {
  return request.headers.get(name)?.trim() || '';
}

function createUnauthorizedResponse(context: Context, message: string): Response {
  return context.json(
    {
      error: message
    },
    401
  );
}

function isSignedPayloadEnvelope(input: unknown): input is SignedPayloadEnvelope<unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return false;
  }

  const candidate = input as Record<string, unknown>;
  const signature = candidate.signature as Record<string, unknown> | undefined;
  return (
    Object.prototype.hasOwnProperty.call(candidate, 'payload')
    && !!signature
    && typeof signature === 'object'
    && signature.algorithm === SERVICE_SIGNATURE_ALGORITHM
    && typeof signature.kid === 'string'
    && typeof signature.signedAt === 'string'
    && typeof signature.nonce === 'string'
    && typeof signature.payloadHash === 'string'
    && typeof signature.value === 'string'
  );
}

export async function verifyServiceRequestWithPublicKey(
  request: Request,
  env: ServiceAuthEnv,
  publicKey: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const algorithm = getHeader(request, 'x-nct-auth-alg');
  const timestamp = getHeader(request, 'x-nct-timestamp');
  const nonce = getHeader(request, 'x-nct-nonce');
  const bodyHash = getHeader(request, 'x-nct-body-sha256');
  const signature = getHeader(request, 'x-nct-signature');
  if (!algorithm || !timestamp || !nonce || !bodyHash || !signature) {
    return {
      ok: false,
      reason: 'service signature headers are incomplete'
    };
  }

  if (algorithm !== SERVICE_SIGNATURE_ALGORITHM) {
    return {
      ok: false,
      reason: 'service signature algorithm is not supported'
    };
  }

  const signedAtMs = Date.parse(timestamp);
  if (!Number.isFinite(signedAtMs)) {
    return {
      ok: false,
      reason: 'service signature timestamp is invalid'
    };
  }

  if (Math.abs(Date.now() - signedAtMs) > getServiceAuthMaxSkewMs(env)) {
    return {
      ok: false,
      reason: 'service signature timestamp is outside the allowed window'
    };
  }

  const actualBodyHash = await sha256Base64Url(await request.clone().arrayBuffer());
  if (actualBodyHash !== bodyHash) {
    return {
      ok: false,
      reason: 'service signature body hash does not match'
    };
  }

  const url = new URL(request.url);
  const canonical = buildRequestCanonicalString({
    bodyHash,
    method: request.method,
    nonce,
    pathWithSearch: `${url.pathname}${url.search}`,
    timestamp
  });
  const key = await importSigningPublicKey(publicKey);
  const verified = await crypto.subtle.verify(
    {
      name: 'ECDSA',
      hash: 'SHA-256'
    },
    key,
    toArrayBuffer(base64ToBytes(signature)),
    toArrayBuffer(encoder.encode(canonical))
  );

  return verified
    ? { ok: true }
    : {
        ok: false,
        reason: 'service signature is invalid'
      };
}

async function verifySignedPayloadEnvelope(
  env: ServiceAuthEnv,
  envelope: SignedPayloadEnvelope<unknown>,
  publicKey: string
): Promise<unknown> {
  const signedAtMs = Date.parse(envelope.signature.signedAt);
  if (
    !Number.isFinite(signedAtMs)
    || Math.abs(Date.now() - signedAtMs) > getServiceAuthMaxSkewMs(env)
  ) {
    throw new Error('Signed payload timestamp is outside the allowed window.');
  }

  const payloadHash = await sha256Base64Url(stableStringify(envelope.payload));
  if (payloadHash !== envelope.signature.payloadHash) {
    throw new Error('Signed payload hash does not match.');
  }

  const canonical = buildPayloadCanonicalString({
    keyId: envelope.signature.kid,
    nonce: envelope.signature.nonce,
    payloadHash,
    signedAt: envelope.signature.signedAt,
  });
  const key = await importSigningPublicKey(publicKey);
  const verified = await crypto.subtle.verify(
    {
      name: 'ECDSA',
      hash: 'SHA-256'
    },
    key,
    toArrayBuffer(base64ToBytes(envelope.signature.value)),
    toArrayBuffer(encoder.encode(canonical))
  );

  if (!verified) {
    throw new Error('Signed payload signature is invalid.');
  }

  return envelope.payload;
}

export async function unwrapSignedPayloadEnvelope(
  env: ServiceAuthEnv,
  input: unknown,
  options: {
    publicKey?: string | null;
    requireSignature?: boolean;
  } = {}
): Promise<unknown> {
  if (isSignedPayloadEnvelope(input)) {
    if (!options.publicKey) {
      return input.payload;
    }

    return verifySignedPayloadEnvelope(env, input, options.publicKey);
  }

  if (options.requireSignature) {
    throw new Error('Signed payload envelope is required.');
  }

  return input;
}

export function assertToken(
  context: Context,
  expectedToken: string | undefined,
  label: string
): Response | null {
  if (!expectedToken) {
    return null;
  }

  const providedToken = readToken(context.req.raw);
  if (providedToken === expectedToken) {
    return null;
  }

  return createUnauthorizedResponse(context, `${label} token is invalid.`);
}

export async function assertCachedMotherServiceAuth(
  context: Context,
  env: ServiceAuthEnv,
  publicKey: string | null
): Promise<Response | null> {
  if (!publicKey) {
    return createUnauthorizedResponse(
      context,
      'Mother service public key is not cached. Run a mother report first.'
    );
  }

  const verification = await verifyServiceRequestWithPublicKey(
    context.req.raw,
    env,
    publicKey
  );
  return verification.ok
    ? null
    : createUnauthorizedResponse(
        context,
        `Mother recovery service signature is invalid: ${verification.reason}.`
      );
}
