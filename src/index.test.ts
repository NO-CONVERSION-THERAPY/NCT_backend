import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  confirmNoTorsionFormSubmissionMock,
  exportDatabackFileMock,
  getDatabackVersionMock,
  getTableCountsMock,
  issueFormProtectionTokenMock,
  prepareNoTorsionFormSubmissionMock,
  submitNoTorsionCorrectionMock,
  translateDetailItemsMock,
  verifyServiceAuthTokenMock,
} = vi.hoisted(() => ({
  confirmNoTorsionFormSubmissionMock: vi.fn(),
  exportDatabackFileMock: vi.fn(),
  getDatabackVersionMock: vi.fn(),
  getTableCountsMock: vi.fn(),
  issueFormProtectionTokenMock: vi.fn(),
  prepareNoTorsionFormSubmissionMock: vi.fn(),
  submitNoTorsionCorrectionMock: vi.fn(),
  translateDetailItemsMock: vi.fn(),
  verifyServiceAuthTokenMock: vi.fn(),
}));

vi.mock('./lib/data', async () => {
  const actual = await vi.importActual<typeof import('./lib/data')>('./lib/data');

  return {
    ...actual,
    exportDatabackFile: exportDatabackFileMock,
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

vi.mock('./lib/service-auth', () => ({
  readBearerToken: (request: Request) =>
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
      || request.headers.get('x-api-token')?.trim()
      || null,
  verifyServiceAuthToken: verifyServiceAuthTokenMock,
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
  latitude: 39.9042,
  legalAidStatus: '',
  longitude: 116.4074,
  other: '',
  parentMotivations: [],
  preInstitutionCity: '',
  preInstitutionCityCode: '',
  preInstitutionProvince: '',
  preInstitutionProvinceCode: '',
  province: '北京市',
  provinceCode: '110000',
  scandal: '',
  schoolAwarenessBeforeEntry: '听说过类似机构的新闻',
  schoolAddress: '某机构地址',
  schoolCoordinates: '39.904200, 116.407400',
  schoolName: '某机构',
  sex: '女性',
  standaloneEnhancements: true,
  submittedFields: {},
  violenceCategories: [],
};

function createEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    DATABACK_EXPORT_MIN_INTERVAL_MS: '0',
    ...overrides,
  };
}

function createDatabackExportRateLimitDb(payload: Record<string, unknown>) {
  let storedPayloadJson = JSON.stringify(payload);

  return {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
            first: async () => {
              if (sql.includes('SELECT payload_json') && sql.includes('FROM nct_form')) {
                return {
                  payload_json: storedPayloadJson,
                };
              }

              throw new Error(`Unexpected first SQL: ${sql}`);
            },
            run: async () => {
              if (sql.includes('INSERT INTO nct_form')) {
                storedPayloadJson = String(params[2]);
                return {
                  success: true,
                };
              }

              throw new Error(`Unexpected run SQL: ${sql}`);
            },
          };
        },
      };
    },
    readStoredPayload() {
      return JSON.parse(storedPayloadJson) as Record<string, unknown>;
    },
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
    verifyServiceAuthTokenMock.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('issues frontend runtime tokens for public No-Torsion requests', async () => {
    issueFormProtectionTokenMock.mockResolvedValue('issued-form-token');

    const response = await app.fetch(
      new Request('https://sub.example.com/api/no-torsion/frontend-runtime?scope=correction'),
      createEnv(),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      formProtectionToken: 'issued-form-token',
      scope: 'correction',
    });
    expect(issueFormProtectionTokenMock).toHaveBeenCalledWith(
      expect.objectContaining({ DB: expect.anything() }),
    );
  });

  it('renders the public Hono standalone form page without service authentication', async () => {
    issueFormProtectionTokenMock.mockResolvedValue('public-form-token');

    const response = await app.fetch(
      new Request('https://sub.example.com/form?lang=en'),
      createEnv(),
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('public-form-token');
    expect(html).toContain('Conversion Institution Survivor Questionnaire');
    expect(html).toContain('data-standalone-language-link="zh-CN"');
    expect(html).not.toContain('Back to home');
    expect(html).toContain('Crisis support');
    expect(html).toContain('/form?lang=en');
    expect(issueFormProtectionTokenMock).toHaveBeenCalledWith(
      expect.objectContaining({ DB: expect.anything() }),
    );
  });

  it('uses the frontend origin as the standalone form home link when embedded', async () => {
    issueFormProtectionTokenMock.mockResolvedValue('embedded-public-form-token');

    const response = await app.fetch(
      new Request('https://sub.example.com/form?lang=en', {
        headers: {
          referer: 'https://nct.example.com/form?lang=en',
        },
      }),
      createEnv(),
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).not.toContain('Back to home');
    expect(html).toContain('embedded-public-form-token');
  });

  it('renders the standalone form page at the service root', async () => {
    issueFormProtectionTokenMock.mockResolvedValue('root-public-form-token');

    const response = await app.fetch(
      new Request('https://sub.example.com/?lang=en'),
      createEnv(),
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('root-public-form-token');
    expect(html).toContain('Conversion Institution Survivor Questionnaire');
    expect(html).toContain('/form?lang=en');
  });

  it('keeps the legacy /no-torsion/form entrypoint working for backward compatibility', async () => {
    issueFormProtectionTokenMock.mockResolvedValue('legacy-public-form-token');

    const response = await app.fetch(
      new Request('https://sub.example.com/no-torsion/form?lang=en'),
      createEnv(),
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('legacy-public-form-token');
    expect(html).toContain('/form?lang=en');
  });

  it('hides debug pages unless DEBUG_MOD is enabled', async () => {
    const response = await app.fetch(
      new Request('https://sub.example.com/debug'),
      createEnv({ DEBUG_MOD: 'false' }),
    );

    expect(response.status).toBe(404);
  });

  it('renders a debug index with links to standalone page routes when DEBUG_MOD is enabled', async () => {
    const response = await app.fetch(
      new Request('https://sub.example.com/debug?lang=en'),
      createEnv({ DEBUG_MOD: 'true' }),
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('Debug routes');
    expect(html).toContain('data-standalone-language-link="zh-CN" href="/debug?lang=zh-CN"');
    expect(html).toContain('/form?lang=en');
    expect(html).toContain('/no-torsion/form?lang=en');
    expect(html).toContain('/debug/submit-preview?lang=en');
    expect(html).toContain('/debug/submit-confirm?lang=en');
    expect(html).toContain('/debug/submit-success?lang=en');
    expect(html).toContain('/debug/submit-error?lang=en');
    expect(html).toContain('/api/no-torsion/frontend-runtime?scope=form');
  });

  it('renders debug preview, confirm, success, and error pages when DEBUG_MOD is enabled', async () => {
    const env = createEnv({ DEBUG_MOD: 'true' });
    const [previewResponse, confirmResponse, successResponse, errorResponse] =
      await Promise.all([
        app.fetch(new Request('https://sub.example.com/debug/submit-preview?lang=en'), env),
        app.fetch(new Request('https://sub.example.com/debug/submit-confirm?lang=en'), env),
        app.fetch(new Request('https://sub.example.com/debug/submit-success?lang=en'), env),
        app.fetch(new Request('https://sub.example.com/debug/submit-error?lang=en'), env),
      ]);

    expect(previewResponse.status).toBe(200);
    expect(await previewResponse.text()).toContain('Debug sample institution');
    expect(confirmResponse.status).toBe(200);
    expect(await confirmResponse.text()).toContain('debug-confirmation-payload');
    expect(successResponse.status).toBe(200);
    expect(await successResponse.text()).toContain('Delivered');
    expect(errorResponse.status).toBe(200);
    expect(await errorResponse.text()).toContain('Debug sample submission error.');
  });

  it('simulates debug confirmation without submitting real data', async () => {
    const response = await app.fetch(
      new Request('https://sub.example.com/debug/submit-confirm?lang=en', {
        body: new URLSearchParams({
          confirmation_payload: 'debug-confirmation-payload',
          confirmation_token: 'debug-confirmation-token',
          lang: 'en',
        }),
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
        method: 'POST',
      }),
      createEnv({ DEBUG_MOD: 'true' }),
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('Submission complete');
    expect(html).toContain('Delivered');
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
      new Request('https://sub.example.com/form', {
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
    expect(html).toContain('/form/confirm?lang=zh-CN');
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
          sourcePath: '/form',
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

  it('rate limits public databack recovery export requests', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-26T00:00:00.000Z'));
    const db = createDatabackExportRateLimitDb({
      lastExportAt: '2026-04-26T00:00:00.000Z',
    });

    const response = await app.fetch(
      new Request('https://sub.example.com/api/export/nct_databack'),
      createEnv({
        DATABACK_EXPORT_MIN_INTERVAL_MS: '60000',
        DB: db as unknown as D1Database,
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(await response.json()).toEqual({
      error: 'Databack export is rate limited.',
      lastExportAt: '2026-04-26T00:00:00.000Z',
      retryAfterMs: 60000,
    });
    expect(exportDatabackFileMock).not.toHaveBeenCalled();
    expect(db.readStoredPayload()).toMatchObject({
      kind: 'databackExportRateLimit',
      lastRejectReason: 'rate_limited',
      rejectedCount: 1,
    });
  });

  it('exports databack recovery payloads with service-url HMAC auth', async () => {
    exportDatabackFileMock.mockResolvedValue({
      afterVersion: 3,
      currentVersion: 7,
      exportedAt: '2026-04-23T12:34:56.000Z',
      records: [],
      service: 'NCT API SQL Sub',
      serviceUrl: 'https://sub.example.com',
      totalRecords: 0,
    });

    const response = await app.fetch(
      new Request('https://sub.example.com/api/export/nct_databack?afterVersion=3&limit=99', {
        headers: {
          authorization: 'Bearer rotating-auth-token',
        },
      }),
      createEnv(),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toContain('nct-databack-2026-04-23T12-34-56-000Z.json');
    expect(await response.json()).toEqual({
      afterVersion: 3,
      currentVersion: 7,
      exportedAt: '2026-04-23T12:34:56.000Z',
      records: [],
      service: 'NCT API SQL Sub',
      serviceUrl: 'https://sub.example.com',
      totalRecords: 0,
    });
    expect(exportDatabackFileMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      {
        afterVersion: 3,
        limit: 99,
        serviceUrl: 'https://sub.example.com',
      },
    );
    expect(verifyServiceAuthTokenMock).toHaveBeenCalledWith(
      'https://sub.example.com',
      'rotating-auth-token',
    );
  });
});

describe('media file routes', () => {
  it('serves uploaded R2 media files through the public media route', async () => {
    const get = vi.fn(async () => ({
      body: new Blob(['media-bytes']).stream(),
      httpEtag: '"media-etag"',
      writeHttpMetadata(headers: Headers) {
        headers.set('content-type', 'image/png');
      },
    }));

    const response = await app.fetch(
      new Request('https://sub.example.test/api/media/files/media/schools/demo/2026/file.png'),
      createEnv({
        MEDIA_BUCKET: {
          get,
        } as unknown as R2Bucket,
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('media-bytes');
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('etag')).toBe('"media-etag"');
    expect(get).toHaveBeenCalledWith('media/schools/demo/2026/file.png');
  });

  it('rejects unsafe R2 media file keys', async () => {
    const get = vi.fn();
    const response = await app.fetch(
      new Request('https://sub.example.test/api/media/files/private/secret.png'),
      createEnv({
        MEDIA_BUCKET: {
          get,
        } as unknown as R2Bucket,
      }),
    );

    expect(response.status).toBe(400);
    expect(get).not.toHaveBeenCalled();
  });
});
