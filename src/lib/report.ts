import type {
  MotherBootstrapAcceptedPayload,
  MotherReportAcceptedPayload,
  MotherReportPayload,
  MotherReportResult,
} from '../types';
import {
  bumpServiceReportCount,
  clearMotherAuthToken,
  getMotherAuthToken,
  getMotherServicePublicKey,
  getOrCreateLocalServiceEncryptionKeyPair,
  getNullableDatabackVersion,
  listPendingMotherFormSyncRecords,
  markMotherFormSyncFailure,
  markMotherFormSyncSuccess,
  writeMotherAuthToken,
  writeMotherServiceEncryptionPublicKey,
  writeMotherServicePublicKey,
} from './data';
import { decryptJsonWithPrivateKey } from './crypto';
import { unwrapSignedPayloadEnvelope } from './security';

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
  const configured = env.SERVICE_PUBLIC_URL?.trim();
  if (configured) {
    return configured;
  }

  return fallbackOrigin?.trim() || null;
}

function resolveMotherBootstrapUrl(env: Env): string | null {
  const configured = env.MOTHER_BOOTSTRAP_URL?.trim();
  if (configured) {
    return configured;
  }

  const motherReportUrl = env.MOTHER_REPORT_URL?.trim();
  if (!motherReportUrl) {
    return null;
  }

  return new URL('/api/sub/bootstrap', motherReportUrl).toString();
}

function resolveMotherFormSyncUrl(env: Env): string | null {
  const motherReportUrl = env.MOTHER_REPORT_URL?.trim();
  if (!motherReportUrl) {
    return null;
  }

  return new URL('/api/sub/form-records', motherReportUrl).toString();
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

async function readAcceptedPayload<T>(
  env: Env,
  db: D1Database,
  responseText: string
): Promise<T | null> {
  const trimmed = responseText.trim();
  if (!trimmed) {
    return null;
  }

  const unwrapped = await unwrapSignedPayloadEnvelope(
    env,
    JSON.parse(trimmed),
    {
      publicKey: await getMotherServicePublicKey(db),
    }
  );
  if (!unwrapped || typeof unwrapped !== 'object' || Array.isArray(unwrapped)) {
    return null;
  }

  return unwrapped as T;
}

async function cacheMotherKeys(
  env: Env,
  payload: {
    motherServiceEncryptionPublicKey?: string | null;
    motherServicePublicKey?: string | null;
  } | null
): Promise<void> {
  if (!payload) {
    return;
  }

  if (typeof payload.motherServicePublicKey === 'string' && payload.motherServicePublicKey.trim()) {
    await writeMotherServicePublicKey(env.DB, payload.motherServicePublicKey);
  }
  if (
    typeof payload.motherServiceEncryptionPublicKey === 'string'
    && payload.motherServiceEncryptionPublicKey.trim()
  ) {
    await writeMotherServiceEncryptionPublicKey(
      env.DB,
      payload.motherServiceEncryptionPublicKey
    );
  }
}

async function bootstrapWithMother(
  env: Env,
  options: {
    fallbackOrigin?: string;
  } = {}
): Promise<{
  motherServiceEncryptionPublicKey?: string | null;
  motherServicePublicKey?: string | null;
  reason?: string;
  responseCode?: number | null;
  token?: string;
}> {
  const bootstrapUrl = resolveMotherBootstrapUrl(env);
  if (!bootstrapUrl) {
    return {
      reason: 'MOTHER_BOOTSTRAP_URL or MOTHER_REPORT_URL is not configured.',
      responseCode: null,
    };
  }

  const serviceUrl = resolveServiceUrl(env, options.fallbackOrigin);
  if (!serviceUrl) {
    return {
      reason: 'SERVICE_PUBLIC_URL is not configured and no request origin is available.',
      responseCode: null,
    };
  }

  const keyPair = await getOrCreateLocalServiceEncryptionKeyPair(env.DB);
  const body = JSON.stringify({
    service: env.APP_NAME ?? 'NCT API SQL Sub',
    serviceWatermark: NCT_SUB_SERVICE_WATERMARK,
    serviceUrl,
    subServiceEncryptionPublicKey: keyPair.publicKey,
    reportedAt: nowIso(),
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getReportTimeoutMs(env));

  try {
    const response = await fetch(bootstrapUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body,
      signal: controller.signal,
    });
    const responseText = await response.text();
    const acceptedPayload = response.ok
      ? await readAcceptedPayload<MotherBootstrapAcceptedPayload>(env, env.DB, responseText)
      : null;

    if (!response.ok || !acceptedPayload?.accepted || !acceptedPayload.encryptedAuthToken) {
      return {
        reason: response.ok
          ? 'Mother bootstrap response is missing an encrypted auth token.'
          : responseText || `Bootstrap failed with status ${response.status}.`,
        responseCode: response.status,
      };
    }

    await cacheMotherKeys(env, acceptedPayload);
    const decryptedTokenPayload = await decryptJsonWithPrivateKey<{ token?: unknown }>(
      acceptedPayload.encryptedAuthToken,
      keyPair.privateKey,
    );
    const token =
      decryptedTokenPayload && typeof decryptedTokenPayload === 'object' && typeof decryptedTokenPayload.token === 'string'
        ? decryptedTokenPayload.token.trim()
        : '';
    if (!token) {
      return {
        reason: 'Mother bootstrap response did not contain a usable auth token.',
        responseCode: response.status,
      };
    }

    await writeMotherAuthToken(env.DB, token);
    return {
      motherServiceEncryptionPublicKey: acceptedPayload.motherServiceEncryptionPublicKey ?? null,
      motherServicePublicKey: acceptedPayload.motherServicePublicKey ?? null,
      responseCode: response.status,
      token,
    };
  } catch (error) {
    return {
      reason: error instanceof Error ? error.message : 'Unknown bootstrap error',
      responseCode: null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function ensureMotherAuthToken(
  env: Env,
  options: {
    fallbackOrigin?: string;
  } = {}
): Promise<{
  reason?: string;
  token?: string;
}> {
  const cachedToken = await getMotherAuthToken(env.DB);
  if (cachedToken) {
    return {
      token: cachedToken,
    };
  }

  const bootstrap = await bootstrapWithMother(env, options);
  return bootstrap.token
    ? { token: bootstrap.token }
    : { reason: bootstrap.reason ?? 'Mother bootstrap failed.' };
}

export async function reportToMother(
  env: Env,
  options: {
    allowRetry?: boolean;
    fallbackOrigin?: string;
    payloadOverride?: MotherReportPayload;
  } = {}
): Promise<MotherReportResult> {
  const motherReportUrl = env.MOTHER_REPORT_URL?.trim();
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

  const authToken = await ensureMotherAuthToken(env, options);
  if (!authToken.token) {
    return {
      delivered: false,
      skipped: false,
      reason: authToken.reason ?? 'Mother auth bootstrap failed.',
      responseCode: null,
    };
  }

  const payload = options.payloadOverride ?? {
    service: env.APP_NAME ?? 'NCT API SQL Sub',
    serviceWatermark: NCT_SUB_SERVICE_WATERMARK,
    serviceUrl,
    databackVersion: await getNullableDatabackVersion(env.DB),
    reportCount: await bumpServiceReportCount(env.DB),
    reportedAt: nowIso(),
  };
  const body = JSON.stringify(payload);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getReportTimeoutMs(env));

  try {
    const response = await fetch(motherReportUrl, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${authToken.token}`,
        'content-type': 'application/json',
      },
      body,
      signal: controller.signal
    });

    if (response.status === 401 && options.allowRetry !== false) {
      await clearMotherAuthToken(env.DB);
      return reportToMother(env, {
        allowRetry: false,
        fallbackOrigin: options.fallbackOrigin,
        payloadOverride: payload,
      });
    }

    const responseText = await response.text();
    const acceptedPayload = response.ok
      ? await readAcceptedPayload<MotherReportAcceptedPayload>(env, env.DB, responseText)
      : null;
    await cacheMotherKeys(env, acceptedPayload);

    return {
      delivered: response.ok,
      skipped: false,
      motherServiceEncryptionPublicKey: acceptedPayload?.motherServiceEncryptionPublicKey ?? null,
      motherServicePublicKey: acceptedPayload?.motherServicePublicKey ?? null,
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

  const authToken = await ensureMotherAuthToken(env, options);
  if (!authToken.token) {
    for (const record of pendingRecords) {
      await markMotherFormSyncFailure(
        env.DB,
        record.recordKey,
        authToken.reason ?? 'Mother auth bootstrap failed.',
      );
    }

    return {
      deliveredCount: 0,
      pendingCount: pendingRecords.length,
      reason: authToken.reason ?? 'Mother auth bootstrap failed.',
      responseCode: null,
      skipped: false,
    };
  }

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
        authorization: `Bearer ${authToken.token}`,
        'content-type': 'application/json',
      },
      body,
      signal: controller.signal,
    });

    if (response.status === 401 && options.allowRetry !== false) {
      await clearMotherAuthToken(env.DB);
      return flushPendingMotherFormRecords(env, {
        allowRetry: false,
        fallbackOrigin: options.fallbackOrigin,
      });
    }

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
      motherServiceEncryptionPublicKey?: unknown;
      motherServicePublicKey?: unknown;
    }>(env, env.DB, responseText);
    await cacheMotherKeys(
      env,
      acceptedPayload
        ? {
            motherServiceEncryptionPublicKey:
              typeof acceptedPayload.motherServiceEncryptionPublicKey === 'string'
                ? acceptedPayload.motherServiceEncryptionPublicKey
                : null,
            motherServicePublicKey:
              typeof acceptedPayload.motherServicePublicKey === 'string'
                ? acceptedPayload.motherServicePublicKey
                : null,
          }
        : null,
    );

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
