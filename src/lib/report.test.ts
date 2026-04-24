import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  bumpServiceReportCountMock,
  clearMotherAuthTokenMock,
  getMotherAuthTokenMock,
  getMotherServicePublicKeyMock,
  getOrCreateLocalServiceEncryptionKeyPairMock,
  getNullableDatabackVersionMock,
  listPendingMotherFormSyncRecordsMock,
  markMotherFormSyncFailureMock,
  markMotherFormSyncSuccessMock,
  writeMotherServicePublicKeyMock,
  writeMotherAuthTokenMock,
  writeMotherServiceEncryptionPublicKeyMock,
} =
  vi.hoisted(() => ({
    bumpServiceReportCountMock: vi.fn(),
    clearMotherAuthTokenMock: vi.fn(),
    getMotherAuthTokenMock: vi.fn(),
    getMotherServicePublicKeyMock: vi.fn(),
    getOrCreateLocalServiceEncryptionKeyPairMock: vi.fn(),
    getNullableDatabackVersionMock: vi.fn(),
    listPendingMotherFormSyncRecordsMock: vi.fn(),
    markMotherFormSyncFailureMock: vi.fn(),
    markMotherFormSyncSuccessMock: vi.fn(),
    writeMotherServicePublicKeyMock: vi.fn(),
    writeMotherAuthTokenMock: vi.fn(),
    writeMotherServiceEncryptionPublicKeyMock: vi.fn(),
  }));

vi.mock('./data', () => ({
  bumpServiceReportCount: bumpServiceReportCountMock,
  clearMotherAuthToken: clearMotherAuthTokenMock,
  getMotherAuthToken: getMotherAuthTokenMock,
  getMotherServicePublicKey: getMotherServicePublicKeyMock,
  getOrCreateLocalServiceEncryptionKeyPair: getOrCreateLocalServiceEncryptionKeyPairMock,
  getNullableDatabackVersion: getNullableDatabackVersionMock,
  listPendingMotherFormSyncRecords: listPendingMotherFormSyncRecordsMock,
  markMotherFormSyncFailure: markMotherFormSyncFailureMock,
  markMotherFormSyncSuccess: markMotherFormSyncSuccessMock,
  writeMotherServicePublicKey: writeMotherServicePublicKeyMock,
  writeMotherAuthToken: writeMotherAuthTokenMock,
  writeMotherServiceEncryptionPublicKey: writeMotherServiceEncryptionPublicKeyMock,
}));

vi.mock('./security', () => ({
  unwrapSignedPayloadEnvelope: vi.fn(async (_env: Env, input: unknown) => input),
}));

vi.mock('./crypto', () => ({
  decryptJsonWithPrivateKey: vi.fn(async () => ({ token: 'bootstrapped-token' })),
}));

import { reportToMother, syncFromMother } from './report';

describe('reportToMother', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    getNullableDatabackVersionMock.mockResolvedValue(7);
    bumpServiceReportCountMock.mockResolvedValue(3);
    getMotherAuthTokenMock.mockResolvedValue('auth-token');
    getMotherServicePublicKeyMock.mockResolvedValue(null);
    getOrCreateLocalServiceEncryptionKeyPairMock.mockResolvedValue({
      privateKey: '-----BEGIN PRIVATE KEY-----\nsub\n-----END PRIVATE KEY-----',
      publicKey: '-----BEGIN PUBLIC KEY-----\nsub\n-----END PUBLIC KEY-----',
    });
    listPendingMotherFormSyncRecordsMock.mockResolvedValue([]);
    markMotherFormSyncFailureMock.mockResolvedValue(undefined);
    markMotherFormSyncSuccessMock.mockResolvedValue(undefined);
    clearMotherAuthTokenMock.mockResolvedValue(undefined);
    writeMotherServicePublicKeyMock.mockResolvedValue(undefined);
    writeMotherAuthTokenMock.mockResolvedValue(undefined);
    writeMotherServiceEncryptionPublicKeyMock.mockResolvedValue(undefined);
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

  it('posts report payloads with bearer-token auth', async () => {
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
      authorization: 'Bearer auth-token',
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
    expect(writeMotherServicePublicKeyMock).not.toHaveBeenCalled();
  });

  it('caches the mother service public key returned by recognized mother reports', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          accepted: true,
          motherServicePublicKey: '-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----',
        }),
        {
          status: 202,
        },
      ),
    );

    const result = await reportToMother({
      DB: {} as D1Database,
      MOTHER_REPORT_URL: 'https://mother.example.com/api/sub/report',
      SERVICE_PUBLIC_URL: 'https://sub.example.com',
    } as Env);

    expect(result).toMatchObject({
      delivered: true,
      motherServicePublicKey: '-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----',
    });
    expect(writeMotherServicePublicKeyMock).toHaveBeenCalledWith(
      expect.anything(),
      '-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----',
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
