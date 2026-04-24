import type {
  LocalServiceEncryptionKeyPair,
  RsaOaepEncryptedEnvelope,
} from '../types';
import { stableStringify } from './json';

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

function bytesToPem(bytes: Uint8Array, label: string): string {
  const base64 = bytesToBase64(bytes);
  const chunks = base64.match(/.{1,64}/g) ?? [];

  return [
    `-----BEGIN ${label}-----`,
    ...chunks,
    `-----END ${label}-----`,
  ].join('\n');
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    toArrayBuffer(encoder.encode(value))
  );

  return Array.from(new Uint8Array(digest))
    .map((chunk) => chunk.toString(16).padStart(2, '0'))
    .join('');
}

export async function hmacSha256(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(encoder.encode(secret)),
    {
      name: 'HMAC',
      hash: 'SHA-256'
    },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    toArrayBuffer(encoder.encode(value))
  );

  return Array.from(new Uint8Array(signature))
    .map((chunk) => chunk.toString(16).padStart(2, '0'))
    .join('');
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
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

async function importRsaEncryptionPublicKey(
  publicKey: string
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'spki',
    toArrayBuffer(base64ToBytes(readPemBody(publicKey))),
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256'
    },
    false,
    ['encrypt']
  );
}

async function importRsaEncryptionPrivateKey(
  privateKey: string
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'pkcs8',
    toArrayBuffer(base64ToBytes(readPemBody(privateKey))),
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256'
    },
    false,
    ['decrypt']
  );
}

export async function generateServiceEncryptionKeyPair(): Promise<LocalServiceEncryptionKeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
    },
    true,
    ['encrypt', 'decrypt']
  ) as CryptoKeyPair;
  const [privateKey, publicKey] = await Promise.all([
    crypto.subtle.exportKey('pkcs8', keyPair.privateKey) as Promise<ArrayBuffer>,
    crypto.subtle.exportKey('spki', keyPair.publicKey) as Promise<ArrayBuffer>,
  ]);

  return {
    privateKey: bytesToPem(new Uint8Array(privateKey), 'PRIVATE KEY'),
    publicKey: bytesToPem(new Uint8Array(publicKey), 'PUBLIC KEY'),
  };
}

export async function encryptJsonWithPublicKey(
  value: unknown,
  publicKey: string
): Promise<RsaOaepEncryptedEnvelope> {
  const aesKey = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const contentKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(aesKey),
    {
      name: 'AES-GCM'
    },
    false,
    ['encrypt']
  );
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: toArrayBuffer(iv)
    },
    contentKey,
    toArrayBuffer(encoder.encode(stableStringify(value)))
  );
  const recipientKey = await importRsaEncryptionPublicKey(publicKey);
  const encryptedKey = await crypto.subtle.encrypt(
    {
      name: 'RSA-OAEP'
    },
    recipientKey,
    toArrayBuffer(aesKey)
  );

  return {
    algorithm: 'RSA-OAEP-SHA-256+A256GCM',
    encryptedKey: bytesToBase64(new Uint8Array(encryptedKey)),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptJsonWithPrivateKey<T = unknown>(
  envelope: RsaOaepEncryptedEnvelope,
  privateKey: string
): Promise<T> {
  const recipientKey = await importRsaEncryptionPrivateKey(privateKey);
  const decryptedKey = await crypto.subtle.decrypt(
    {
      name: 'RSA-OAEP'
    },
    recipientKey,
    toArrayBuffer(base64ToBytes(envelope.encryptedKey))
  );
  const contentKey = await crypto.subtle.importKey(
    'raw',
    decryptedKey,
    {
      name: 'AES-GCM'
    },
    false,
    ['decrypt']
  );
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: toArrayBuffer(base64ToBytes(envelope.iv))
    },
    contentKey,
    toArrayBuffer(base64ToBytes(envelope.ciphertext))
  );

  return JSON.parse(new TextDecoder().decode(new Uint8Array(plaintext))) as T;
}
