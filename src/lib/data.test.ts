import { describe, expect, it, vi } from 'vitest';

const { encryptObjectMock, sha256Mock } = vi.hoisted(() => ({
  encryptObjectMock: vi.fn(),
  sha256Mock: vi.fn(),
}));

vi.mock('./crypto', () => ({
  encryptObject: encryptObjectMock,
  sha256: sha256Mock,
}));

import { exportDatabackFile } from './data';
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

describe('exportDatabackFile', () => {
  it('converts plain databack rows into secure transfer payloads', async () => {
    encryptObjectMock.mockResolvedValue({
      algorithm: 'AES-GCM',
      iv: 'iv-value',
      ciphertext: 'ciphertext-value',
    });
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
        DEFAULT_ENCRYPT_FIELDS: 'email,name',
        ENCRYPTION_KEY: 'secret-key',
      } as Env,
      {
        afterVersion: -5,
        limit: 999,
      },
    );

    expect(bindCalls[0]).toEqual({
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
      recordKey: 'patient-1',
      version: 4,
      fingerprint: 'generated-fingerprint',
      updatedAt,
      payload: {
        keyVersion: 1,
        publicData: {
          city: 'Shanghai',
        },
        encryptedData: {
          algorithm: 'AES-GCM',
          iv: 'iv-value',
          ciphertext: 'ciphertext-value',
        },
        encryptFields: ['email', 'name'],
        syncedAt: updatedAt,
      },
    });
    expect(encryptObjectMock).toHaveBeenCalledWith(
      {
        email: 'demo@example.com',
        name: 'Zhang San',
      },
      'secret-key',
    );
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
        ENCRYPTION_KEY: 'secret-key',
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
      recordKey: 'patient-2',
      version: 8,
      fingerprint: 'stored-fingerprint',
      payload: securePayload,
      updatedAt: '2026-04-21T00:05:00.000Z',
    });
    expect(encryptObjectMock).not.toHaveBeenCalled();
    expect(sha256Mock).not.toHaveBeenCalled();
  });
});
