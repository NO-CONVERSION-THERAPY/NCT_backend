const ABSOLUTE_URL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;

function shouldPreferHttp(value: string): boolean {
  const host = value
    .replace(/^\/\//, '')
    .split(/[/?#]/, 1)[0]
    .toLowerCase();

  return host === 'localhost'
    || host.startsWith('localhost:')
    || host.startsWith('127.')
    || host.startsWith('0.0.0.0')
    || host === '[::1]'
    || host.startsWith('[::1]:');
}

export function normalizeConfiguredBaseUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return null;

  const candidate = ABSOLUTE_URL_PATTERN.test(trimmed)
    ? trimmed
    : trimmed.startsWith('//')
      ? `${shouldPreferHttp(trimmed) ? 'http:' : 'https:'}${trimmed}`
      : `${shouldPreferHttp(trimmed) ? 'http://' : 'https://'}${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }

  const normalized = parsed.toString();
  return parsed.pathname === '/' && !parsed.search && !parsed.hash
    ? normalized.replace(/\/$/u, '')
    : normalized.replace(/\/(?=([?#])?$)/u, '');
}

export function resolveConfiguredBaseUrl(...values: unknown[]): string | null {
  for (const value of values) {
    const normalized = normalizeConfiguredBaseUrl(value);
    if (normalized) return normalized;
  }

  return null;
}
