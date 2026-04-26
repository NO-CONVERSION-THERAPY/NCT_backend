import { describe, expect, it, vi } from 'vitest';

const { sha256Mock } = vi.hoisted(() => ({
  sha256Mock: vi.fn(),
}));

vi.mock('./crypto', () => ({
  sha256: sha256Mock,
}));

import {
  exportDatabackFile,
  getMotherFormSyncRetryDelayMs,
  listPendingMotherFormSyncRecords,
} from './data';
import type { SecureTransferPayload } from '../types';

type DynamicRow = {
  record_key: string;
  payload_json: string;
  version: number;
  fingerprint?: string;
  updated_at: string;
};

function createExportDb(
  rows: DynamicRow[],
  currentVersion: number | null,
) {
  const bindCalls: Array<{
    sql: string;
    params: unknown[];
  }> = [];

  const db = {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          bindCalls.push({
            sql,
            params,
          });

          return {
            all: async () => {
              if (sql.includes('FROM nct_databack') && sql.includes('LIMIT ?')) {
                return {
                  results: rows,
                };
              }

              throw new Error(`Unexpected bound all SQL: ${sql}`);
            },
            first: async () => {
              if (sql.includes('FROM nct_form')) {
                return {
                  payload_json: JSON.stringify({
                    publicKey: '-----BEGIN PUBLIC KEY-----\nmock\n-----END PUBLIC KEY-----',
                    token: 'mother-token',
                  }),
                };
              }

              throw new Error(`Unexpected bound first SQL: ${sql}`);
            },
          };
        },
        first: async () => {
          if (sql.includes('SELECT MAX(version) AS version')) {
            return {
              version: currentVersion,
            };
          }

          throw new Error(`Unexpected first SQL: ${sql}`);
        },
      };
    },
  } as unknown as D1Database;

  return {
    db,
    bindCalls,
  };
}

type PendingSyncRow = {
  record_key: string;
  updated_at: string;
  databack_payload_json: string;
  databack_version: number | null;
  databack_fingerprint: string | null;
  mother_sync_status?: string | null;
  mother_sync_attempts?: number | null;
  mother_sync_last_attempt_at?: string | null;
};

function createPendingSyncDb(rows: PendingSyncRow[]) {
  const bindCalls: Array<{
    sql: string;
    params: unknown[];
  }> = [];

  const db = {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          bindCalls.push({
            sql,
            params,
          });

          return {
            all: async () => {
              if (sql.includes('FROM nct_form AS form') && sql.includes('mother_sync_last_attempt_at')) {
                const [
                  fastRetryLimit,
                  fastRetryBefore,
                  slowRetryLimit,
                  slowRetryBefore,
                  limit,
                ] = params as [number, string, number, string, number];

                const eligibleRows = rows
                  .filter((row) => {
                    const status = row.mother_sync_status ?? 'pending';
                    const attempts = Number(row.mother_sync_attempts ?? 0);
                    const lastAttemptAt = row.mother_sync_last_attempt_at ?? null;

                    if (status === 'synced') {
                      return false;
                    }

                    if (status === 'pending' || !lastAttemptAt) {
                      return true;
                    }

                    if (attempts <= fastRetryLimit) {
                      return lastAttemptAt <= fastRetryBefore;
                    }

                    return attempts > slowRetryLimit && lastAttemptAt <= slowRetryBefore;
                  })
                  .sort((left, right) => left.updated_at.localeCompare(right.updated_at))
                  .slice(0, limit);

                return {
                  results: eligibleRows,
                };
              }

              throw new Error(`Unexpected bound all SQL: ${sql}`);
            },
          };
        },
      };
    },
  } as unknown as D1Database;

  return {
    db,
    bindCalls,
  };
}

describe('exportDatabackFile', () => {
  it('passes through plain databack rows as plain JSON payloads', async () => {
    sha256Mock.mockResolvedValue('generated-fingerprint');

    const updatedAt = '2026-04-21T00:00:00.000Z';
    const { db, bindCalls } = createExportDb(
      [
        {
          record_key: 'patient-1',
          payload_json: JSON.stringify({
            email: 'demo@example.com',
            name: 'Zhang San',
            city: 'Shanghai',
          }),
          version: 4,
          updated_at: updatedAt,
        },
      ],
      4,
    );

    const result = await exportDatabackFile(
      db,
      {
        APP_NAME: 'NCT API SQL Sub',
        SERVICE_PUBLIC_URL: 'https://sub.example.com',
      } as Env,
      {
        afterVersion: -5,
        limit: 999,
      },
    );

    expect(bindCalls).toContainEqual({
      sql: expect.stringContaining('FROM nct_databack'),
      params: [0, 500],
    });
    expect(result).toMatchObject({
      service: 'NCT API SQL Sub',
      serviceUrl: 'https://sub.example.com',
      afterVersion: 0,
      currentVersion: 4,
      totalRecords: 1,
    });
    expect(result.records[0]).toMatchObject({
      dataSourceType: 'batch_query',
      payload: {
        city: 'Shanghai',
        email: 'demo@example.com',
        name: 'Zhang San',
      },
      payloadEncryptionState: 'plain-json',
      recordKey: 'patient-1',
      version: 4,
      fingerprint: 'generated-fingerprint',
      updatedAt,
    });
    expect(sha256Mock).toHaveBeenCalledTimes(1);
  });

  it('passes through already secure payloads without re-encrypting them', async () => {
    const securePayload: SecureTransferPayload = {
      keyVersion: 2,
      publicData: {
        city: 'Shanghai',
      },
      encryptedData: {
        algorithm: 'AES-GCM',
        iv: 'existing-iv',
        ciphertext: 'existing-ciphertext',
      },
      encryptFields: ['email'],
      syncedAt: '2026-04-21T00:00:00.000Z',
    };
    const { db } = createExportDb(
      [
        {
          record_key: 'patient-2',
          payload_json: JSON.stringify(securePayload),
          version: 8,
          fingerprint: 'stored-fingerprint',
          updated_at: '2026-04-21T00:05:00.000Z',
        },
      ],
      8,
    );

    const result = await exportDatabackFile(
      db,
      {
        APP_NAME: 'NCT API SQL Sub',
      } as Env,
      {
        afterVersion: 3,
        limit: 10,
        serviceUrl: 'https://fallback.example.com',
      },
    );

    expect(result).toMatchObject({
      serviceUrl: 'https://fallback.example.com',
      afterVersion: 3,
      currentVersion: 8,
      totalRecords: 1,
    });
    expect(result.records[0]).toEqual({
      dataSourceType: 'batch_query',
      payload: securePayload,
      payloadEncryptionState: 'secure-transfer',
      recordKey: 'patient-2',
      version: 8,
      fingerprint: 'stored-fingerprint',
      updatedAt: '2026-04-21T00:05:00.000Z',
    });
    expect(sha256Mock).not.toHaveBeenCalled();
  });
});

describe('mother form sync retry policy', () => {
  it('uses 1-minute retries for the first five failures and 30-minute retries afterwards', () => {
    expect(getMotherFormSyncRetryDelayMs(0)).toBe(60 * 1000);
    expect(getMotherFormSyncRetryDelayMs(5)).toBe(60 * 1000);
    expect(getMotherFormSyncRetryDelayMs(6)).toBe(30 * 60 * 1000);
  });

  it('only returns failed rows that are due for retry', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-24T00:30:00.000Z'));

    try {
      const { db, bindCalls } = createPendingSyncDb([
        {
          record_key: 'pending-now',
          updated_at: '2026-04-24T00:29:59.000Z',
          databack_payload_json: '{"name":"pending"}',
          databack_version: 1,
          databack_fingerprint: 'fingerprint-pending',
          mother_sync_status: 'pending',
          mother_sync_attempts: 0,
          mother_sync_last_attempt_at: null,
        },
        {
          record_key: 'fast-due',
          updated_at: '2026-04-24T00:20:00.000Z',
          databack_payload_json: '{"name":"fast"}',
          databack_version: 2,
          databack_fingerprint: 'fingerprint-fast',
          mother_sync_status: 'failed',
          mother_sync_attempts: 5,
          mother_sync_last_attempt_at: '2026-04-24T00:28:59.000Z',
        },
        {
          record_key: 'fast-wait',
          updated_at: '2026-04-24T00:21:00.000Z',
          databack_payload_json: '{"name":"fast-wait"}',
          databack_version: 3,
          databack_fingerprint: 'fingerprint-fast-wait',
          mother_sync_status: 'failed',
          mother_sync_attempts: 5,
          mother_sync_last_attempt_at: '2026-04-24T00:29:30.000Z',
        },
        {
          record_key: 'slow-due',
          updated_at: '2026-04-23T23:50:00.000Z',
          databack_payload_json: '{"name":"slow"}',
          databack_version: 4,
          databack_fingerprint: 'fingerprint-slow',
          mother_sync_status: 'failed',
          mother_sync_attempts: 6,
          mother_sync_last_attempt_at: '2026-04-24T00:00:00.000Z',
        },
        {
          record_key: 'slow-wait',
          updated_at: '2026-04-23T23:55:00.000Z',
          databack_payload_json: '{"name":"slow-wait"}',
          databack_version: 5,
          databack_fingerprint: 'fingerprint-slow-wait',
          mother_sync_status: 'failed',
          mother_sync_attempts: 6,
          mother_sync_last_attempt_at: '2026-04-24T00:00:01.000Z',
        },
        {
          record_key: 'already-synced',
          updated_at: '2026-04-23T23:40:00.000Z',
          databack_payload_json: '{"name":"synced"}',
          databack_version: 6,
          databack_fingerprint: 'fingerprint-synced',
          mother_sync_status: 'synced',
          mother_sync_attempts: 2,
          mother_sync_last_attempt_at: '2026-04-24T00:10:00.000Z',
        },
      ]);

      const result = await listPendingMotherFormSyncRecords(db, 10);

      expect(bindCalls).toContainEqual({
        sql: expect.stringContaining('FROM nct_form AS form'),
        params: [
          5,
          '2026-04-24T00:29:00.000Z',
          5,
          '2026-04-24T00:00:00.000Z',
          10,
        ],
      });
      expect(result.map((item) => item.recordKey)).toEqual([
        'slow-due',
        'fast-due',
        'pending-now',
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps raw submitted future fields in pending mother sync records', async () => {
    const { db } = createPendingSyncDb([
      {
        record_key: 'pending-future-field',
        updated_at: '2026-04-24T00:29:59.000Z',
        databack_payload_json: JSON.stringify({
          name: '测试机构',
          submittedFields: {
            future_question: '未来新增答案',
            future_multi: ['第一项', '第二项'],
          },
        }),
        databack_version: 9,
        databack_fingerprint: 'fingerprint-future',
        mother_sync_status: 'pending',
        mother_sync_attempts: 0,
        mother_sync_last_attempt_at: null,
      },
    ]);

    const result = await listPendingMotherFormSyncRecords(db, 10);

    expect(result[0]).toMatchObject({
      databackFingerprint: 'fingerprint-future',
      databackVersion: 9,
      payload: {
        name: '测试机构',
        submittedFields: {
          future_question: '未来新增答案',
          future_multi: ['第一项', '第二项'],
        },
      },
      recordKey: 'pending-future-field',
      updatedAt: '2026-04-24T00:29:59.000Z',
    });
  });
});
