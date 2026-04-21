import type { MotherReportPayload, MotherReportResult } from '../types';
import { bumpServiceReportCount, getNullableDatabackVersion } from './data';

let startupReportTriggered = false;

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

export async function reportToMother(
  env: Env,
  options: {
    fallbackOrigin?: string;
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

  const databackVersion = await getNullableDatabackVersion(env.DB);
  const reportCount = await bumpServiceReportCount(env.DB);
  const payload: MotherReportPayload = {
    service: env.APP_NAME ?? 'NCT API SQL Sub',
    serviceUrl,
    databackVersion,
    reportCount,
    reportedAt: nowIso()
  };

  const timeoutMs = Math.max(
    1000,
    Number(env.MOTHER_REPORT_TIMEOUT_MS ?? '10000')
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(motherReportUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(env.MOTHER_REPORT_TOKEN
          ? {
              authorization: `Bearer ${env.MOTHER_REPORT_TOKEN}`
            }
          : {})
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    return {
      delivered: response.ok,
      skipped: false,
      payload,
      responseCode: response.status,
      reason: response.ok
        ? undefined
        : await response.text()
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
