import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { assertToken } from './security';

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
