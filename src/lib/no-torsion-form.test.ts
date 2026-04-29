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
  AGENT_IDENTITY,
  buildGoogleFormFields,
  buildGoogleFormSubmitUrl,
  confirmNoTorsionFormSubmission,
  CUSTOM_AGENT_RELATIONSHIP_OPTION,
  issueFormProtectionToken,
  normalizeGoogleFormSubmitUrl,
  prepareNoTorsionFormSubmission,
  SELF_IDENTITY,
  submitNoTorsionCorrection,
  validateNoTorsionFormSubmission,
} from './no-torsion-form';

const GOOGLE_FORM_DOCUMENT_ID = '13PaZ8fGNa570wSM9IuHBHfwG71x1XYQfLTX6v8_UZso';
const GOOGLE_FORM_DOCUMENT_URL =
  `https://docs.google.com/forms/d/${GOOGLE_FORM_DOCUMENT_ID}`;
const GOOGLE_FORM_PREFILL_DOCUMENT_ID = '1UbMSMO2i58dUpVhSfHJCbVjxzIYQ9TepQY45ml3je5E';
const GOOGLE_FORM_PREFILL_DOCUMENT_URL =
  `https://docs.google.com/forms/d/${GOOGLE_FORM_PREFILL_DOCUMENT_ID}`;

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
      NO_TORSION_CORRECTION_SUBMIT_TARGET: 'D1',
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
    expect(formInput).toMatchObject({
      dataSourceType: 'questionnaire',
    });
    expect(databackInput.recordKey).toBe(formInput.recordKey);
    expect(databackInput).toMatchObject({
      dataSourceType: 'questionnaire',
    });
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

describe('submitNoTorsionFormSubmission', () => {
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

  it('stores raw submitted fields so later questionnaire additions survive D1 and mother sync', async () => {
    const env = {
      DB: {} as D1Database,
      NO_TORSION_FORM_DRY_RUN: 'false',
      NO_TORSION_FORM_PROTECTION_MIN_FILL_MS: '0',
      NO_TORSION_FORM_SUBMIT_TARGET: 'D1',
    } as Env;
    const token = await issueFormProtectionToken(env);

    vi.setSystemTime(new Date('2026-04-24T12:00:05.000Z'));

    const prepared = await prepareNoTorsionFormSubmission(env.DB, env, {
      body: {
        birth_year: '2000',
        cityCode: '440100',
        contact_information: 'contact@example.com',
        date_start: '2024-01-02',
        experience: '个人经历描述。',
        extra_future_field: '未来新增字段',
        extra_future_multi: ['第一项', ' ', '第二项'],
        extra_future_nested: {
          child: '嵌套值',
        },
        form_token: token,
        identity: SELF_IDENTITY,
        provinceCode: '440000',
        school_address: '测试地址',
        school_name: '测试机构',
        sex: '女性',
        website: '',
      },
      requestContext: {
        clientIp: '203.0.113.10',
        lang: 'zh-CN',
        sourcePath: '/form',
        userAgent: 'vitest',
      },
    });

    expect(prepared.mode).toBe('confirm');

    const result = prepared.mode === 'confirm'
      ? await confirmNoTorsionFormSubmission(env.DB, env, {
          confirmationPayload: prepared.confirmationPayload,
          confirmationToken: prepared.confirmationToken,
        })
      : null;

    expect(result?.successfulTargets).toEqual(['d1']);
    expect(writeRecordMock).toHaveBeenCalledTimes(2);

    const formInput = writeRecordMock.mock.calls[0]?.[2] as {
      payload: Record<string, unknown>;
      recordKey: string;
    };
    const databackInput = writeRecordMock.mock.calls[1]?.[2] as {
      payload: Record<string, unknown>;
      recordKey: string;
    };

    expect(databackInput.recordKey).toBe(formInput.recordKey);
    expect(formInput).toMatchObject({
      dataSourceType: 'questionnaire',
    });
    expect(databackInput).toMatchObject({
      dataSourceType: 'questionnaire',
    });
    expect(databackInput.payload).toEqual(formInput.payload);
    expect(formInput.payload.submittedFields).toMatchObject({
      extra_future_field: '未来新增字段',
      extra_future_multi: ['第一项', '第二项'],
      extra_future_nested: {
        child: '嵌套值',
      },
      school_name: '测试机构',
    });
    expect(formInput.payload.submittedFields).not.toHaveProperty('form_token');
    expect(formInput.payload.submittedFields).not.toHaveProperty('website');
  });
});

describe('Google Form submit URL helpers', () => {
  it('normalizes editable document form links to formResponse URLs', () => {
    expect(normalizeGoogleFormSubmitUrl(GOOGLE_FORM_DOCUMENT_URL)).toBe(
      `${GOOGLE_FORM_DOCUMENT_URL}/formResponse`,
    );
    expect(
      normalizeGoogleFormSubmitUrl(`${GOOGLE_FORM_DOCUMENT_URL}/viewform?usp=sf_link`),
    ).toBe(`${GOOGLE_FORM_DOCUMENT_URL}/formResponse`);
    expect(normalizeGoogleFormSubmitUrl(`${GOOGLE_FORM_DOCUMENT_URL}/edit`)).toBe(
      `${GOOGLE_FORM_DOCUMENT_URL}/formResponse`,
    );
    expect(
      normalizeGoogleFormSubmitUrl(`${GOOGLE_FORM_PREFILL_DOCUMENT_URL}/prefill`),
    ).toBe(`${GOOGLE_FORM_PREFILL_DOCUMENT_URL}/formResponse`);
  });

  it('keeps published d/e form links on the published submit path', () => {
    expect(
      normalizeGoogleFormSubmitUrl(
        'https://docs.google.com/forms/d/e/1FAIpQLabc/viewform?usp=sf_link',
      ),
    ).toBe('https://docs.google.com/forms/d/e/1FAIpQLabc/formResponse');
  });

  it('builds submit URLs from both document IDs and published form IDs', () => {
    expect(buildGoogleFormSubmitUrl({ formId: GOOGLE_FORM_DOCUMENT_ID })).toBe(
      `${GOOGLE_FORM_DOCUMENT_URL}/formResponse`,
    );
    expect(buildGoogleFormSubmitUrl({ formId: '1FAIpQLabc' })).toBe(
      'https://docs.google.com/forms/d/e/1FAIpQLabc/formResponse',
    );
  });

  it('requires the Google Form ID config to be an ID, not a full URL', () => {
    expect(
      buildGoogleFormSubmitUrl({
        formId: `${GOOGLE_FORM_DOCUMENT_URL}/viewform`,
      }),
    ).toBe('');
  });
});

describe('buildGoogleFormFields', () => {
  function fieldValueByEntryId(fields: ReturnType<typeof buildGoogleFormFields>) {
    return new Map(fields.map((field) => [field.entryId, String(field.value)]));
  }

  it('maps enhanced questionnaire values to the published Google Form entries', () => {
    const validationResult = validateNoTorsionFormSubmission({
      birth_year: '2000',
      cityCode: '440100',
      contact_information: 'contact@example.com',
      countyCode: '440103',
      date_end: '2024-02-02',
      date_start: '2024-01-02',
      experience: '个人经历描述。',
      exit_method: '自行逃离',
      form_variant: 'react_portal_enhanced',
      headmaster_name: '负责人',
      identity: SELF_IDENTITY,
      legal_aid_status: '想但不知道途径',
      other: '其它补充。',
      parent_motivations: ['"厌学"/学业问题', '亲属或身边人建议'],
      pre_institution_city_code: '440100',
      pre_institution_province_code: '440000',
      provinceCode: '440000',
      scandal: '详细描述。',
      school_address: '测试地址',
      school_awareness_before_entry: '进去前听说过相关新闻。',
      school_coordinates: '23.129110, 113.264385',
      school_name: '测试机构',
      sex: '女性',
      violence_categories: ['体罚（如长跑等）', '辱骂或公开羞辱'],
      abuser_info: '测试施暴者信息。',
    });

    expect(validationResult.ok).toBe(true);

    const fields = validationResult.ok
      ? fieldValueByEntryId(buildGoogleFormFields(validationResult.values))
      : new Map<string, string>();
    const expectedStandaloneQuestionEntries = [
      'entry.500021634',
      'entry.981546984',
      'entry.842223433',
      'entry.1422578992',
      'entry.145491361',
      'entry.1367743406',
      'entry.1344969670',
      'entry.129670533',
      'entry.681431781',
      'entry.38011337',
      'entry.578287646',
      'entry.93256047',
      'entry.1184547907',
      'entry.5034928',
      'entry.1766160152',
      'entry.402227428',
      'entry.1624809773',
      'entry.1390240202',
      'entry.534528800',
      'entry.883193772',
      'entry.1533497153',
      'entry.1085954426',
      'entry.1895858332',
      'entry.1400127416',
      'entry.2022959936',
    ];

    expectedStandaloneQuestionEntries.forEach((entryId) => {
      expect(fields.has(entryId), `${entryId} should be mapped`).toBe(true);
    });

    expect(fields.get('entry.500021634')).toBe(SELF_IDENTITY);
    expect(fields.get('entry.981546984')).toBe('__other_option__');
    expect(fields.get('entry.981546984.other_option_response')).toBe('本人');
    expect(fields.get('entry.842223433')).toBe('2000-01-01');
    expect(fields.get('entry.1422578992')).toBe('女');
    expect(fields.get('entry.145491361')).toBe('廣東');
    expect(fields.get('entry.1367743406')).toBe('广州市');
    expect(fields.get('entry.1344969670')).toBe('2024-01-02');
    expect(fields.get('entry.129670533')).toBe('2024-02-02');
    expect(fields.get('entry.681431781')).toBe('"厌学"/学业问题；亲属或身边人建议');
    expect(fields.get('entry.38011337')).toBe('进去前听说过相关新闻。');
    expect(fields.get('entry.578287646')).toBe('个人经历描述。');
    expect(fields.get('entry.578287646')).not.toContain('离开机构的方式');
    expect(fields.get('entry.93256047')).toBe('自行逃离');
    expect(fields.get('entry.1184547907')).toBe('想但不知道途径');
    expect(fields.get('entry.5034928')).toBe('测试机构');
    expect(fields.get('entry.1766160152')).toBe('廣東');
    expect(fields.get('entry.402227428')).toBe('广州市');
    expect(fields.get('entry.1624809773')).toBe('荔湾区');
    expect(fields.get('entry.1390240202')).toBe('测试地址');
    expect(fields.get('entry.534528800')).toBe('23.129110, 113.264385');
    expect(fields.get('entry.883193772')).toBe('contact@example.com');
    expect(fields.get('entry.1533497153')).toBe('负责人');
    expect(fields.get('entry.1085954426')).toBe('测试施暴者信息。');
    expect(fields.get('entry.1895858332')).toBe('体罚（如长跑等）；辱骂或公开羞辱');
    expect(fields.get('entry.1400127416')).toBe('详细描述。');
    expect(fields.get('entry.1400127416')).not.toContain('机构丑闻及暴力行为包括');
    expect(fields.get('entry.2022959936')).toBe('其它补充。');
    expect(fields.get('entry.2022959936')).not.toContain('被送去机构的原因');
    expect(fields.get('entry.2022959936')).not.toContain('举报和寻求法律援助情况');
    expect(fields.get('entry.2022959936')).not.toContain('已知施暴者');
  });

  it('normalizes representative relationships for Google Form choice options', () => {
    const validationResult = validateNoTorsionFormSubmission({
      agent_relationship: '伴侣',
      birth_year: '2000',
      cityCode: '440100',
      contact_information: 'contact@example.com',
      date_start: '2024-01-02',
      experience: '个人经历描述。',
      identity: AGENT_IDENTITY,
      provinceCode: '440000',
      school_address: '测试地址',
      school_name: '测试机构',
      sex: '男性',
    });

    expect(validationResult.ok).toBe(true);

    const fields = validationResult.ok
      ? fieldValueByEntryId(buildGoogleFormFields(validationResult.values))
      : new Map<string, string>();

    expect(fields.get('entry.981546984')).toBe('伴侶');
  });
});

describe('validateNoTorsionFormSubmission', () => {
  it('keeps the pre-entry school awareness answer for self submissions only', () => {
    const baseBody = {
      birth_year: '2000',
      cityCode: '110101',
      contact_information: 'contact@example.com',
      date_start: '2024-01-01',
      experience: '个人经历。',
      identity: SELF_IDENTITY,
      provinceCode: '110000',
      school_awareness_before_entry: '进去前听说过类似机构的新闻。',
      school_coordinates: '39.904200, 116.407400',
      school_name: '测试机构',
      sex: '女性',
    };

    const selfResult = validateNoTorsionFormSubmission(baseBody);

    expect(selfResult).toEqual(expect.objectContaining({ ok: true }));
    expect(selfResult.ok ? selfResult.values.schoolAwarenessBeforeEntry : '').toBe(
      '进去前听说过类似机构的新闻。',
    );
    expect(selfResult.ok ? selfResult.values.schoolCoordinates : '').toBe(
      '39.904200, 116.407400',
    );
    expect(selfResult.ok ? selfResult.values.latitude : null).toBe(39.9042);
    expect(selfResult.ok ? selfResult.values.longitude : null).toBe(116.4074);

    const agentResult = validateNoTorsionFormSubmission({
      ...baseBody,
      agent_relationship: '朋友',
      identity: AGENT_IDENTITY,
    });

    expect(agentResult.ok).toBe(true);
    expect(agentResult.ok ? agentResult.values.schoolAwarenessBeforeEntry : 'x').toBe('');
  });

  it('requires and normalizes custom representative relationships', () => {
    const baseBody = {
      birth_year: '2000',
      cityCode: '110101',
      contact_information: 'contact@example.com',
      date_start: '2024-01-01',
      experience: '个人经历。',
      identity: AGENT_IDENTITY,
      provinceCode: '110000',
      school_name: '测试机构',
      sex: '女性',
    };

    const missingOtherResult = validateNoTorsionFormSubmission({
      ...baseBody,
      agent_relationship: CUSTOM_AGENT_RELATIONSHIP_OPTION,
    });

    expect(missingOtherResult.ok).toBe(false);
    expect(missingOtherResult.ok ? [] : missingOtherResult.errors).toContain(
      'Relationship is required.',
    );

    const customResult = validateNoTorsionFormSubmission({
      ...baseBody,
      agent_relationship: CUSTOM_AGENT_RELATIONSHIP_OPTION,
      agent_relationship_other: '老师',
    });

    expect(customResult.ok).toBe(true);
    expect(customResult.ok ? customResult.values.agentRelationship : '').toBe('老师');
    expect(customResult.ok ? customResult.values.other : 'x').toBe('');
  });

  it('keeps representative relationship optional unless custom text is requested', () => {
    const result = validateNoTorsionFormSubmission({
      birth_year: '2000',
      cityCode: '110101',
      contact_information: 'contact@example.com',
      date_start: '2024-01-01',
      experience: '个人经历。',
      identity: AGENT_IDENTITY,
      provinceCode: '110000',
      school_name: '测试机构',
      sex: '女性',
    });

    expect(result.ok).toBe(true);
    expect(result.ok ? result.values.agentRelationship : 'x').toBe('');
  });

  it('rejects invalid coordinate pairs', () => {
    const result = validateNoTorsionFormSubmission({
      birth_year: '2000',
      cityCode: '110101',
      contact_information: 'contact@example.com',
      date_start: '2024-01-01',
      experience: '个人经历。',
      identity: SELF_IDENTITY,
      provinceCode: '110000',
      school_coordinates: '200, 116.407400',
      school_name: '测试机构',
      sex: '女性',
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors).toContain('Coordinates are invalid.');
  });

  it('rejects dates with years longer than four digits', () => {
    const result = validateNoTorsionFormSubmission({
      birth_year: '2000',
      cityCode: '110101',
      contact_information: 'contact@example.com',
      date_end: '10000-01-02',
      date_start: '10000-01-01',
      experience: '个人经历。',
      identity: SELF_IDENTITY,
      provinceCode: '110000',
      school_name: '测试机构',
      sex: '女性',
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors).toEqual(
      expect.arrayContaining(['Start date is invalid.', 'End date is invalid.']),
    );
  });
});
