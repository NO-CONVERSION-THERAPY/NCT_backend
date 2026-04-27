import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { renderToString } from 'hono/jsx/dom/server';
import type { MotherPushRecord } from './types';
import {
  exportDatabackFile,
  getDatabackVersion,
  getTableCounts,
  importMotherPushRecords,
} from './lib/data';
import {
  confirmNoTorsionFormSubmission,
  issueFormProtectionToken,
  prepareNoTorsionFormSubmission,
  submitNoTorsionCorrection,
  type NoTorsionConfirmResult
} from './lib/no-torsion-form';
import { translateDetailItems } from './lib/no-torsion-translation';
import { parseJsonObject, stableStringify, toJsonObject } from './lib/json';
import {
  flushPendingMotherMediaRecords,
  flushPendingMotherFormRecords,
  maybeReportOnFirstExecution,
  reportToMother,
} from './lib/report';
import {
  completeMediaUpload,
  createMediaUpload,
  listMediaTags,
  uploadMediaDirect,
} from './lib/media';
import { readBearerToken, verifyServiceAuthToken } from './lib/service-auth';
import {
  NoTorsionStandaloneFormPage,
  NoTorsionStandalonePreviewPage,
  NoTorsionStandaloneResultPage,
} from './site/no-torsion-form-page';
import { MediaUploadPage } from './site/media-upload-page';

const DATABACK_EXPORT_RATE_LIMIT_RECORD_KEY = '__system__:databack_export_rate_limit';

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

function parseMotherPushBody(input: unknown): MotherPushRecord[] {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Mother push payload must be a JSON object.');
  }

  const candidate = input as {
    records?: unknown;
  };
  if (!Array.isArray(candidate.records)) {
    throw new Error('Mother push payload records are missing.');
  }

  return candidate.records.map((record) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      throw new Error('Mother push record is invalid.');
    }

    const entry = record as {
      fingerprint?: unknown;
      payload?: unknown;
      recordKey?: unknown;
      version?: unknown;
    };
    const payload = entry.payload;

    if (
      typeof entry.recordKey !== 'string'
      || typeof entry.version !== 'number'
      || typeof entry.fingerprint !== 'string'
      || !payload
      || typeof payload !== 'object'
      || Array.isArray(payload)
      || typeof (payload as { keyVersion?: unknown }).keyVersion !== 'number'
      || !(payload as { publicData?: unknown }).publicData
      || typeof (payload as { publicData?: unknown }).publicData !== 'object'
      || Array.isArray((payload as { publicData?: unknown }).publicData)
      || !(payload as { encryptedData?: unknown }).encryptedData
      || typeof (payload as { encryptedData?: unknown }).encryptedData !== 'object'
      || Array.isArray((payload as { encryptedData?: unknown }).encryptedData)
      || !Array.isArray((payload as { encryptFields?: unknown }).encryptFields)
      || (payload as { encryptFields: unknown[] }).encryptFields.some((field) => typeof field !== 'string')
      || (
        (payload as { syncedAt?: unknown }).syncedAt !== null
        && typeof (payload as { syncedAt?: unknown }).syncedAt !== 'string'
      )
    ) {
      throw new Error('Mother push record fields are invalid.');
    }

    return {
      fingerprint: entry.fingerprint,
      payload: payload as MotherPushRecord['payload'],
      recordKey: entry.recordKey,
      version: Math.max(0, Math.trunc(entry.version)),
    };
  });
}

function nowIso(): string {
  return new Date().toISOString();
}

function getDatabackExportMinIntervalMs(env: Env): number {
  return Math.max(
    0,
    Number(env.DATABACK_EXPORT_MIN_INTERVAL_MS ?? '60000'),
  );
}

function resolveLocalServiceUrl(env: Env, requestUrl: string): string {
  return env.SERVICE_PUBLIC_URL?.trim() || new URL(requestUrl).origin;
}

async function assertLocalServiceAuth(
  context: Context<{ Bindings: Env }>,
): Promise<Response | null> {
  const serviceUrl = resolveLocalServiceUrl(context.env, context.req.raw.url);
  if (
    await verifyServiceAuthToken(
      serviceUrl,
      readBearerToken(context.req.raw),
    )
  ) {
    return null;
  }

  return context.json(
    {
      error: 'Service auth token is invalid.',
    },
    401,
  );
}

function parseStoredJsonObject(value: string | null | undefined): Record<string, unknown> {
  if (!value) {
    return {};
  }

  try {
    return parseJsonObject(value);
  } catch (_error) {
    return {};
  }
}

async function writeDatabackExportRateLimitState(
  db: D1Database,
  payload: Record<string, unknown>,
): Promise<void> {
  const updatedAt = nowIso();

  await db.prepare(
    `
      INSERT INTO nct_form (
        id,
        record_key,
        payload_json,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(record_key) DO UPDATE SET
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at
    `,
  )
    .bind(
      crypto.randomUUID(),
      DATABACK_EXPORT_RATE_LIMIT_RECORD_KEY,
      stableStringify({
        ...payload,
        kind: 'databackExportRateLimit',
        updatedAt,
      }),
      updatedAt,
      updatedAt,
    )
    .run();
}

async function assertDatabackExportRateLimit(
  context: Context<{ Bindings: Env }>,
): Promise<Response | null> {
  const minIntervalMs = getDatabackExportMinIntervalMs(context.env);
  if (minIntervalMs <= 0) {
    return null;
  }

  const nowMs = Date.now();
  const checkedAt = nowIso();
  const row = await context.env.DB.prepare(
    `
      SELECT payload_json
      FROM nct_form
      WHERE record_key = ?
    `,
  )
    .bind(DATABACK_EXPORT_RATE_LIMIT_RECORD_KEY)
    .first<{ payload_json: string | null }>();
  const previous = parseStoredJsonObject(row?.payload_json);
  const lastExportAt =
    typeof previous.lastExportAt === 'string'
      ? previous.lastExportAt
      : null;
  const lastExportMs = lastExportAt ? Date.parse(lastExportAt) : NaN;

  if (Number.isFinite(lastExportMs)) {
    const elapsedMs = nowMs - lastExportMs;
    if (elapsedMs < minIntervalMs) {
      const retryAfterMs = Math.max(0, minIntervalMs - elapsedMs);
      const rejectedCount = Math.max(
        0,
        Number(previous.rejectedCount ?? 0),
      ) + 1;

      await writeDatabackExportRateLimitState(context.env.DB, {
        ...previous,
        lastRejectedAt: checkedAt,
        lastRejectReason: 'rate_limited',
        rejectedCount,
      });
      console.warn(
        `Databack export rate limited: retryAfterMs=${retryAfterMs}, rejectedCount=${rejectedCount}`,
      );

      return new Response(
        JSON.stringify({
          error: 'Databack export is rate limited.',
          lastExportAt,
          retryAfterMs,
        }),
        {
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'retry-after': String(Math.ceil(retryAfterMs / 1000)),
          },
          status: 429,
        },
      );
    }
  }

  await writeDatabackExportRateLimitState(context.env.DB, {
    ...previous,
    lastExportAt: checkedAt,
    lastRequestUrl: context.req.raw.url,
  });

  return null;
}

function buildNoTorsionErrorResponse(
  context: Context,
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

const NO_TORSION_STANDALONE_FORM_PATH = '/form';
const NO_TORSION_STANDALONE_FORM_CONFIRM_PATH = '/form/confirm';
const NO_TORSION_LEGACY_FORM_PATH = '/no-torsion/form';
const NO_TORSION_LEGACY_FORM_CONFIRM_PATH = '/no-torsion/form/confirm';

function buildStandaloneFormHref(language: 'en' | 'zh-CN' | 'zh-TW'): string {
  return `${NO_TORSION_STANDALONE_FORM_PATH}?lang=${encodeURIComponent(language)}`;
}

function buildStandaloneFormConfirmHref(language: 'en' | 'zh-CN' | 'zh-TW'): string {
  return `${NO_TORSION_STANDALONE_FORM_CONFIRM_PATH}?lang=${encodeURIComponent(language)}`;
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
    allowHeaders: [
      'content-type',
      'authorization',
      'x-api-token',
    ],
    allowMethods: ['GET', 'POST', 'OPTIONS']
  })
);

async function renderNoTorsionStandaloneFormPage(
  context: Context<{ Bindings: Env }>
) {
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
}

// Keep `/form` and the legacy `/no-torsion/form` entrypoints alive while making
// the service root useful when opened directly after startup.
app.get('/', renderNoTorsionStandaloneFormPage);
app.get(NO_TORSION_STANDALONE_FORM_PATH, renderNoTorsionStandaloneFormPage);
app.get(NO_TORSION_LEGACY_FORM_PATH, renderNoTorsionStandaloneFormPage);
app.get('/media', (context) => {
  return context.html(renderToString(MediaUploadPage({})));
});

async function handleNoTorsionStandaloneFormSubmission(
  context: Context<{ Bindings: Env }>
) {
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
          backHref: buildStandaloneFormHref(language),
          confirmationPayload:
            result.mode === 'confirm' ? result.confirmationPayload : undefined,
          confirmationToken:
            result.mode === 'confirm' ? result.confirmationToken : undefined,
          formAction: buildStandaloneFormConfirmHref(language),
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
          backHref: buildStandaloneFormHref(language),
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
}

app.post(NO_TORSION_STANDALONE_FORM_PATH, handleNoTorsionStandaloneFormSubmission);
app.post(NO_TORSION_LEGACY_FORM_PATH, handleNoTorsionStandaloneFormSubmission);

async function handleNoTorsionStandaloneFormConfirmation(
  context: Context<{ Bindings: Env }>
) {
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
    if (result.successfulTargets.includes('d1')) {
      context.executionCtx?.waitUntil(
        flushPendingMotherFormRecords(context.env, {
          fallbackOrigin: new URL(context.req.url).origin,
        })
      );
    }

    return context.html(
      renderToString(
        NoTorsionStandaloneResultPage({
          backHref: buildStandaloneFormHref(language),
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
          backHref: buildStandaloneFormHref(language),
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
}

app.post(NO_TORSION_STANDALONE_FORM_CONFIRM_PATH, handleNoTorsionStandaloneFormConfirmation);
app.post(NO_TORSION_LEGACY_FORM_CONFIRM_PATH, handleNoTorsionStandaloneFormConfirmation);

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

app.get('/api/media/tags', async (context) => {
  try {
    return context.json({
      tags: await listMediaTags(context.env.DB),
    });
  } catch (error) {
    return context.json(
      {
        error: error instanceof Error ? error.message : 'Failed to list media tags.',
      },
      500,
    );
  }
});

app.post('/api/media/uploads/presign', async (context) => {
  try {
    return context.json(await createMediaUpload(context.env, await context.req.json()));
  } catch (error) {
    return context.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create media upload.',
      },
      400,
    );
  }
});

function getFormString(
  formData: FormData,
  key: string,
): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function getFormTags(formData: FormData): string[] {
  const value = getFormString(formData, 'tags');
  if (!value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean);
    }
  } catch {
    // Fall back to comma-separated tags for non-JSON clients.
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isFormFile(value: unknown): value is File {
  return typeof value === 'object'
    && value !== null
    && typeof (value as { arrayBuffer?: unknown }).arrayBuffer === 'function'
    && typeof (value as { name?: unknown }).name === 'string'
    && typeof (value as { size?: unknown }).size === 'number'
    && typeof (value as { type?: unknown }).type === 'string';
}

app.post('/api/media/uploads/direct', async (context) => {
  try {
    const formData = await context.req.raw.formData();
    const file = formData.get('file');
    if (!isFormFile(file)) {
      throw new Error('Media file is required.');
    }

    const media = await uploadMediaDirect(context.env, {
      city: getFormString(formData, 'city'),
      county: getFormString(formData, 'county'),
      file,
      province: getFormString(formData, 'province'),
      schoolAddress: getFormString(formData, 'schoolAddress'),
      schoolName: getFormString(formData, 'schoolName'),
      tags: getFormTags(formData),
    });
    context.executionCtx?.waitUntil(
      flushPendingMotherMediaRecords(context.env, {
        fallbackOrigin: new URL(context.req.url).origin,
      }),
    );

    return context.json({
      media,
    });
  } catch (error) {
    return context.json(
      {
        error: error instanceof Error ? error.message : 'Failed to upload media.',
      },
      400,
    );
  }
});

app.post('/api/media/uploads/complete', async (context) => {
  try {
    const media = await completeMediaUpload(context.env, await context.req.json());
    context.executionCtx?.waitUntil(
      flushPendingMotherMediaRecords(context.env, {
        fallbackOrigin: new URL(context.req.url).origin,
      }),
    );

    return context.json({
      media,
    });
  } catch (error) {
    return context.json(
      {
        error: error instanceof Error ? error.message : 'Failed to complete media upload.',
      },
      400,
    );
  }
});

app.post('/api/no-torsion/form/prepare', async (context) => {
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
    if (result.successfulTargets.includes('d1')) {
      context.executionCtx?.waitUntil(
        flushPendingMotherFormRecords(context.env, {
          fallbackOrigin: new URL(context.req.url).origin,
        })
      );
    }

    return context.json(
      result,
      result.successfulTargets.length > 0 ? 200 : 500
    );
  } catch (error) {
    return buildNoTorsionErrorResponse(context, error);
  }
});

app.post('/api/no-torsion/correction/submit', async (context) => {
  try {
    const input = parseNoTorsionBody(await context.req.json());
    const result = await submitNoTorsionCorrection(
      context.env.DB,
      context.env,
      input
    );
    if (result.successfulTargets.includes('d1')) {
      context.executionCtx?.waitUntil(
        flushPendingMotherFormRecords(context.env, {
          fallbackOrigin: new URL(context.req.url).origin,
        })
      );
    }

    return context.json(
      result,
      result.successfulTargets.length > 0 ? 200 : 500
    );
  } catch (error) {
    return buildNoTorsionErrorResponse(context, error);
  }
});

app.post('/api/no-torsion/translate-text', async (context) => {
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

app.post('/api/push/secure-records', async (context) => {
  const authError = await assertLocalServiceAuth(context);
  if (authError) {
    return authError;
  }

  try {
    const records = parseMotherPushBody(await context.req.json());
    const result = await importMotherPushRecords(context.env.DB, records);

    return context.json({
      importedCount: result.receivedCount,
      skippedCount: result.skippedCount,
      synced: true,
      updatedCount: result.updatedCount,
    });
  } catch (error) {
    return context.json(
      {
        error: error instanceof Error ? error.message : 'Invalid mother push payload.',
      },
      400
    );
  }
});

app.get('/api/export/nct_databack', async (context) => {
  const authError = await assertLocalServiceAuth(context);
  if (authError) {
    return authError;
  }

  const rateLimitError = await assertDatabackExportRateLimit(context);
  if (rateLimitError) {
    return rateLimitError;
  }

  const afterVersion = Math.max(0, Number(context.req.query('afterVersion') ?? '0'));
  const limit = Math.max(1, Math.min(Number(context.req.query('limit') ?? '100'), 500));
  const payload = await exportDatabackFile(context.env.DB, context.env, {
    afterVersion,
    limit,
    serviceUrl: resolveLocalServiceUrl(context.env, context.req.url)
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
    // Report once on the first live request so fresh deployments can register before the next cron tick.
    maybeReportOnFirstExecution(env, executionCtx, new URL(request.url).origin);
    return app.fetch(request, env, executionCtx);
  },
  scheduled(
    controller: ScheduledController,
    env: Env,
    executionCtx: ExecutionContext
  ) {
    executionCtx.waitUntil(
      (async () => {
        if (controller.cron === '*/30 * * * *') {
          await reportToMother(env);
        }
        await flushPendingMotherMediaRecords(env);
        await flushPendingMotherFormRecords(env);
      })()
    );
  }
};
