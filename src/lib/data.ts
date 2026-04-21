import type {
  DynamicTableName,
  JsonObject,
  JsonValue,
  MotherDatabackExportFile,
  MotherDatabackExportRecord,
  MotherPushRecord,
  RecordQueryOptions,
  RecordWriteInput,
  SecureTransferPayload,
  TableRecord
} from '../types';
import { encryptObject, sha256 } from './crypto';
import {
  ensureDynamicColumns,
  extractDynamicColumns,
  serializeDynamicColumnValue
} from './dynamic-schema';
import { parseJsonObject, stableStringify, toJsonObject } from './json';

type DynamicRow = Record<string, unknown> & {
  id: string;
  record_key: string;
  payload_json: string;
  created_at: string;
  updated_at: string;
  version?: number;
  fingerprint?: string;
};

type ColumnAssignment = {
  column: string;
  value: string | null;
};

const SYSTEM_RECORD_PREFIX = '__system__:';
const REPORT_COUNTER_RECORD_KEY = `${SYSTEM_RECORD_PREFIX}report_counter`;

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function isSystemRecordKey(recordKey: string): boolean {
  return recordKey.startsWith(SYSTEM_RECORD_PREFIX);
}

function collectFieldNames(...groups: Iterable<string>[]): string[] {
  const fieldNames = new Set<string>();

  groups.forEach((group) => {
    for (const fieldName of group) {
      const trimmed = fieldName.trim();
      if (trimmed) {
        fieldNames.add(trimmed);
      }
    }
  });

  return Array.from(fieldNames).sort((left, right) =>
    left.localeCompare(right)
  );
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function buildInsertStatement(tableName: DynamicTableName, columns: string[]): string {
  return `
    INSERT INTO ${quoteIdentifier(tableName)} (
      ${columns.map((column) => quoteIdentifier(column)).join(', ')}
    )
    VALUES (${columns.map(() => '?').join(', ')})
  `;
}

function buildUpdateStatement(
  tableName: DynamicTableName,
  columns: string[],
  whereColumn: string
): string {
  return `
    UPDATE ${quoteIdentifier(tableName)}
    SET ${columns
      .map((column) => `${quoteIdentifier(column)} = ?`)
      .join(', ')}
    WHERE ${quoteIdentifier(whereColumn)} = ?
  `;
}

function readRecordKey(input: RecordWriteInput): string {
  const payload = input.payload as Record<string, unknown>;
  const candidates = [
    input.recordKey,
    typeof payload.recordKey === 'string' ? payload.recordKey : undefined,
    typeof payload.id === 'string' ? payload.id : undefined,
    typeof payload.code === 'string' ? payload.code : undefined,
    typeof payload.externalId === 'string' ? payload.externalId : undefined
  ];

  return candidates.find((candidate) => candidate?.trim()) ?? crypto.randomUUID();
}

function buildDynamicAssignments(
  mappings: Map<string, string>,
  fieldNames: Iterable<string>,
  values: Record<string, JsonValue>
): ColumnAssignment[] {
  return collectFieldNames(fieldNames).flatMap((fieldName) => {
    const column = mappings.get(fieldName);
    if (!column) {
      return [];
    }

    return [
      {
        column,
        value: hasOwn(values, fieldName)
          ? serializeDynamicColumnValue(values[fieldName])
          : null
      }
    ];
  });
}

function mapTableRecord(row: DynamicRow): TableRecord {
  const payload = parseJsonObject(row.payload_json);

  return {
    id: row.id,
    recordKey: row.record_key,
    payload,
    dynamicColumns: extractDynamicColumns(row, Object.keys(payload)),
    version: row.version === undefined ? undefined : Number(row.version),
    fingerprint:
      typeof row.fingerprint === 'string'
        ? row.fingerprint
        : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function getDefaultEncryptFields(env: Env): string[] {
  return (env.DEFAULT_ENCRYPT_FIELDS ?? '')
    .split(',')
    .map((field) => field.trim())
    .filter(Boolean);
}

function partitionPayload(
  payload: JsonObject,
  encryptFields: string[]
): {
  publicData: JsonObject;
  secretData: JsonObject;
} {
  const encryptedFieldSet = new Set(encryptFields);
  const publicData: JsonObject = {};
  const secretData: JsonObject = {};

  Object.entries(payload).forEach(([key, value]) => {
    if (encryptedFieldSet.has(key)) {
      secretData[key] = value;
      return;
    }

    publicData[key] = value;
  });

  return {
    publicData,
    secretData
  };
}

function isEncryptedEnvelope(
  value: unknown
): value is SecureTransferPayload['encryptedData'] {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    candidate.algorithm === 'AES-GCM'
    && typeof candidate.iv === 'string'
    && typeof candidate.ciphertext === 'string'
  );
}

function isSecureTransferPayload(value: unknown): value is SecureTransferPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.keyVersion === 'number'
    && Number.isFinite(candidate.keyVersion)
    && !!candidate.publicData
    && typeof candidate.publicData === 'object'
    && !Array.isArray(candidate.publicData)
    && isEncryptedEnvelope(candidate.encryptedData)
    && Array.isArray(candidate.encryptFields)
    && candidate.encryptFields.every((field) => typeof field === 'string')
    && (typeof candidate.syncedAt === 'string' || candidate.syncedAt === null)
  );
}

async function buildSecureTransferPayload(
  env: Env,
  payload: JsonObject,
  syncedAt: string | null
): Promise<{
  securePayload: SecureTransferPayload;
  fingerprint: string;
}> {
  if (!env.ENCRYPTION_KEY) {
    throw new Error(
      'ENCRYPTION_KEY is required in nct-api-sql-sub when exporting nct_databack to the mother service.'
    );
  }

  const encryptFields = Array.from(new Set(getDefaultEncryptFields(env)));
  const { publicData, secretData } = partitionPayload(payload, encryptFields);
  const securePayload: SecureTransferPayload = {
    keyVersion: Math.max(1, Number(env.ENCRYPTION_KEY_VERSION ?? '1')),
    publicData,
    encryptedData: await encryptObject(secretData, env.ENCRYPTION_KEY),
    encryptFields,
    syncedAt
  };

  return {
    securePayload,
    fingerprint: await sha256(
      stableStringify({
        keyVersion: securePayload.keyVersion,
        publicData,
        secretData,
        encryptFields
      })
    )
  };
}

export async function getDatabackVersion(db: D1Database): Promise<number> {
  const result = await db
    .prepare(
      'SELECT COALESCE(MAX(version), 0) AS version FROM nct_databack'
    )
    .first<{ version: number | null }>();

  return Number(result?.version ?? 0);
}

export async function getNullableDatabackVersion(
  db: D1Database
): Promise<number | null> {
  const result = await db
    .prepare(
      'SELECT MAX(version) AS version FROM nct_databack WHERE record_key NOT GLOB \'__system__:*\''
    )
    .first<{ version: number | null }>();

  return result?.version === null || result?.version === undefined
    ? null
    : Number(result.version);
}

export async function getTableCounts(db: D1Database): Promise<{
  nctForm: number;
  nctDataback: number;
}> {
  const result = await db
    .prepare(
      `
        SELECT
          (
            SELECT COUNT(*)
            FROM nct_form
            WHERE record_key NOT GLOB '__system__:*'
          ) AS nctForm,
          (
            SELECT COUNT(*)
            FROM nct_databack
            WHERE record_key NOT GLOB '__system__:*'
          ) AS nctDataback
      `
    )
    .first<{
      nctForm: number | null;
      nctDataback: number | null;
    }>();

  return {
    nctForm: Number(result?.nctForm ?? 0),
    nctDataback: Number(result?.nctDataback ?? 0)
  };
}

export async function listRecords(
  db: D1Database,
  tableName: DynamicTableName,
  options: RecordQueryOptions = {}
): Promise<TableRecord[]> {
  const limit = Math.max(1, Math.min(Number(options.limit ?? 50), 500));

  if (options.recordKey && isSystemRecordKey(options.recordKey)) {
    return [];
  }

  const statement = options.recordKey
    ? db
        .prepare(
          `
            SELECT *
            FROM ${quoteIdentifier(tableName)}
            WHERE record_key = ?
              AND record_key NOT GLOB '__system__:*'
            ORDER BY updated_at DESC
            LIMIT ?
          `
        )
        .bind(options.recordKey, limit)
    : db
        .prepare(
          `
            SELECT *
            FROM ${quoteIdentifier(tableName)}
            WHERE record_key NOT GLOB '__system__:*'
            ORDER BY updated_at DESC
            LIMIT ?
          `
        )
        .bind(limit);

  const result = await statement.all<DynamicRow>();
  return (result.results ?? []).map(mapTableRecord);
}

export async function writeRecord(
  db: D1Database,
  tableName: DynamicTableName,
  input: RecordWriteInput
): Promise<TableRecord> {
  const payload = toJsonObject(input.payload);
  const recordKey = readRecordKey(input);
  const payloadJson = stableStringify(payload);
  const receivedAt = nowIso();
  const existingRow = await db
    .prepare(
      `
        SELECT *
        FROM ${quoteIdentifier(tableName)}
        WHERE record_key = ?
      `
    )
    .bind(recordKey)
    .first<DynamicRow>();
  const previousPayload = existingRow
    ? parseJsonObject(existingRow.payload_json)
    : {};
  const fieldNames = collectFieldNames(
    Object.keys(previousPayload),
    Object.keys(payload)
  );
  const dynamicColumnMappings = await ensureDynamicColumns(
    db,
    tableName,
    fieldNames
  );
  const dynamicAssignments = buildDynamicAssignments(
    dynamicColumnMappings,
    fieldNames,
    payload
  );
  const rowId = existingRow?.id ?? crypto.randomUUID();

  if (tableName === 'nct_form') {
    if (existingRow) {
      const updateColumns = [
        'payload_json',
        'updated_at',
        ...dynamicAssignments.map((assignment) => assignment.column)
      ];
      const updateValues = [
        payloadJson,
        receivedAt,
        ...dynamicAssignments.map((assignment) => assignment.value),
        rowId
      ];

      await db
        .prepare(buildUpdateStatement(tableName, updateColumns, 'id'))
        .bind(...updateValues)
        .run();
    } else {
      const insertColumns = [
        'id',
        'record_key',
        'payload_json',
        'created_at',
        'updated_at',
        ...dynamicAssignments.map((assignment) => assignment.column)
      ];
      const insertValues = [
        rowId,
        recordKey,
        payloadJson,
        receivedAt,
        receivedAt,
        ...dynamicAssignments.map((assignment) => assignment.value)
      ];

      await db
        .prepare(buildInsertStatement(tableName, insertColumns))
        .bind(...insertValues)
        .run();
    }
  } else {
    const fingerprint = await sha256(payloadJson);
    const currentVersion = await getDatabackVersion(db);
    const hasChanged = existingRow?.fingerprint !== fingerprint;
    const nextVersion = existingRow
      ? hasChanged
        ? currentVersion + 1
        : Number(existingRow.version ?? 0)
      : currentVersion + 1;

    if (existingRow) {
      const updateColumns = [
        'payload_json',
        'version',
        'fingerprint',
        'updated_at',
        ...dynamicAssignments.map((assignment) => assignment.column)
      ];
      const updateValues = [
        payloadJson,
        nextVersion,
        fingerprint,
        receivedAt,
        ...dynamicAssignments.map((assignment) => assignment.value),
        rowId
      ];

      await db
        .prepare(buildUpdateStatement(tableName, updateColumns, 'id'))
        .bind(...updateValues)
        .run();
    } else {
      const insertColumns = [
        'id',
        'record_key',
        'payload_json',
        'version',
        'fingerprint',
        'created_at',
        'updated_at',
        ...dynamicAssignments.map((assignment) => assignment.column)
      ];
      const insertValues = [
        rowId,
        recordKey,
        payloadJson,
        nextVersion,
        fingerprint,
        receivedAt,
        receivedAt,
        ...dynamicAssignments.map((assignment) => assignment.value)
      ];

      await db
        .prepare(buildInsertStatement(tableName, insertColumns))
        .bind(...insertValues)
        .run();
    }
  }

  const storedRow = await db
    .prepare(
      `
        SELECT *
        FROM ${quoteIdentifier(tableName)}
        WHERE id = ?
      `
    )
    .bind(rowId)
    .first<DynamicRow>();

  if (!storedRow) {
    throw new Error(`Failed to read back record from ${tableName}.`);
  }

  return mapTableRecord(storedRow);
}

export async function importMotherPushRecords(
  db: D1Database,
  records: MotherPushRecord[]
): Promise<{
  receivedCount: number;
  updatedCount: number;
  skippedCount: number;
  currentDatabackVersion: number;
}> {
  let updatedCount = 0;
  let skippedCount = 0;

  for (const record of records) {
    const recordKey = record.recordKey.trim();
    const payload = toJsonObject(record.payload);
    const payloadJson = stableStringify(payload);
    const incomingVersion = Math.max(0, Number(record.version));
    const fingerprint = record.fingerprint.trim();
    const receivedAt = nowIso();
    const existingRow = await db
      .prepare(
        `
          SELECT *
          FROM nct_databack
          WHERE record_key = ?
        `
      )
      .bind(recordKey)
      .first<DynamicRow>();

    const existingVersion = Number(existingRow?.version ?? 0);
    const shouldUpdate = !existingRow
      || incomingVersion > existingVersion
      || (
        incomingVersion === existingVersion
        && existingRow?.fingerprint !== fingerprint
      );

    if (!shouldUpdate) {
      skippedCount += 1;
      continue;
    }

    const previousPayload = existingRow
      ? parseJsonObject(existingRow.payload_json)
      : {};
    const fieldNames = collectFieldNames(
      Object.keys(previousPayload),
      Object.keys(payload)
    );
    const dynamicColumnMappings = await ensureDynamicColumns(
      db,
      'nct_databack',
      fieldNames
    );
    const dynamicAssignments = buildDynamicAssignments(
      dynamicColumnMappings,
      fieldNames,
      payload
    );
    const rowId = existingRow?.id ?? crypto.randomUUID();

    if (existingRow) {
      const updateColumns = [
        'payload_json',
        'version',
        'fingerprint',
        'updated_at',
        ...dynamicAssignments.map((assignment) => assignment.column)
      ];
      const updateValues = [
        payloadJson,
        incomingVersion,
        fingerprint,
        receivedAt,
        ...dynamicAssignments.map((assignment) => assignment.value),
        rowId
      ];

      await db
        .prepare(buildUpdateStatement('nct_databack', updateColumns, 'id'))
        .bind(...updateValues)
        .run();
    } else {
      const insertColumns = [
        'id',
        'record_key',
        'payload_json',
        'version',
        'fingerprint',
        'created_at',
        'updated_at',
        ...dynamicAssignments.map((assignment) => assignment.column)
      ];
      const insertValues = [
        rowId,
        recordKey,
        payloadJson,
        incomingVersion,
        fingerprint,
        receivedAt,
        receivedAt,
        ...dynamicAssignments.map((assignment) => assignment.value)
      ];

      await db
        .prepare(buildInsertStatement('nct_databack', insertColumns))
        .bind(...insertValues)
        .run();
    }

    updatedCount += 1;
  }

  return {
    receivedCount: records.length,
    updatedCount,
    skippedCount,
    currentDatabackVersion: await getDatabackVersion(db)
  };
}

export async function exportDatabackFile(
  db: D1Database,
  env: Env,
  options: {
    afterVersion?: number;
    limit?: number;
    serviceUrl?: string | null;
  } = {}
): Promise<MotherDatabackExportFile> {
  const afterVersion = Math.max(0, Number(options.afterVersion ?? 0));
  const limit = Math.max(1, Math.min(Number(options.limit ?? 100), 500));
  const result = await db
    .prepare(
      `
        SELECT *
        FROM nct_databack
        WHERE record_key NOT GLOB '__system__:*'
          AND version > ?
        ORDER BY version ASC, updated_at ASC
        LIMIT ?
      `
    )
    .bind(afterVersion, limit)
    .all<DynamicRow>();

  const records: MotherDatabackExportRecord[] = [];
  for (const row of result.results ?? []) {
    const payload = parseJsonObject(row.payload_json);
    const payloadCandidate = payload as unknown;
    const rowVersion = Number(row.version ?? 0);
    const updatedAt =
      typeof row.updated_at === 'string'
        ? row.updated_at
        : nowIso();

    if (isSecureTransferPayload(payloadCandidate)) {
      records.push({
        recordKey: row.record_key,
        version: rowVersion,
        fingerprint:
          typeof row.fingerprint === 'string'
            ? row.fingerprint
            : await sha256(stableStringify(payload)),
        payload: payloadCandidate,
        updatedAt
      });
      continue;
    }

    const { securePayload, fingerprint } = await buildSecureTransferPayload(
      env,
      payload,
      updatedAt
    );
    records.push({
      recordKey: row.record_key,
      version: rowVersion,
      fingerprint,
      payload: securePayload,
      updatedAt
    });
  }

  return {
    service: env.APP_NAME ?? 'NCT API SQL Sub',
    serviceUrl: options.serviceUrl?.trim() || env.SERVICE_PUBLIC_URL?.trim() || '',
    afterVersion,
    currentVersion: await getNullableDatabackVersion(db),
    exportedAt: nowIso(),
    totalRecords: records.length,
    records
  };
}

export async function getServiceReportCount(
  db: D1Database
): Promise<number> {
  const result = await db
    .prepare(
      `
        SELECT payload_json
        FROM nct_form
        WHERE record_key = ?
      `
    )
    .bind(REPORT_COUNTER_RECORD_KEY)
    .first<{ payload_json: string | null }>();

  if (!result?.payload_json) {
    return 0;
  }

  const payload = parseJsonObject(result.payload_json);
  const reportCount = payload.reportCount;

  if (typeof reportCount === 'number' && Number.isFinite(reportCount)) {
    return reportCount;
  }

  if (typeof reportCount === 'string') {
    const parsed = Number(reportCount);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

export async function bumpServiceReportCount(
  db: D1Database
): Promise<number> {
  const receivedAt = nowIso();
  const rowId = crypto.randomUUID();
  const initialPayloadJson = stableStringify({
    kind: 'reportCounter',
    reportCount: 1,
    updatedAt: receivedAt
  });

  await db
    .prepare(
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
          payload_json = json_set(
            COALESCE(nct_form.payload_json, '{}'),
            '$.kind',
            'reportCounter',
            '$.reportCount',
            COALESCE(CAST(json_extract(nct_form.payload_json, '$.reportCount') AS INTEGER), 0) + 1,
            '$.updatedAt',
            excluded.updated_at
          ),
          updated_at = excluded.updated_at
      `
    )
    .bind(
      rowId,
      REPORT_COUNTER_RECORD_KEY,
      initialPayloadJson,
      receivedAt,
      receivedAt
    )
    .run();

  return getServiceReportCount(db);
}
