import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  confirmNoTorsionFormSubmissionMock,
  getDatabackVersionMock,
  getTableCountsMock,
  issueFormProtectionTokenMock,
  prepareNoTorsionFormSubmissionMock,
  submitNoTorsionCorrectionMock,
  translateDetailItemsMock,
} = vi.hoisted(() => ({
  confirmNoTorsionFormSubmissionMock: vi.fn(),
  getDatabackVersionMock: vi.fn(),
  getTableCountsMock: vi.fn(),
  issueFormProtectionTokenMock: vi.fn(),
  prepareNoTorsionFormSubmissionMock: vi.fn(),
  submitNoTorsionCorrectionMock: vi.fn(),
  translateDetailItemsMock: vi.fn(),
}));

vi.mock('./lib/data', async () => {
  const actual = await vi.importActual<typeof import('./lib/data')>('./lib/data');

  return {
    ...actual,
    getDatabackVersion: getDatabackVersionMock,
    getTableCounts: getTableCountsMock,
  };
});

vi.mock('./lib/no-torsion-form', async () => {
  const actual = await vi.importActual<typeof import('./lib/no-torsion-form')>('./lib/no-torsion-form');

  return {
    ...actual,
    confirmNoTorsionFormSubmission: confirmNoTorsionFormSubmissionMock,
    issueFormProtectionToken: issueFormProtectionTokenMock,
    prepareNoTorsionFormSubmission: prepareNoTorsionFormSubmissionMock,
    submitNoTorsionCorrection: submitNoTorsionCorrectionMock,
  };
});

vi.mock('./lib/no-torsion-translation', () => ({
  translateDetailItems: translateDetailItemsMock,
}));

const { app } = await import('./index');

const baseStandaloneValues = {
  abuserInfo: '',
  agentRelationship: '',
  birthDate: '',
  birthDay: '',
  birthMonth: '',
  birthYear: '2000',
  city: '北京市',
  cityCode: '110100',
  contactInformation: 'contact@example.com',
  county: '东城区',
  countyCode: '110101',
  dateEnd: '',
  dateStart: '2024-01-01',
  exitMethod: '',
  experience: '经历摘要',
  googleFormAge: 24,
  headmasterName: '负责人',
  identity: '受害者本人',
  legalAidStatus: '',
  other: '',
  parentMotivations: [],
  preInstitutionCity: '',
  preInstitutionCityCode: '',
  preInstitutionProvince: '',
  preInstitutionProvinceCode: '',
  province: '北京市',
  provinceCode: '110000',
  scandal: '',
  schoolAddress: '某机构地址',
  schoolName: '某机构',
  sex: '女性',
  standaloneEnhancements: true,
  violenceCategories: [],
};

function createEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    NO_TORSION_SERVICE_TOKEN: 'service-token',
    ...overrides,
  };
}

describe('No-Torsion backend routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDatabackVersionMock.mockResolvedValue(0);
    getTableCountsMock.mockResolvedValue({
      nct_databack: 0,
      nct_form: 0,
    });
  });

  it('rejects unauthorized frontend runtime requests when a service token is configured', async () => {
    const response = await app.fetch(
      new Request('https://sub.example.com/api/no-torsion/frontend-runtime?scope=form'),
      createEnv(),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: 'No-Torsion service token is invalid.',
    });
  });

  it('issues frontend runtime tokens for authorized No-Torsion requests', async () => {
    issueFormProtectionTokenMock.mockResolvedValue('issued-form-token');

    const response = await app.fetch(
      new Request('https://sub.example.com/api/no-torsion/frontend-runtime?scope=correction', {
        headers: {
          Authorization: 'Bearer service-token',
        },
      }),
      createEnv(),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      formProtectionToken: 'issued-form-token',
      scope: 'correction',
    });
    expect(issueFormProtectionTokenMock).toHaveBeenCalledWith(
      expect.objectContaining({
        NO_TORSION_SERVICE_TOKEN: 'service-token',
      }),
    );
  });

  it('renders the public Hono standalone form page without service authentication', async () => {
    issueFormProtectionTokenMock.mockResolvedValue('public-form-token');

    const response = await app.fetch(
      new Request('https://sub.example.com/no-torsion/form?lang=en'),
      createEnv(),
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('public-form-token');
    expect(html).toContain('Standalone submission');
    expect(issueFormProtectionTokenMock).toHaveBeenCalledWith(
      expect.objectContaining({
        NO_TORSION_SERVICE_TOKEN: 'service-token',
      }),
    );
  });

  it('renders the public standalone preview page after posting the Hono form', async () => {
    const env = createEnv();
    prepareNoTorsionFormSubmissionMock.mockResolvedValue({
      confirmationPayload: 'encoded-confirmation-payload',
      confirmationToken: 'encoded-confirmation-token',
      encodedPayload: 'entry.1=remote-school',
      mode: 'confirm',
      values: {
        ...baseStandaloneValues,
        schoolName: '独立表单机构',
      },
    });

    const formBody = new URLSearchParams({
      cityCode: '110100',
      contact_information: 'contact@example.com',
      countyCode: '110101',
      date_start: '2024-01-01',
      form_token: 'public-form-token',
      identity: '受害者本人',
      lang: 'zh-CN',
      provinceCode: '110000',
      school_name: '独立表单机构',
      sex: '女性',
      website: '',
    });

    const response = await app.fetch(
      new Request('https://sub.example.com/no-torsion/form', {
        body: formBody,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'standalone-test-agent',
          'X-Forwarded-For': '203.0.113.9, 198.51.100.3',
        },
        method: 'POST',
      }),
      env,
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('提交前确认');
    expect(html).toContain('独立表单机构');
    expect(html).toContain('encoded-confirmation-payload');
    expect(prepareNoTorsionFormSubmissionMock).toHaveBeenCalledWith(
      env.DB,
      env,
      {
        body: {
          cityCode: '110100',
          contact_information: 'contact@example.com',
          countyCode: '110101',
          date_start: '2024-01-01',
          form_token: 'public-form-token',
          identity: '受害者本人',
          lang: 'zh-CN',
          provinceCode: '110000',
          school_name: '独立表单机构',
          sex: '女性',
          website: '',
        },
        requestContext: {
          clientIp: '203.0.113.9',
          lang: 'zh-CN',
          sourcePath: '/no-torsion/form',
          userAgent: 'standalone-test-agent',
        },
      },
    );
  });

  it('passes nested form bodies and request context through to the No-Torsion prepare handler', async () => {
    const env = createEnv();
    prepareNoTorsionFormSubmissionMock.mockResolvedValue({
      encodedPayload: 'entry.1=remote-school',
      mode: 'preview',
      values: {
        schoolName: '远程机构',
      },
    });

    const response = await app.fetch(
      new Request('https://sub.example.com/api/no-torsion/form/prepare', {
        body: JSON.stringify({
          body: {
            school_name: '远程机构',
            website: '',
          },
          requestContext: {
            clientIp: '203.0.113.10',
            lang: 'zh-CN',
            sourcePath: '/submit',
            userAgent: 'unit-test',
          },
        }),
        headers: {
          Authorization: 'Bearer service-token',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      encodedPayload: 'entry.1=remote-school',
      mode: 'preview',
      values: {
        schoolName: '远程机构',
      },
    });
    expect(prepareNoTorsionFormSubmissionMock).toHaveBeenCalledWith(
      env.DB,
      env,
      {
        body: {
          school_name: '远程机构',
          website: '',
        },
        requestContext: {
          clientIp: '203.0.113.10',
          lang: 'zh-CN',
          sourcePath: '/submit',
          userAgent: 'unit-test',
        },
      },
    );
  });

  it('returns a 500 response for confirm results that contain only failed targets', async () => {
    confirmNoTorsionFormSubmissionMock.mockResolvedValue({
      encodedPayload: 'entry.1=remote-school',
      resultsByTarget: {
        d1: {
          error: 'D1 unavailable.',
          ok: false,
        },
      },
      successfulTargets: [],
    });

    const response = await app.fetch(
      new Request('https://sub.example.com/api/no-torsion/form/confirm', {
        body: JSON.stringify({
          confirmationPayload: 'payload-from-no-torsion',
          confirmationToken: 'token-from-no-torsion',
        }),
        headers: {
          Authorization: 'Bearer service-token',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }),
      createEnv(),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      encodedPayload: 'entry.1=remote-school',
      resultsByTarget: {
        d1: {
          error: 'D1 unavailable.',
          ok: false,
        },
      },
      successfulTargets: [],
    });
  });
});
