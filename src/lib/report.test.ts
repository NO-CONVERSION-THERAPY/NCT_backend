import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  bumpServiceReportCountMock,
  getSchoolMediaStatsMock,
  getNullableDatabackVersionMock,
  hmacSha256Mock,
  listPendingMotherFormSyncRecordsMock,
  markMotherFormSyncFailureMock,
  markMotherFormSyncSuccessMock,
  sha256Mock,
} =
  vi.hoisted(() => ({
    bumpServiceReportCountMock: vi.fn(),
    getSchoolMediaStatsMock: vi.fn(),
    getNullableDatabackVersionMock: vi.fn(),
    hmacSha256Mock: vi.fn(),
    listPendingMotherFormSyncRecordsMock: vi.fn(),
    markMotherFormSyncFailureMock: vi.fn(),
    markMotherFormSyncSuccessMock: vi.fn(),
    sha256Mock: vi.fn(),
  }));

vi.mock('./data', () => ({
  bumpServiceReportCount: bumpServiceReportCountMock,
  getNullableDatabackVersion: getNullableDatabackVersionMock,
  listPendingMotherFormSyncRecords: listPendingMotherFormSyncRecordsMock,
  markMotherFormSyncFailure: markMotherFormSyncFailureMock,
  markMotherFormSyncSuccess: markMotherFormSyncSuccessMock,
}));

vi.mock('./media', () => ({
  getSchoolMediaStats: getSchoolMediaStatsMock,
  listPendingMotherMediaSyncRecords: vi.fn().mockResolvedValue([]),
  markMotherMediaSyncFailure: vi.fn(),
  markMotherMediaSyncSuccess: vi.fn(),
}));

vi.mock('./crypto', () => ({
  hmacSha256: hmacSha256Mock,
  sha256: sha256Mock,
}));

import {
  flushPendingMotherFormRecords,
  reportToMother,
  syncFromMother,
} from './report';

describe('reportToMother', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    getNullableDatabackVersionMock.mockResolvedValue(7);
    getSchoolMediaStatsMock.mockResolvedValue({
      approved: 0,
      pendingReview: 0,
      rejected: 0,
      r18: 0,
      schools: 0,
      total: 0,
    });
    bumpServiceReportCountMock.mockResolvedValue(3);
    listPendingMotherFormSyncRecordsMock.mockResolvedValue([]);
    markMotherFormSyncFailureMock.mockResolvedValue(undefined);
    markMotherFormSyncSuccessMock.mockResolvedValue(undefined);
    hmacSha256Mock.mockResolvedValue('rotating-auth-token');
    sha256Mock.mockImplementation(async (value: string) => `sha256:${value}`);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.clearAllMocks();
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

  it('posts report payloads with service-url HMAC bearer auth', async () => {
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
      authorization: 'Bearer rotating-auth-token',
      'content-type': 'application/json',
    });

    const payload = JSON.parse(String(init.body)) as {
      service: string;
      serviceWatermark: string;
      serviceUrl: string;
      databackVersion: number | null;
      reportCount: number;
      reportedAt: string;
    };

    expect(payload).toMatchObject({
      service: 'Sub App',
      serviceWatermark: 'nct-api-sql-sub:v1',
      serviceUrl: 'https://sub.example.com',
      databackVersion: 7,
      reportCount: 3,
    });
    expect(payload.reportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('derives the report token directly from the service URL without bootstrap', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-26T00:00:10.000Z'));
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));

    const result = await reportToMother({
      DB: {} as D1Database,
      APP_NAME: 'Sub App',
      MOTHER_REPORT_URL: 'https://mother.example.com/api/sub/report',
      SERVICE_PUBLIC_URL: 'https://sub.example.com',
    } as Env);

    expect(result.delivered).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://mother.example.com/api/sub/report',
    );
    expect(hmacSha256Mock).toHaveBeenCalledWith(
      [
        'NCT-MOTHER-AUTH-HMAC-SHA256-T30-V1',
        'https://sub.example.com',
        String(Math.floor(new Date('2026-04-26T00:00:10.000Z').getTime() / 30000)),
      ].join('\n'),
      'https://sub.example.com',
    );
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

describe('flushPendingMotherFormRecords', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    markMotherFormSyncFailureMock.mockResolvedValue(undefined);
    markMotherFormSyncSuccessMock.mockResolvedValue(undefined);
    hmacSha256Mock.mockResolvedValue('rotating-auth-token');
    sha256Mock.mockImplementation(async (value: string) => `sha256:${value}`);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('posts full form payloads so future questionnaire fields reach the mother service', async () => {
    listPendingMotherFormSyncRecordsMock.mockResolvedValue([
      {
        databackFingerprint: 'fp-1',
        databackVersion: 12,
        payload: {
          name: '测试机构',
          schoolName: '测试机构',
          submittedFields: {
            future_question: '未来新增答案',
            future_multi: ['第一项', '第二项'],
          },
        },
        recordKey: 'form:future-field',
        updatedAt: '2026-04-24T12:00:00.000Z',
      },
    ]);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          accepted: true,
          results: [
            {
              databackFingerprint: 'fp-1',
              motherVersion: 25,
              recordKey: 'form:future-field',
              updated: true,
            },
          ],
        }),
        { status: 202 },
      ),
    );

    const result = await flushPendingMotherFormRecords({
      DB: {} as D1Database,
      MOTHER_REPORT_URL: 'https://mother.example.com/api/sub/report',
      SERVICE_PUBLIC_URL: 'https://sub.example.com',
    } as Env);

    expect(result).toMatchObject({
      deliveredCount: 1,
      pendingCount: 0,
      responseCode: 202,
      skipped: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://mother.example.com/api/sub/form-records');
    expect(init.headers).toEqual({
      authorization: 'Bearer rotating-auth-token',
      'content-type': 'application/json',
    });

    const body = JSON.parse(String(init.body)) as {
      records: Array<{
        payload: {
          submittedFields?: Record<string, unknown>;
        };
      }>;
      serviceUrl: string;
    };

    expect(body.serviceUrl).toBe('https://sub.example.com');
    expect(body.records[0]?.payload.submittedFields).toEqual({
      future_question: '未来新增答案',
      future_multi: ['第一项', '第二项'],
    });
    expect(markMotherFormSyncSuccessMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        databackFingerprint: 'fp-1',
        motherVersion: 25,
        recordKey: 'form:future-field',
        updated: true,
      },
    );
    expect(markMotherFormSyncFailureMock).not.toHaveBeenCalled();
  });
});

describe('syncFromMother', () => {
  it('is deprecated because the mother service now pushes secure records', async () => {
    const result = await syncFromMother({
      DB: {} as D1Database,
      MOTHER_REPORT_URL: 'https://mother.example.com/api/sub/report',
    } as Env);

    expect(result).toEqual({
      reason: 'Deprecated. Mother now pushes secure records to registered sub services.',
      skipped: true,
      synced: false,
    });
  });
});
