const encoder = new TextEncoder();

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  return view.buffer.slice(
    view.byteOffset,
    view.byteOffset + view.byteLength
  ) as ArrayBuffer;
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
