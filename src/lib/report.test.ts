import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { bumpServiceReportCountMock, getNullableDatabackVersionMock } =
  vi.hoisted(() => ({
    bumpServiceReportCountMock: vi.fn(),
    getNullableDatabackVersionMock: vi.fn(),
  }));

vi.mock('./data', () => ({
  bumpServiceReportCount: bumpServiceReportCountMock,
  getNullableDatabackVersion: getNullableDatabackVersionMock,
}));

import { reportToMother } from './report';

describe('reportToMother', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    getNullableDatabackVersionMock.mockResolvedValue(7);
    bumpServiceReportCountMock.mockResolvedValue(3);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('skips reporting when the mother report URL is not configured', async () => {
    const result = await reportToMother({
      DB: {} as D1Database,
    } as Env);

    expect(result).toEqual({
      delivered: false,
      skipped: true,
      reason: 'MOTHER_REPORT_URL is not configured.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getNullableDatabackVersionMock).not.toHaveBeenCalled();
    expect(bumpServiceReportCountMock).not.toHaveBeenCalled();
  });

  it('skips reporting when no public service URL can be resolved', async () => {
    const result = await reportToMother({
      DB: {} as D1Database,
      MOTHER_REPORT_URL: 'https://mother.example.com/api/sub/report',
    } as Env);

    expect(result).toEqual({
      delivered: false,
      skipped: true,
      reason:
        'SERVICE_PUBLIC_URL is not configured and no request origin is available.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getNullableDatabackVersionMock).not.toHaveBeenCalled();
    expect(bumpServiceReportCountMock).not.toHaveBeenCalled();
  });

  it('posts report payloads with auth headers when configured', async () => {
    fetchMock.mockResolvedValue(
      new Response(null, {
        status: 202,
      }),
    );

    const result = await reportToMother(
      {
        DB: {} as D1Database,
        APP_NAME: 'Sub App',
        MOTHER_REPORT_URL: 'https://mother.example.com/api/sub/report',
        MOTHER_REPORT_TOKEN: 'report-token',
        MOTHER_REPORT_TIMEOUT_MS: '2500',
      } as Env,
      {
        fallbackOrigin: 'https://sub.example.com',
      },
    );

    expect(result.delivered).toBe(true);
    expect(result.skipped).toBe(false);
    expect(result.responseCode).toBe(202);
    expect(result.payload).toMatchObject({
      service: 'Sub App',
      serviceUrl: 'https://sub.example.com',
      databackVersion: 7,
      reportCount: 3,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://mother.example.com/api/sub/report');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      'content-type': 'application/json',
      authorization: 'Bearer report-token',
    });

    const payload = JSON.parse(String(init.body)) as {
      service: string;
      serviceUrl: string;
      databackVersion: number | null;
      reportCount: number;
      reportedAt: string;
    };

    expect(payload).toMatchObject({
      service: 'Sub App',
      serviceUrl: 'https://sub.example.com',
      databackVersion: 7,
      reportCount: 3,
    });
    expect(payload.reportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('returns response text when the mother service rejects the report', async () => {
    fetchMock.mockResolvedValue(
      new Response('temporarily unavailable', {
        status: 503,
      }),
    );

    const result = await reportToMother({
      DB: {} as D1Database,
      APP_NAME: 'Sub App',
      SERVICE_PUBLIC_URL: 'https://sub.example.com',
      MOTHER_REPORT_URL: 'https://mother.example.com/api/sub/report',
    } as Env);

    expect(result).toMatchObject({
      delivered: false,
      skipped: false,
      responseCode: 503,
      reason: 'temporarily unavailable',
    });
  });

  it('returns the thrown error message on network failures', async () => {
    fetchMock.mockRejectedValue(new Error('socket hang up'));

    const result = await reportToMother({
      DB: {} as D1Database,
      SERVICE_PUBLIC_URL: 'https://sub.example.com',
      MOTHER_REPORT_URL: 'https://mother.example.com/api/sub/report',
    } as Env);

    expect(result).toMatchObject({
      delivered: false,
      skipped: false,
      responseCode: null,
      reason: 'socket hang up',
    });
  });
});
