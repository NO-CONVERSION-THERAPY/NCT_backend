import type {
  MotherMediaObjectSyncResult,
  MotherMediaSyncRecord,
  MotherMediaSyncResult,
  MotherReportPayload,
  MotherReportResult,
} from '../types';
import {
  bumpServiceReportCount,
  getNullableDatabackVersion,
  listPendingMotherFormSyncRecords,
  markMotherFormSyncFailure,
  markMotherFormSyncSuccess,
} from './data';
import {
  getMediaSubmitTarget,
  getSchoolMediaStats,
  listPendingMotherMediaObjectSyncRecords,
  listPendingMotherMediaSyncRecords,
  markMotherMediaObjectSyncFailure,
  markMotherMediaObjectSyncSuccess,
  markMotherMediaSyncFailure,
  markMotherMediaSyncSuccess,
  mediaTargetIncludesR2,
} from './media';
import { deriveServiceAuthToken } from './service-auth';
import { normalizeConfiguredBaseUrl, resolveConfiguredBaseUrl } from './url';

// A warm Worker isolate may serve many requests, so keep the startup report idempotent per isolate.
let startupReportTriggered = false;
const NCT_SUB_SERVICE_WATERMARK = 'nct-api-sql-sub:v1';

function nowIso(): string {
  return new Date().toISOString();
}

function resolveServiceUrl(
  env: Env,
  fallbackOrigin?: string
): string | null {
  return resolveConfiguredBaseUrl(env.SERVICE_PUBLIC_URL, fallbackOrigin);
}

function resolveMotherUrl(
  env: Env,
  path: '/api/sub/report' | '/api/sub/form-records',
): string | null {
  const motherBaseUrl = env.MOTHER_REPORT_URL?.trim();
  const normalizedMotherBaseUrl = normalizeConfiguredBaseUrl(motherBaseUrl);
  if (!normalizedMotherBaseUrl) {
    return null;
  }

  return new URL(path, normalizedMotherBaseUrl).toString();
}

function resolveMotherReportUrl(env: Env): string | null {
  return resolveMotherUrl(env, '/api/sub/report');
}

function resolveMotherFormSyncUrl(env: Env): string | null {
  return resolveMotherUrl(env, '/api/sub/form-records');
}

function resolveMotherMediaSyncUrl(env: Env): string | null {
  const motherReportUrl = normalizeConfiguredBaseUrl(env.MOTHER_REPORT_URL);
  if (!motherReportUrl) {
    return null;
  }

  return new URL('/api/sub/media-records', motherReportUrl).toString();
}

function resolveMotherMediaObjectSyncUrl(env: Env): string | null {
  const motherReportUrl = normalizeConfiguredBaseUrl(env.MOTHER_REPORT_URL);
  if (!motherReportUrl) {
    return null;
  }

  return new URL('/api/sub/media-objects', motherReportUrl).toString();
}

function normalizeMediaPublicUrl(publicUrl: string, baseUrl: string | null): string {
  const trimmed = publicUrl.trim();
  if (!trimmed) return publicUrl;

  const normalized = normalizeConfiguredBaseUrl(trimmed);
  if (normalized) return normalized;

  if (!baseUrl) return publicUrl;

  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return publicUrl;
  }
}

function normalizeMediaSyncRecords(
  records: MotherMediaSyncRecord[],
  env: Env,
  fallbackOrigin?: string,
): MotherMediaSyncRecord[] {
  const publicBaseUrl = resolveConfiguredBaseUrl(
    env.SERVICE_PUBLIC_URL,
    env.NO_TORSION_SITE_URL,
    fallbackOrigin,
  );

  return records.map((record) => ({
    ...record,
    publicUrl: normalizeMediaPublicUrl(record.publicUrl, publicBaseUrl),
  }));
}

function getReportTimeoutMs(env: Env): number {
  return Math.max(
    1000,
    Number(env.MOTHER_REPORT_TIMEOUT_MS ?? '10000')
  );
}

function getFormSyncBatchSize(env: Env): number {
  return Math.max(
    1,
    Math.min(Number(env.MOTHER_FORM_SYNC_BATCH_SIZE ?? '20'), 200)
  );
}

function getFormSyncTimeoutMs(env: Env): number {
  return Math.max(
    1000,
    Number(env.MOTHER_FORM_SYNC_TIMEOUT_MS ?? env.MOTHER_REPORT_TIMEOUT_MS ?? '10000')
  );
}

function readAcceptedPayload<T>(
  responseText: string
): T | null {
  const trimmed = responseText.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = JSON.parse(trimmed);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }

  return parsed as T;
}

export async function reportToMother(
  env: Env,
  options: {
    allowRetry?: boolean;
    fallbackOrigin?: string;
    payloadOverride?: MotherReportPayload;
  } = {}
): Promise<MotherReportResult> {
  const motherReportUrl = resolveMotherReportUrl(env);
  if (!motherReportUrl) {
    return {
      delivered: false,
      skipped: true,
      reason: 'MOTHER_REPORT_URL is not configured.'
    };
  }

  const serviceUrl = resolveServiceUrl(env, options.fallbackOrigin);
  if (!serviceUrl) {
    return {
      delivered: false,
      skipped: true,
      reason: 'SERVICE_PUBLIC_URL is not configured and no request origin is available.'
    };
  }

  const payload = options.payloadOverride ?? {
    service: env.APP_NAME ?? 'NCT API SQL Sub',
    serviceWatermark: NCT_SUB_SERVICE_WATERMARK,
    serviceUrl,
    databackVersion: await getNullableDatabackVersion(env.DB),
    mediaStats: await getSchoolMediaStats(env.DB),
    reportCount: await bumpServiceReportCount(env.DB),
    reportedAt: nowIso(),
  };
  const authToken = await deriveServiceAuthToken(serviceUrl);
  const body = JSON.stringify(payload);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getReportTimeoutMs(env));

  try {
    const response = await fetch(motherReportUrl, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${authToken}`,
        'content-type': 'application/json',
      },
      body,
      signal: controller.signal
    });

    const responseText = await response.text();

    return {
      delivered: response.ok,
      skipped: false,
      payload,
      responseCode: response.status,
      reason: response.ok
        ? undefined
        : responseText
    };
  } catch (error) {
    return {
      delivered: false,
      skipped: false,
      payload,
      responseCode: null,
      reason: error instanceof Error ? error.message : 'Unknown report error'
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function flushPendingMotherMediaRecords(
  env: Env,
  options: {
    fallbackOrigin?: string;
  } = {},
): Promise<{
  deliveredCount: number;
  pendingCount: number;
  reason?: string;
  responseCode?: number | null;
  skipped: boolean;
}> {
  const motherMediaSyncUrl = resolveMotherMediaSyncUrl(env);
  if (!motherMediaSyncUrl) {
    return {
      deliveredCount: 0,
      pendingCount: 0,
      reason: 'MOTHER_REPORT_URL is not configured.',
      skipped: true,
    };
  }

  const serviceUrl = resolveServiceUrl(env, options.fallbackOrigin);
  if (!serviceUrl) {
    return {
      deliveredCount: 0,
      pendingCount: 0,
      reason: 'SERVICE_PUBLIC_URL is not configured and no request origin is available.',
      skipped: true,
    };
  }

  const pendingRecords = normalizeMediaSyncRecords(
    await listPendingMotherMediaSyncRecords(
      env.DB,
      getFormSyncBatchSize(env),
    ),
    env,
    options.fallbackOrigin,
  );
  if (pendingRecords.length === 0) {
    return {
      deliveredCount: 0,
      pendingCount: 0,
      skipped: true,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getFormSyncTimeoutMs(env));

  try {
    const response = await fetch(motherMediaSyncUrl, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${await deriveServiceAuthToken(serviceUrl)}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        serviceUrl,
        records: pendingRecords,
      }),
      signal: controller.signal,
    });

    const responseText = await response.text();
    if (!response.ok) {
      const reason = responseText || `Mother media sync failed with status ${response.status}.`;
      for (const record of pendingRecords) {
        await markMotherMediaSyncFailure(env.DB, record.id, reason);
      }

      return {
        deliveredCount: 0,
        pendingCount: pendingRecords.length,
        reason,
        responseCode: response.status,
        skipped: false,
      };
    }

    const acceptedPayload = await readAcceptedPayload<{
      accepted?: unknown;
      results?: unknown;
    }>(responseText);
    const parsedResults = (Array.isArray(acceptedPayload?.results)
      ? acceptedPayload.results
      : [])
      .filter((item): item is MotherMediaSyncResult => (
        !!item
        && typeof item === 'object'
        && typeof (item as { mediaId?: unknown }).mediaId === 'string'
        && typeof (item as { updated?: unknown }).updated === 'boolean'
      ));
    const resultMap = new Map(parsedResults.map((item) => [item.mediaId, item]));

    let deliveredCount = 0;
    for (const record of pendingRecords) {
      const result = resultMap.get(record.id);
      if (result) {
        await markMotherMediaSyncSuccess(env.DB, result);
        deliveredCount += 1;
      } else {
        await markMotherMediaSyncFailure(
          env.DB,
          record.id,
          'Mother media sync response did not include this media record.',
        );
      }
    }

    return {
      deliveredCount,
      pendingCount: Math.max(0, pendingRecords.length - deliveredCount),
      responseCode: response.status,
      skipped: false,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown media sync error';
    for (const record of pendingRecords) {
      await markMotherMediaSyncFailure(env.DB, record.id, reason);
    }

    return {
      deliveredCount: 0,
      pendingCount: pendingRecords.length,
      reason,
      responseCode: null,
      skipped: false,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function flushPendingMotherMediaObjects(
  env: Env,
  options: {
    fallbackOrigin?: string;
  } = {},
): Promise<{
  deliveredCount: number;
  pendingCount: number;
  reason?: string;
  responseCode?: number | null;
  skipped: boolean;
}> {
  if (!mediaTargetIncludesR2(getMediaSubmitTarget(env))) {
    return {
      deliveredCount: 0,
      pendingCount: 0,
      reason: 'R2 media target is not enabled.',
      skipped: true,
    };
  }
  if (!env.MEDIA_BUCKET) {
    return {
      deliveredCount: 0,
      pendingCount: 0,
      reason: 'MEDIA_BUCKET is not configured.',
      skipped: true,
    };
  }

  const motherMediaObjectSyncUrl = resolveMotherMediaObjectSyncUrl(env);
  if (!motherMediaObjectSyncUrl) {
    return {
      deliveredCount: 0,
      pendingCount: 0,
      reason: 'MOTHER_REPORT_URL is not configured.',
      skipped: true,
    };
  }

  const serviceUrl = resolveServiceUrl(env, options.fallbackOrigin);
  if (!serviceUrl) {
    return {
      deliveredCount: 0,
      pendingCount: 0,
      reason: 'SERVICE_PUBLIC_URL is not configured and no request origin is available.',
      skipped: true,
    };
  }

  const pendingRecords = await listPendingMotherMediaObjectSyncRecords(
    env.DB,
    getFormSyncBatchSize(env),
  );
  if (pendingRecords.length === 0) {
    return {
      deliveredCount: 0,
      pendingCount: 0,
      skipped: true,
    };
  }

  let deliveredCount = 0;
  let lastResponseCode: number | null = null;
  let lastReason: string | undefined;
  const authToken = await deriveServiceAuthToken(serviceUrl);

  for (const record of pendingRecords) {
    const object = await env.MEDIA_BUCKET.get(record.objectKey);
    if (!object) {
      const reason = 'Local R2 media object was not found.';
      await markMotherMediaObjectSyncFailure(env.DB, record.id, reason);
      lastReason = reason;
      continue;
    }

    const targetUrl = new URL(motherMediaObjectSyncUrl);
    targetUrl.searchParams.set('serviceUrl', serviceUrl);
    targetUrl.searchParams.set('mediaId', record.id);
    targetUrl.searchParams.set('objectKey', record.objectKey);
    targetUrl.searchParams.set('byteSize', String(record.byteSize));
    targetUrl.searchParams.set('contentType', record.contentType);

    const headers = new Headers({
      authorization: `Bearer ${authToken}`,
    });
    object.writeHttpMetadata(headers);
    headers.set('content-type', headers.get('content-type') || record.contentType);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), getFormSyncTimeoutMs(env));
    try {
      const response = await fetch(targetUrl.toString(), {
        method: 'POST',
        headers,
        body: object.body,
        signal: controller.signal,
      });
      lastResponseCode = response.status;
      const responseText = await response.text();
      const acceptedPayload = await readAcceptedPayload<MotherMediaObjectSyncResult & {
        reason?: unknown;
      }>(responseText);
      if (response.ok && acceptedPayload?.stored === true) {
        await markMotherMediaObjectSyncSuccess(env.DB, {
          localObjectKey: acceptedPayload.localObjectKey,
          mediaId: record.id,
          publicUrl: acceptedPayload.publicUrl,
          stored: true,
        });
        deliveredCount += 1;
      } else {
        const reason = typeof acceptedPayload?.reason === 'string'
          ? acceptedPayload.reason
          : responseText || `Mother media object sync failed with status ${response.status}.`;
        await markMotherMediaObjectSyncFailure(env.DB, record.id, reason);
        lastReason = reason;
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown media object sync error';
      await markMotherMediaObjectSyncFailure(env.DB, record.id, reason);
      lastReason = reason;
      lastResponseCode = null;
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    deliveredCount,
    pendingCount: pendingRecords.length - deliveredCount,
    reason: lastReason,
    responseCode: lastResponseCode,
    skipped: false,
  };
}

export async function syncFromMother(_env: Env): Promise<{
  reason?: string;
  skipped: boolean;
  synced: boolean;
}> {
  return {
    reason: 'Deprecated. Mother now pushes secure records to registered sub services.',
    skipped: true,
    synced: false,
  };
}

export async function flushPendingMotherFormRecords(
  env: Env,
  options: {
    allowRetry?: boolean;
    fallbackOrigin?: string;
  } = {}
): Promise<{
  deliveredCount: number;
  pendingCount: number;
  reason?: string;
  responseCode?: number | null;
  skipped: boolean;
}> {
  const motherFormSyncUrl = resolveMotherFormSyncUrl(env);
  if (!motherFormSyncUrl) {
    return {
      deliveredCount: 0,
      pendingCount: 0,
      reason: 'MOTHER_REPORT_URL is not configured.',
      skipped: true,
    };
  }

  const serviceUrl = resolveServiceUrl(env, options.fallbackOrigin);
  if (!serviceUrl) {
    return {
      deliveredCount: 0,
      pendingCount: 0,
      reason: 'SERVICE_PUBLIC_URL is not configured and no request origin is available.',
      skipped: true,
    };
  }

  const pendingRecords = await listPendingMotherFormSyncRecords(
    env.DB,
    getFormSyncBatchSize(env),
  );
  if (pendingRecords.length === 0) {
    return {
      deliveredCount: 0,
      pendingCount: 0,
      skipped: true,
    };
  }

  const authToken = await deriveServiceAuthToken(serviceUrl);
  const body = JSON.stringify({
    serviceUrl,
    records: pendingRecords,
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getFormSyncTimeoutMs(env));

  try {
    const response = await fetch(motherFormSyncUrl, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${authToken}`,
        'content-type': 'application/json',
      },
      body,
      signal: controller.signal,
    });

    const responseText = await response.text();
    if (!response.ok) {
      const reason = responseText || `Mother form sync failed with status ${response.status}.`;
      for (const record of pendingRecords) {
        await markMotherFormSyncFailure(env.DB, record.recordKey, reason);
      }

      return {
        deliveredCount: 0,
        pendingCount: pendingRecords.length,
        reason,
        responseCode: response.status,
        skipped: false,
      };
    }

    const acceptedPayload = await readAcceptedPayload<{
      accepted?: unknown;
      results?: unknown;
    }>(responseText);

    const resultItems = Array.isArray(acceptedPayload?.results)
      ? acceptedPayload.results
      : [];
    const parsedResults = resultItems
      .filter((item): item is {
        databackFingerprint: string;
        motherVersion: number;
        recordKey: string;
        updated: boolean;
      } => (
        !!item
        && typeof item === 'object'
        && typeof (item as { databackFingerprint?: unknown }).databackFingerprint === 'string'
        && typeof (item as { motherVersion?: unknown }).motherVersion === 'number'
        && typeof (item as { recordKey?: unknown }).recordKey === 'string'
        && typeof (item as { updated?: unknown }).updated === 'boolean'
      ))
      .map((item) => ({
        databackFingerprint: item.databackFingerprint,
        motherVersion: item.motherVersion,
        recordKey: item.recordKey,
        updated: item.updated,
      }));
    const resultMap = new Map(
      parsedResults.map((item) => [item.recordKey, item])
    );

    let deliveredCount = 0;
    for (const record of pendingRecords) {
      const result = resultMap.get(record.recordKey);
      if (result) {
        await markMotherFormSyncSuccess(env.DB, result);
        deliveredCount += 1;
      } else {
        await markMotherFormSyncFailure(
          env.DB,
          record.recordKey,
          'Mother form sync response did not include this record.',
        );
      }
    }

    return {
      deliveredCount,
      pendingCount: Math.max(0, pendingRecords.length - deliveredCount),
      responseCode: response.status,
      skipped: false,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown form sync error';
    for (const record of pendingRecords) {
      await markMotherFormSyncFailure(env.DB, record.recordKey, reason);
    }

    return {
      deliveredCount: 0,
      pendingCount: pendingRecords.length,
      reason,
      responseCode: null,
      skipped: false,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function maybeReportOnFirstExecution(
  env: Env,
  executionCtx: ExecutionContext,
  fallbackOrigin?: string
) {
  if (startupReportTriggered) {
    return;
  }

  startupReportTriggered = true;
  executionCtx.waitUntil(
    reportToMother(env, {
      fallbackOrigin
    })
  );
}
