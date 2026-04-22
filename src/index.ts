import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { renderToString } from 'hono/jsx/dom/server';
import { z } from 'zod';
import {
  exportDatabackFile,
  getDatabackVersion,
  getTableCounts,
  importMotherPushRecords,
  listRecords,
  writeRecord
} from './lib/data';
import {
  confirmNoTorsionFormSubmission,
  issueFormProtectionToken,
  prepareNoTorsionFormSubmission,
  submitNoTorsionCorrection,
  type NoTorsionConfirmResult
} from './lib/no-torsion-form';
import { translateDetailItems } from './lib/no-torsion-translation';
import { toJsonObject } from './lib/json';
import { maybeReportOnFirstExecution, reportToMother } from './lib/report';
import { assertToken } from './lib/security';
import {
  NoTorsionStandaloneFormPage,
  NoTorsionStandalonePreviewPage,
  NoTorsionStandaloneResultPage,
} from './site/no-torsion-form-page';
import type { DynamicTableName, MotherPushPayload, RecordWriteRequest } from './types';

const tableSchema = z.enum(['nct_form', 'nct_databack']);

const writeSchema = z.object({
  table: tableSchema,
  recordKey: z.string().optional(),
  payload: z
    .record(z.string(), z.unknown())
    .transform((value) => toJsonObject(value)),
  mirrorToDataback: z.boolean().optional()
}) satisfies z.ZodType<RecordWriteRequest>;

const secureTransferPayloadSchema = z.object({
  keyVersion: z.number().int().min(1),
  publicData: z
    .record(z.string(), z.unknown())
    .transform((value) => toJsonObject(value)),
  encryptedData: z.object({
    algorithm: z.literal('AES-GCM'),
    iv: z.string().min(1),
    ciphertext: z.string().min(1)
  }),
  encryptFields: z.array(z.string()),
  syncedAt: z.string().nullable()
});

const motherPushSchema = z.object({
  service: z.string().min(1),
  mode: z.enum(['full', 'delta']),
  previousVersion: z.number().int().min(0),
  currentVersion: z.number().int().min(0),
  totalRecords: z.number().int().min(0),
  records: z.array(
    z.object({
      recordKey: z.string().min(1),
      version: z.number().int().min(0),
      fingerprint: z.string().min(1),
      payload: secureTransferPayloadSchema
    })
  ),
  generatedAt: z.string().min(1)
}) satisfies z.ZodType<MotherPushPayload>;

const RECOGNIZED_MOTHER_SERVICES = new Set([
  'NCT API SQL',
  'nct-api-sql'
]);

function parseNoTorsionBody(input: unknown): {
  body: Record<string, unknown>;
  requestContext: {
    clientIp?: string;
    lang?: string;
    sourcePath?: string;
    userAgent?: string;
  };
} {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Expected an object body.');
  }

  const candidate = input as {
    body?: unknown;
    requestContext?: unknown;
  };
  const body =
    candidate.body && typeof candidate.body === 'object' && !Array.isArray(candidate.body)
      ? toJsonObject(candidate.body as Record<string, unknown>)
      : toJsonObject(candidate as Record<string, unknown>);
  const rawRequestContext =
    candidate.requestContext && typeof candidate.requestContext === 'object' && !Array.isArray(candidate.requestContext)
      ? candidate.requestContext as Record<string, unknown>
      : {};

  return {
    body,
    requestContext: {
      clientIp:
        typeof rawRequestContext.clientIp === 'string'
          ? rawRequestContext.clientIp
          : undefined,
      lang:
        typeof rawRequestContext.lang === 'string'
          ? rawRequestContext.lang
          : undefined,
      sourcePath:
        typeof rawRequestContext.sourcePath === 'string'
          ? rawRequestContext.sourcePath
          : undefined,
      userAgent:
        typeof rawRequestContext.userAgent === 'string'
          ? rawRequestContext.userAgent
          : undefined
    }
  };
}

function buildNoTorsionErrorResponse(
  context: Parameters<typeof assertToken>[0],
  error: unknown
): Response {
  const message = error instanceof Error ? error.message : 'Unknown backend error.';

  if (message.startsWith('FORM_PROTECTION:')) {
    return context.json(
      {
        error: 'Invalid form submission.',
        reason: message.slice('FORM_PROTECTION:'.length)
      },
      400
    );
  }

  if (message.startsWith('FORM_VALIDATION:')) {
    return context.json(
      {
        details: message
          .slice('FORM_VALIDATION:'.length)
          .split(' | ')
          .filter(Boolean),
        error: 'Form validation failed.'
      },
      400
    );
  }

  if (message.startsWith('FORM_CONFIRMATION:')) {
    return context.json(
      {
        error: 'Invalid confirmation payload.',
        reason: message.slice('FORM_CONFIRMATION:'.length)
      },
      400
    );
  }

  if (message.startsWith('CORRECTION_VALIDATION:')) {
    return context.json(
      {
        details: message
          .slice('CORRECTION_VALIDATION:'.length)
          .split(' | ')
          .filter(Boolean),
        error: 'Correction validation failed.'
      },
      400
    );
  }

  return context.json(
    {
      error: message
    },
    500
  );
}

export const app = new Hono<{ Bindings: Env }>();

async function readMultipartJsonPayload(request: Request): Promise<unknown> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    return request.json();
  }

  const formData = await request.formData();
  const fileEntry = formData.get('file') ?? formData.get('payload');

  if (
    !fileEntry
    || typeof fileEntry !== 'object'
    || typeof (fileEntry as Blob).text !== 'function'
  ) {
    throw new Error('Missing JSON file attachment.');
  }

  return JSON.parse(await (fileEntry as Blob).text());
}

async function parseFormBody(
  request: Request
): Promise<Record<string, unknown>> {
  const formData = await request.formData();
  const result: Record<string, unknown> = {};

  for (const [key, value] of formData.entries()) {
    if (typeof value !== 'string') {
      continue;
    }

    const existingValue = result[key];
    if (typeof existingValue === 'undefined') {
      result[key] = value;
      continue;
    }

    if (Array.isArray(existingValue)) {
      existingValue.push(value);
      continue;
    }

    result[key] = [existingValue, value];
  }

  return result;
}

function resolveNoTorsionLanguage(value?: string): 'en' | 'zh-CN' | 'zh-TW' {
  return value === 'en' || value === 'zh-CN' || value === 'zh-TW'
    ? value
    : 'zh-CN';
}

function readClientIp(request: Request): string | undefined {
  const directIp = request.headers.get('cf-connecting-ip')?.trim();
  if (directIp) {
    return directIp;
  }

  const forwarded = request.headers.get('x-forwarded-for');
  if (!forwarded) {
    return undefined;
  }

  const firstHop = forwarded
    .split(',')
    .map((chunk) => chunk.trim())
    .find(Boolean);

  return firstHop || undefined;
}

function buildStandaloneFailureResult(message: string): NoTorsionConfirmResult {
  return {
    encodedPayload: '',
    resultsByTarget: {
      d1: {
        error: message,
        ok: false
      },
      google: {
        error: message,
        ok: false
      }
    },
    successfulTargets: []
  };
}

app.use(
  '/api/*',
  cors({
    origin: '*',
    allowHeaders: ['content-type', 'authorization', 'x-api-token'],
    allowMethods: ['GET', 'POST', 'OPTIONS']
  })
);

app.get('/', async (context) => {
  const [counts, currentDatabackVersion] = await Promise.all([
    getTableCounts(context.env.DB),
    getDatabackVersion(context.env.DB)
  ]);

  return context.json({
    app: context.env.APP_NAME ?? 'NCT API SQL Sub',
    serviceUrl: context.env.SERVICE_PUBLIC_URL ?? new URL(context.req.url).origin,
    status: 'ok',
    tables: counts,
    databackVersion: currentDatabackVersion,
    routes: {
      health: '/api/health',
      write: '/api/write',
      pushFromMother: '/api/push/secure-records',
      noTorsionFormPage: '/no-torsion/form',
      noTorsionFrontendRuntime: '/api/no-torsion/frontend-runtime',
      noTorsionFormPrepare: '/api/no-torsion/form/prepare',
      noTorsionFormConfirm: '/api/no-torsion/form/confirm',
      noTorsionCorrectionSubmit: '/api/no-torsion/correction/submit',
      noTorsionTranslateText: '/api/no-torsion/translate-text',
      exportDataback: '/api/export/nct_databack',
      readForm: '/api/data/nct_form',
      readDataback: '/api/data/nct_databack',
      reportNow: '/api/report-now'
    }
  });
});

app.get('/no-torsion/form', async (context) => {
  const language = resolveNoTorsionLanguage(context.req.query('lang'));
  const token = await issueFormProtectionToken(context.env);

  return context.html(
    renderToString(
      NoTorsionStandaloneFormPage({
        lang: language,
        token
      })
    )
  );
});

app.post('/no-torsion/form', async (context) => {
  const body = await parseFormBody(context.req.raw);
  const language = resolveNoTorsionLanguage(
    typeof body.lang === 'string' ? body.lang : context.req.query('lang')
  );

  try {
    const result = await prepareNoTorsionFormSubmission(
      context.env.DB,
      context.env,
      {
        body,
        requestContext: {
          clientIp: readClientIp(context.req.raw),
          lang: language,
          sourcePath: new URL(context.req.url).pathname,
          userAgent: context.req.header('user-agent'),
        },
      }
    );

    return context.html(
      renderToString(
        NoTorsionStandalonePreviewPage({
          backHref: `/no-torsion/form?lang=${encodeURIComponent(language)}`,
          confirmationPayload:
            result.mode === 'confirm' ? result.confirmationPayload : undefined,
          confirmationToken:
            result.mode === 'confirm' ? result.confirmationToken : undefined,
          formAction: `/no-torsion/form/confirm?lang=${encodeURIComponent(language)}`,
          lang: language,
          mode: result.mode,
          values: result.values
        })
      )
    );
  } catch (error) {
    const response = buildNoTorsionErrorResponse(context, error);
    const message = await response.json() as {
      details?: string[];
      error?: string;
      reason?: string;
    };

    return context.html(
      renderToString(
        NoTorsionStandaloneResultPage({
          backHref: `/no-torsion/form?lang=${encodeURIComponent(language)}`,
          lang: language,
          result: buildStandaloneFailureResult(
            [
              message.error,
              ...(Array.isArray(message.details) ? message.details : []),
              message.reason
            ]
              .filter(Boolean)
              .join(' / ')
          ),
          statusCode: response.status
        })
      ),
      { status: response.status as 400 | 500 }
    );
  }
});

app.post('/no-torsion/form/confirm', async (context) => {
  const body = await parseFormBody(context.req.raw);
  const language = resolveNoTorsionLanguage(
    typeof body.lang === 'string' ? body.lang : context.req.query('lang')
  );

  try {
    const result = await confirmNoTorsionFormSubmission(
      context.env.DB,
      context.env,
      {
        confirmationPayload:
          typeof body.confirmation_payload === 'string'
            ? body.confirmation_payload
            : '',
        confirmationToken:
          typeof body.confirmation_token === 'string'
            ? body.confirmation_token
            : '',
      }
    );
    const statusCode: 200 | 500 =
      result.successfulTargets.length > 0 ? 200 : 500;

    return context.html(
      renderToString(
        NoTorsionStandaloneResultPage({
          backHref: `/no-torsion/form?lang=${encodeURIComponent(language)}`,
          lang: language,
          result,
          statusCode
        })
      ),
      statusCode
    );
  } catch (error) {
    const response = buildNoTorsionErrorResponse(context, error);
    const message = await response.json() as {
      details?: string[];
      error?: string;
      reason?: string;
    };

    return context.html(
      renderToString(
        NoTorsionStandaloneResultPage({
          backHref: `/no-torsion/form?lang=${encodeURIComponent(language)}`,
          lang: language,
          result: buildStandaloneFailureResult(
            [
              message.error,
              ...(Array.isArray(message.details) ? message.details : []),
              message.reason
            ]
              .filter(Boolean)
              .join(' / ')
          ),
          statusCode: response.status
        })
      ),
      { status: response.status as 400 | 500 }
    );
  }
});

app.get('/api/health', async (context) => {
  const [counts, currentDatabackVersion] = await Promise.all([
    getTableCounts(context.env.DB),
    getDatabackVersion(context.env.DB)
  ]);

  return context.json({
    status: 'ok',
    app: context.env.APP_NAME ?? 'NCT API SQL Sub',
    databackVersion: currentDatabackVersion,
    tables: counts,
    checkedAt: new Date().toISOString()
  });
});

app.get('/api/no-torsion/frontend-runtime', async (context) => {
  const authError = assertToken(
    context,
    context.env.NO_TORSION_SERVICE_TOKEN,
    'No-Torsion service'
  );
  if (authError) {
    return authError;
  }

  const scope = (context.req.query('scope') ?? 'form').trim();
  if (scope !== 'form' && scope !== 'correction') {
    return context.json(
      {
        error: 'Unsupported frontend runtime scope.'
      },
      400
    );
  }

  return context.json({
    formProtectionToken: await issueFormProtectionToken(context.env),
    scope
  });
});

app.post('/api/no-torsion/form/prepare', async (context) => {
  const authError = assertToken(
    context,
    context.env.NO_TORSION_SERVICE_TOKEN,
    'No-Torsion service'
  );
  if (authError) {
    return authError;
  }

  try {
    const input = parseNoTorsionBody(await context.req.json());
    const result = await prepareNoTorsionFormSubmission(
      context.env.DB,
      context.env,
      input
    );

    return context.json(result);
  } catch (error) {
    return buildNoTorsionErrorResponse(context, error);
  }
});

app.post('/api/no-torsion/form/confirm', async (context) => {
  const authError = assertToken(
    context,
    context.env.NO_TORSION_SERVICE_TOKEN,
    'No-Torsion service'
  );
  if (authError) {
    return authError;
  }

  try {
    const body = await context.req.json() as {
      confirmationPayload?: unknown;
      confirmationToken?: unknown;
    };
    const result = await confirmNoTorsionFormSubmission(
      context.env.DB,
      context.env,
      {
        confirmationPayload:
          typeof body.confirmationPayload === 'string'
            ? body.confirmationPayload
            : '',
        confirmationToken:
          typeof body.confirmationToken === 'string'
            ? body.confirmationToken
            : ''
      }
    );

    return context.json(
      result,
      result.successfulTargets.length > 0 ? 200 : 500
    );
  } catch (error) {
    return buildNoTorsionErrorResponse(context, error);
  }
});

app.post('/api/no-torsion/correction/submit', async (context) => {
  const authError = assertToken(
    context,
    context.env.NO_TORSION_SERVICE_TOKEN,
    'No-Torsion service'
  );
  if (authError) {
    return authError;
  }

  try {
    const input = parseNoTorsionBody(await context.req.json());
    const result = await submitNoTorsionCorrection(
      context.env.DB,
      context.env,
      input
    );

    return context.json(
      result,
      result.successfulTargets.length > 0 ? 200 : 500
    );
  } catch (error) {
    return buildNoTorsionErrorResponse(context, error);
  }
});

app.post('/api/no-torsion/translate-text', async (context) => {
  const authError = assertToken(
    context,
    context.env.NO_TORSION_SERVICE_TOKEN,
    'No-Torsion service'
  );
  if (authError) {
    return authError;
  }

  try {
    const body = await context.req.json() as {
      items?: unknown;
      targetLanguage?: unknown;
    };
    const items = Array.isArray(body.items)
      ? body.items
          .map((item) => ({
            fieldKey:
              item && typeof item === 'object' && typeof (item as { fieldKey?: unknown }).fieldKey === 'string'
                ? (item as { fieldKey: string }).fieldKey
                : '',
            text:
              item && typeof item === 'object' && typeof (item as { text?: unknown }).text === 'string'
                ? (item as { text: string }).text.trim()
                : ''
          }))
          .filter((item) => item.fieldKey && item.text)
          .slice(0, 6)
      : [];

    if (items.length === 0) {
      return context.json({
        translations: []
      });
    }

    const translations = await translateDetailItems(context.env, {
      items,
      targetLanguage:
        typeof body.targetLanguage === 'string'
          ? body.targetLanguage
          : undefined
    });

    return context.json({
      translations
    });
  } catch (error) {
    return context.json(
      {
        error: error instanceof Error ? error.message : 'Translation unavailable.'
      },
      500
    );
  }
});

app.post('/api/write', async (context) => {
  const authError = assertToken(context, context.env.WRITE_TOKEN, 'Write');
  if (authError) {
    return authError;
  }

  const body = await context.req.json();
  const parsed = writeSchema.safeParse(body);
  if (!parsed.success) {
    return context.json(
      {
        error: 'Invalid write payload.',
        details: parsed.error.flatten()
      },
      400
    );
  }

  const storedRecord = await writeRecord(
    context.env.DB,
    parsed.data.table,
    {
      recordKey: parsed.data.recordKey,
      payload: parsed.data.payload
    }
  );

  let mirroredRecord = null;
  if (
    parsed.data.table === 'nct_form' &&
    parsed.data.mirrorToDataback !== false
  ) {
    mirroredRecord = await writeRecord(
      context.env.DB,
      'nct_databack',
      {
        recordKey: storedRecord.recordKey,
        payload: storedRecord.payload
      }
    );
  }

  return context.json({
    message: 'Record written successfully.',
    table: parsed.data.table,
    record: storedRecord,
    mirroredRecord
  });
});

app.post('/api/push/secure-records', async (context) => {
  const authError = assertToken(context, context.env.MOTHER_PUSH_TOKEN, 'Mother push');
  if (authError) {
    return authError;
  }

  let body: unknown;
  try {
    body = await readMultipartJsonPayload(context.req.raw);
  } catch (error) {
    return context.json(
      {
        error: 'Invalid mother push payload.',
        details: error instanceof Error ? error.message : 'Unreadable request body.'
      },
      400
    );
  }

  const parsed = motherPushSchema.safeParse(body);
  if (!parsed.success) {
    return context.json(
      {
        error: 'Invalid mother push payload.',
        details: parsed.error.flatten()
      },
      400
    );
  }

  if (!RECOGNIZED_MOTHER_SERVICES.has(parsed.data.service.trim())) {
    return context.json(
      {
        error: 'Only nct-api-sql push payloads are accepted.'
      },
      403
    );
  }

  const result = await importMotherPushRecords(
    context.env.DB,
    parsed.data.records
  );

  return context.json(
    {
      accepted: true,
      source: parsed.data.service,
      mode: parsed.data.mode,
      previousVersion: parsed.data.previousVersion,
      currentVersion: parsed.data.currentVersion,
      generatedAt: parsed.data.generatedAt,
      ...result
    },
    202
  );
});

app.get('/api/export/nct_databack', async (context) => {
  const authError = assertToken(context, context.env.MOTHER_PUSH_TOKEN, 'Mother export');
  if (authError) {
    return authError;
  }

  const afterVersion = Math.max(0, Number(context.req.query('afterVersion') ?? '0'));
  const limit = Math.max(1, Math.min(Number(context.req.query('limit') ?? '100'), 500));
  const payload = await exportDatabackFile(context.env.DB, context.env, {
    afterVersion,
    limit,
    serviceUrl: context.env.SERVICE_PUBLIC_URL ?? new URL(context.req.url).origin
  });
  const timestamp = payload.exportedAt.replaceAll(/[:.]/g, '-');

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="nct-databack-${timestamp}.json"`,
      'cache-control': 'no-store'
    }
  });
});

app.get('/api/data/:table', async (context) => {
  const authError = assertToken(context, context.env.READ_TOKEN, 'Read');
  if (authError) {
    return authError;
  }

  const parsed = tableSchema.safeParse(context.req.param('table'));
  if (!parsed.success) {
    return context.json(
      {
        error: 'Unsupported table name.'
      },
      400
    );
  }

  const tableName = parsed.data as DynamicTableName;
  const limit = Number(context.req.query('limit') ?? '50');
  const recordKey = context.req.query('recordKey') ?? undefined;
  const records = await listRecords(context.env.DB, tableName, {
    limit,
    recordKey
  });

  return context.json({
    table: tableName,
    count: records.length,
    databackVersion:
      tableName === 'nct_databack'
        ? await getDatabackVersion(context.env.DB)
        : undefined,
    records
  });
});

app.get('/api/data/nct_databack/version', async (context) => {
  const authError = assertToken(context, context.env.READ_TOKEN, 'Read');
  if (authError) {
    return authError;
  }

  return context.json({
    version: await getDatabackVersion(context.env.DB)
  });
});

app.post('/api/report-now', async (context) => {
  const authError = assertToken(context, context.env.WRITE_TOKEN, 'Write');
  if (authError) {
    return authError;
  }

  const result = await reportToMother(context.env, {
    fallbackOrigin: new URL(context.req.url).origin
  });

  const status: 200 | 429 | 502 = result.skipped || result.delivered
    ? 200
    : result.responseCode === 429
      ? 429
      : 502;

  return context.json(result, status);
});

app.notFound((context) => {
  return context.json(
    {
      error: 'Not found.'
    },
    404
  );
});

export default {
  fetch(request: Request, env: Env, executionCtx: ExecutionContext) {
    maybeReportOnFirstExecution(env, executionCtx, new URL(request.url).origin);
    return app.fetch(request, env, executionCtx);
  },
  scheduled(
    _controller: ScheduledController,
    env: Env,
    executionCtx: ExecutionContext
  ) {
    executionCtx.waitUntil(reportToMother(env));
  }
};
