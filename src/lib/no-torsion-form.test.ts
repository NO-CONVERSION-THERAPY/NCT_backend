import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getOrCreateFormProtectionSecretMock,
  writeRecordMock,
} = vi.hoisted(() => ({
  getOrCreateFormProtectionSecretMock: vi.fn(),
  writeRecordMock: vi.fn(),
}));

vi.mock('./data', () => ({
  getOrCreateFormProtectionSecret: getOrCreateFormProtectionSecretMock,
  writeRecord: writeRecordMock,
}));

import {
  issueFormProtectionToken,
  submitNoTorsionCorrection,
} from './no-torsion-form';

describe('submitNoTorsionCorrection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-24T12:00:00.000Z'));
    getOrCreateFormProtectionSecretMock.mockResolvedValue('unit-test-secret');
    writeRecordMock.mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('writes D1 correction submissions to both nct_form and nct_databack', async () => {
    const env = {
      DB: {} as D1Database,
      NO_TORSION_CORRECTION_SUBMIT_TARGET: 'd1',
    } as Env;
    const token = await issueFormProtectionToken(env);

    vi.setSystemTime(new Date('2026-04-24T12:00:05.000Z'));

    const result = await submitNoTorsionCorrection(env.DB, env, {
      body: {
        cityCode: '440100',
        contact_information: 'contact@example.com',
        correction_content: '更正机构信息。',
        countyCode: '440103',
        form_token: token,
        headmaster_name: '负责人',
        provinceCode: '440000',
        school_address: '广州市荔湾区',
        school_name: '测试机构',
        website: '',
      },
      requestContext: {
        clientIp: '203.0.113.9',
        lang: 'zh-CN',
        sourcePath: '/map/correction/submit',
        userAgent: 'vitest',
      },
    });

    expect(result.successfulTargets).toEqual(['d1']);
    expect(writeRecordMock).toHaveBeenCalledTimes(2);

    const firstCall = writeRecordMock.mock.calls[0];
    const secondCall = writeRecordMock.mock.calls[1];
    expect(firstCall?.[1]).toBe('nct_form');
    expect(secondCall?.[1]).toBe('nct_databack');

    const formInput = firstCall?.[2] as {
      payload: Record<string, unknown>;
      recordKey: string;
    };
    const databackInput = secondCall?.[2] as {
      payload: Record<string, unknown>;
      recordKey: string;
    };

    expect(formInput.recordKey).toMatch(/^no-torsion:correction:/);
    expect(databackInput.recordKey).toBe(formInput.recordKey);
    expect(databackInput.payload).toEqual(formInput.payload);
    expect(formInput.payload).toMatchObject({
      city: '广州市',
      county: '荔湾区',
      name: '测试机构',
      province: '广东省',
      recordKind: 'no_torsion_correction',
      schoolAddress: '广州市荔湾区',
      schoolName: '测试机构',
      source: 'No-Torsion',
      sourcePath: '/map/correction/submit',
    });
  });
});
