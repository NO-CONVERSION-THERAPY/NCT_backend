import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import {
  exportDatabackFile,
  getDatabackVersion,
  getTableCounts,
  importMotherPushRecords,
  listRecords,
  writeRecord
} from './lib/data';
import { toJsonObject } from './lib/json';
import { maybeReportOnFirstExecution, reportToMother } from './lib/report';
import { assertToken } from './lib/security';
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

const app = new Hono<{ Bindings: Env }>();

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
      exportDataback: '/api/export/nct_databack',
      readForm: '/api/data/nct_form',
      readDataback: '/api/data/nct_databack',
      reportNow: '/api/report-now'
    }
  });
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
