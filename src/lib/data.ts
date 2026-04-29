import type {
  DataSourceType,
  DynamicTableName,
  JsonObject,
  JsonValue,
  MotherDatabackExportFile,
  MotherDatabackExportRecord,
  MotherFormSyncRecord,
  MotherFormSyncResult,
  MotherPushRecord,
  RecordQueryOptions,
  RecordWriteInput,
  SecureTransferPayload,
  TableRecord
} from '../types';
import { sha256 } from './crypto';
import {
  ensureDynamicColumns,
  extractDynamicColumns,
  serializeDynamicColumnValue
} from './dynamic-schema';
import { parseJsonObject, stableStringify, toJsonObject } from './json';
import {
  computeRecordContentFingerprint,
  deriveRecordContentVersion,
} from './record-version';
import { resolveConfiguredBaseUrl } from './url';

type DynamicRow = Record<string, unknown> & {
  id: string;
  record_key: string;
  data_source_type?: string | null;
  payload_json: string;
  created_at: string;
  updated_at: string;
  version?: number;
  fingerprint?: string;
  payload_encryption_state?: string | null;
  mother_sync_status?: string | null;
  mother_sync_attempts?: number | null;
  mother_sync_last_error?: string | null;
  mother_sync_last_attempt_at?: string | null;
  mother_sync_last_success_at?: string | null;
  mother_assigned_version?: number | null;
};

type ColumnAssignment = {
  column: string;
  value: string | null;
};

const SYSTEM_RECORD_PREFIX = '__system__:';
const REPORT_COUNTER_RECORD_KEY = `${SYSTEM_RECORD_PREFIX}report_counter`;
const MOTHER_SYNC_STATE_RECORD_KEY = `${SYSTEM_RECORD_PREFIX}mother_sync_state`;
const FORM_PROTECTION_SECRET_RECORD_KEY = `${SYSTEM_RECORD_PREFIX}form_protection_secret`;
const MOTHER_FORM_FAST_RETRY_LIMIT = 5;
const MOTHER_FORM_FAST_RETRY_DELAY_MS = 60 * 1000;
const MOTHER_FORM_SLOW_RETRY_DELAY_MS = 30 * 60 * 1000;
const DATA_SOURCE_TYPES = new Set<DataSourceType>([
  'questionnaire',
  'batch_query',
]);

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function getMotherFormSyncRetryDelayMs(attemptCount: number): number {
  return attemptCount > MOTHER_FORM_FAST_RETRY_LIMIT
    ? MOTHER_FORM_SLOW_RETRY_DELAY_MS
    : MOTHER_FORM_FAST_RETRY_DELAY_MS;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function randomSecret(): string {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
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

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readSubmittedFields(values: Record<string, JsonValue>): JsonObject {
  return isJsonObject(values.submittedFields) ? values.submittedFields : {};
}

function collectPayloadFieldNames(...payloads: JsonObject[]): string[] {
  return collectFieldNames(
    ...payloads.flatMap((payload) => [
      Object.keys(payload),
      Object.keys(readSubmittedFields(payload)),
    ]),
  );
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function readDynamicFieldValue(
  values: Record<string, JsonValue>,
  fieldName: string,
): JsonValue | undefined {
  if (hasOwn(values, fieldName)) {
    return values[fieldName];
  }

  const submittedFields = readSubmittedFields(values);
  return hasOwn(submittedFields, fieldName)
    ? submittedFields[fieldName]
    : undefined;
}

function normalizeDataSourceType(
  value: unknown,
  fallback: DataSourceType,
): DataSourceType {
  return typeof value === 'string' && DATA_SOURCE_TYPES.has(value as DataSourceType)
    ? value as DataSourceType
    : fallback;
}

function inferDataSourceType(payload: JsonObject): DataSourceType {
  const source = typeof payload.source === 'string' ? payload.source : '';
  const recordKind = typeof payload.recordKind === 'string' ? payload.recordKind : '';
  const publicData = isJsonObject(payload.publicData) ? payload.publicData : {};

  if (
    source === 'No-Torsion'
    || recordKind.startsWith('no_torsion_')
    || isJsonObject(payload.submittedFields)
    || publicData.source === 'No-Torsion'
    || (
      typeof publicData.recordKind === 'string'
      && publicData.recordKind.startsWith('no_torsion_')
    )
  ) {
    return 'questionnaire';
  }

  return 'batch_query';
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
  const assignmentsByColumn = new Map<string, ColumnAssignment>();

  for (const fieldName of collectFieldNames(fieldNames)) {
    const column = mappings.get(fieldName);
    if (!column) {
      continue;
    }

    const fieldValue = readDynamicFieldValue(values, fieldName);
    const value =
      fieldValue === undefined
        ? null
        : serializeDynamicColumnValue(fieldValue);
    const existingAssignment = assignmentsByColumn.get(column);

    if (!existingAssignment || (existingAssignment.value === null && value !== null)) {
      assignmentsByColumn.set(column, {
        column,
        value,
      });
    }
  }

  return Array.from(assignmentsByColumn.values()).sort((left, right) =>
    left.column.localeCompare(right.column)
  );
}

function mapTableRecord(row: DynamicRow): TableRecord {
  const payload = parseJsonObject(row.payload_json);
  const dataSourceType = normalizeDataSourceType(
    row.data_source_type,
    inferDataSourceType(payload),
  );

  return {
    dataSourceType,
    id: row.id,
    recordKey: row.record_key,
    payload,
    dynamicColumns: extractDynamicColumns(row, collectPayloadFieldNames(payload)),
    version: row.version === undefined ? undefined : Number(row.version),
    fingerprint:
      typeof row.fingerprint === 'string'
        ? row.fingerprint
        : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function isEncryptedEnvelope(
  value: unknown
): value is SecureTransferPayload['encryptedData'] {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (
    candidate.algorithm === 'AES-GCM'
    && typeof candidate.iv === 'string'
    && typeof candidate.ciphertext === 'string'
  ) {
    return true;
  }

  return false;
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

async function readSystemRecordPayload(
  db: D1Database,
  recordKey: string
): Promise<JsonObject | null> {
  const result = await db
    .prepare(
      `
        SELECT payload_json
        FROM nct_form
        WHERE record_key = ?
      `
    )
    .bind(recordKey)
    .first<{ payload_json: string | null }>();

  return result?.payload_json
    ? parseJsonObject(result.payload_json)
    : null;
}

async function writeSystemRecordPayload(
  db: D1Database,
  recordKey: string,
  payload: JsonObject
): Promise<void> {
  const receivedAt = nowIso();

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
          payload_json = excluded.payload_json,
          updated_at = excluded.updated_at
      `
    )
    .bind(
      crypto.randomUUID(),
      recordKey,
      stableStringify(payload),
      receivedAt,
      receivedAt
    )
    .run();
}

async function readFormProtectionSecret(db: D1Database): Promise<string | null> {
  const payload = await readSystemRecordPayload(db, FORM_PROTECTION_SECRET_RECORD_KEY);
  if (!payload) {
    return null;
  }
  return typeof payload.secret === 'string'
    ? payload.secret.trim() || null
    : null;
}

export async function getOrCreateFormProtectionSecret(
  db: D1Database
): Promise<string> {
  const existingSecret = await readFormProtectionSecret(db);
  if (existingSecret) {
    return existingSecret;
  }

  const generatedSecret = randomSecret();
  await writeSystemRecordPayload(db, FORM_PROTECTION_SECRET_RECORD_KEY, {
    kind: 'formProtectionSecret',
    secret: generatedSecret,
    updatedAt: nowIso(),
  });

  return await readFormProtectionSecret(db) ?? generatedSecret;
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
  const dataSourceType = normalizeDataSourceType(
    input.dataSourceType,
    inferDataSourceType(payload),
  );
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
  const fieldNames = collectPayloadFieldNames(previousPayload, payload);
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
  const isSystemRecord = isSystemRecordKey(recordKey);

  if (tableName === 'nct_form') {
    if (existingRow) {
      const updateColumns = [
        'payload_json',
        'updated_at',
        ...(
          isSystemRecord
            ? []
            : [
                'mother_sync_status',
                'mother_sync_attempts',
                'mother_sync_last_error',
                'mother_sync_last_attempt_at',
                'mother_sync_last_success_at',
                'mother_assigned_version',
              ]
        ),
        ...(
          isSystemRecord
            ? []
            : [
                'data_source_type',
              ]
        ),
        ...dynamicAssignments.map((assignment) => assignment.column)
      ];
      const updateValues = [
        payloadJson,
        receivedAt,
        ...(
          isSystemRecord
            ? []
            : [
                'pending',
                0,
                null,
                null,
                null,
                null,
              ]
        ),
        ...(
          isSystemRecord
            ? []
            : [
                dataSourceType,
              ]
        ),
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
        ...(
          isSystemRecord
            ? []
            : [
                'data_source_type',
                'mother_sync_status',
                'mother_sync_attempts',
              ]
        ),
        ...dynamicAssignments.map((assignment) => assignment.column)
      ];
      const insertValues = [
        rowId,
        recordKey,
        payloadJson,
        receivedAt,
        receivedAt,
        ...(
          isSystemRecord
            ? []
            : [
                dataSourceType,
                'pending',
                0,
              ]
        ),
        ...dynamicAssignments.map((assignment) => assignment.value)
      ];

      await db
        .prepare(buildInsertStatement(tableName, insertColumns))
        .bind(...insertValues)
        .run();
    }
  } else {
    const fingerprint = await computeRecordContentFingerprint(payload);
    const currentVersion = await getDatabackVersion(db);
    const hasChanged = existingRow?.fingerprint !== fingerprint;
    const nextVersion = existingRow
      ? hasChanged
        ? deriveRecordContentVersion(currentVersion, fingerprint)
        : Number(existingRow.version ?? 0)
      : deriveRecordContentVersion(currentVersion, fingerprint);

    if (existingRow) {
      const updateColumns = [
        'payload_json',
        'version',
        'fingerprint',
        'payload_encryption_state',
        'data_source_type',
        'updated_at',
        ...dynamicAssignments.map((assignment) => assignment.column)
      ];
      const updateValues = [
        payloadJson,
        nextVersion,
        fingerprint,
        'plain-json',
        dataSourceType,
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
        'payload_encryption_state',
        'data_source_type',
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
        'plain-json',
        dataSourceType,
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
    const dataSourceType = normalizeDataSourceType(
      record.dataSourceType,
      inferDataSourceType(payload),
    );
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
    const fieldNames = collectPayloadFieldNames(previousPayload, payload);
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
        'payload_encryption_state',
        'data_source_type',
        'updated_at',
        ...dynamicAssignments.map((assignment) => assignment.column)
      ];
      const updateValues = [
        payloadJson,
        incomingVersion,
        fingerprint,
        'secure-transfer',
        dataSourceType,
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
        'payload_encryption_state',
        'data_source_type',
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
        'secure-transfer',
        dataSourceType,
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
    const payloadEncryptionState: MotherDatabackExportRecord['payloadEncryptionState'] =
      row.payload_encryption_state === 'secure-transfer' || isSecureTransferPayload(payloadCandidate)
        ? 'secure-transfer'
        : 'plain-json';
    const fingerprint =
      typeof row.fingerprint === 'string'
        ? row.fingerprint
        : await computeRecordContentFingerprint(payload);

    records.push({
      dataSourceType: normalizeDataSourceType(
        row.data_source_type,
        inferDataSourceType(payload),
      ),
      payload: isSecureTransferPayload(payloadCandidate)
        ? payloadCandidate
        : payload,
      payloadEncryptionState,
      recordKey: row.record_key,
      version: rowVersion,
      fingerprint,
      updatedAt
    });
  }

  return {
    service: env.APP_NAME ?? 'NCT API SQL Sub',
    serviceUrl: resolveConfiguredBaseUrl(options.serviceUrl, env.SERVICE_PUBLIC_URL) ?? '',
    afterVersion,
    currentVersion: await getNullableDatabackVersion(db),
    exportedAt: nowIso(),
    totalRecords: records.length,
    records,
  };
}

export async function listPendingMotherFormSyncRecords(
  db: D1Database,
  limit = 20
): Promise<MotherFormSyncRecord[]> {
  const fastRetryBefore = new Date(
    Date.now() - getMotherFormSyncRetryDelayMs(MOTHER_FORM_FAST_RETRY_LIMIT),
  ).toISOString();
  const slowRetryBefore = new Date(
    Date.now() - getMotherFormSyncRetryDelayMs(MOTHER_FORM_FAST_RETRY_LIMIT + 1),
  ).toISOString();
  const result = await db
    .prepare(
      `
        SELECT
          form.record_key,
          form.updated_at,
          databack.payload_json AS databack_payload_json,
          databack.version AS databack_version,
          databack.fingerprint AS databack_fingerprint
        FROM nct_form AS form
        INNER JOIN nct_databack AS databack
          ON databack.record_key = form.record_key
        WHERE form.record_key NOT GLOB '__system__:*'
          AND COALESCE(form.mother_sync_status, 'pending') != 'synced'
          AND (
            COALESCE(form.mother_sync_status, 'pending') = 'pending'
            OR form.mother_sync_last_attempt_at IS NULL
            OR (
              COALESCE(form.mother_sync_attempts, 0) <= ?
              AND form.mother_sync_last_attempt_at <= ?
            )
            OR (
              COALESCE(form.mother_sync_attempts, 0) > ?
              AND form.mother_sync_last_attempt_at <= ?
            )
          )
        ORDER BY form.updated_at ASC
        LIMIT ?
      `
    )
    .bind(
      MOTHER_FORM_FAST_RETRY_LIMIT,
      fastRetryBefore,
      MOTHER_FORM_FAST_RETRY_LIMIT,
      slowRetryBefore,
      Math.max(1, Math.min(limit, 200)),
    )
    .all<{
      record_key: string;
      updated_at: string;
      databack_payload_json: string;
      databack_version: number | null;
      databack_fingerprint: string | null;
    }>();

  return (result.results ?? []).map((row) => ({
    databackFingerprint:
      typeof row.databack_fingerprint === 'string'
        ? row.databack_fingerprint
        : '',
    databackVersion: Number(row.databack_version ?? 0),
    payload: parseJsonObject(row.databack_payload_json),
    recordKey: row.record_key,
    updatedAt: row.updated_at,
  }));
}

export async function markMotherFormSyncFailure(
  db: D1Database,
  recordKey: string,
  errorMessage: string
): Promise<void> {
  const attemptedAt = nowIso();

  await db
    .prepare(
      `
        UPDATE nct_form
        SET mother_sync_status = 'failed',
            mother_sync_attempts = COALESCE(mother_sync_attempts, 0) + 1,
            mother_sync_last_error = ?,
            mother_sync_last_attempt_at = ?
        WHERE record_key = ?
      `
    )
    .bind(errorMessage, attemptedAt, recordKey)
    .run();
}

export async function markMotherFormSyncSuccess(
  db: D1Database,
  result: MotherFormSyncResult
): Promise<void> {
  const syncedAt = nowIso();

  await db
    .prepare(
      `
        UPDATE nct_form
        SET mother_sync_status = 'synced',
            mother_sync_attempts = COALESCE(mother_sync_attempts, 0) + 1,
            mother_sync_last_error = NULL,
            mother_sync_last_attempt_at = ?,
            mother_sync_last_success_at = ?,
            mother_assigned_version = ?
        WHERE record_key = ?
      `
    )
    .bind(
      syncedAt,
      syncedAt,
      result.motherVersion,
      result.recordKey
    )
    .run();

  await db
    .prepare(
      `
        UPDATE nct_databack
        SET version = ?,
            fingerprint = ?,
            updated_at = CASE
              WHEN version = ? AND fingerprint = ? THEN updated_at
              ELSE ?
            END
        WHERE record_key = ?
      `
    )
    .bind(
      result.motherVersion,
      result.databackFingerprint,
      result.motherVersion,
      result.databackFingerprint,
      syncedAt,
      result.recordKey
    )
    .run();
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

export async function getMotherSyncState(
  db: D1Database
): Promise<{
  currentVersion: number;
  lastPulledAt: string | null;
  motherSyncUrl: string | null;
}> {
  const result = await db
    .prepare(
      `
        SELECT payload_json
        FROM nct_form
        WHERE record_key = ?
      `
    )
    .bind(MOTHER_SYNC_STATE_RECORD_KEY)
    .first<{ payload_json: string | null }>();

  if (!result?.payload_json) {
    return {
      currentVersion: 0,
      lastPulledAt: null,
      motherSyncUrl: null,
    };
  }

  const payload = parseJsonObject(result.payload_json);
  const currentVersionCandidate = payload.currentVersion;
  const currentVersion =
    typeof currentVersionCandidate === 'number'
      ? Math.max(0, Math.trunc(currentVersionCandidate))
      : typeof currentVersionCandidate === 'string'
        ? Math.max(0, Number.parseInt(currentVersionCandidate, 10) || 0)
        : 0;

  return {
    currentVersion,
    lastPulledAt:
      typeof payload.lastPulledAt === 'string'
        ? payload.lastPulledAt
        : null,
    motherSyncUrl:
      typeof payload.motherSyncUrl === 'string'
        ? payload.motherSyncUrl
        : null,
  };
}

export async function writeMotherSyncState(
  db: D1Database,
  options: {
    currentVersion: number;
    lastPulledAt?: string | null;
    motherSyncUrl?: string | null;
  }
): Promise<void> {
  const receivedAt = nowIso();
  const rowId = crypto.randomUUID();
  const payloadJson = stableStringify({
    currentVersion: Math.max(0, Math.trunc(options.currentVersion)),
    kind: 'motherSyncState',
    lastPulledAt: options.lastPulledAt ?? receivedAt,
    motherSyncUrl: options.motherSyncUrl?.trim() || null,
    updatedAt: receivedAt,
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
          payload_json = excluded.payload_json,
          updated_at = excluded.updated_at
      `
    )
    .bind(
      rowId,
      MOTHER_SYNC_STATE_RECORD_KEY,
      payloadJson,
      receivedAt,
      receivedAt
    )
    .run();
}
