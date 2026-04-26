export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  | JsonPrimitive
  | JsonObject
  | JsonValue[];

export type JsonObject = {
  [key: string]: JsonValue;
};

export interface AesGcmEncryptedEnvelope {
  algorithm: 'AES-GCM';
  iv: string;
  ciphertext: string;
}

export type EncryptedEnvelope = AesGcmEncryptedEnvelope;

export interface SecureTransferPayload {
  keyVersion: number;
  publicData: JsonObject;
  encryptedData: EncryptedEnvelope;
  encryptFields: string[];
  syncedAt: string | null;
}

export type DynamicTableName =
  | 'nct_form'
  | 'nct_databack';

export type DataSourceType =
  | 'questionnaire'
  | 'batch_query';

export interface RecordWriteInput {
  dataSourceType?: DataSourceType;
  recordKey?: string;
  payload: JsonObject;
}

export interface RecordWriteRequest {
  table: DynamicTableName;
  recordKey?: string;
  payload: JsonObject;
  mirrorToDataback?: boolean;
}

export interface RecordQueryOptions {
  recordKey?: string;
  limit?: number;
}

export interface TableRecord {
  dataSourceType: DataSourceType;
  id: string;
  recordKey: string;
  payload: JsonObject;
  dynamicColumns: Record<string, string | null>;
  version?: number;
  fingerprint?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MotherReportPayload {
  service: string;
  serviceWatermark: string;
  serviceUrl: string;
  databackVersion: number | null;
  reportCount: number;
  reportedAt: string;
}

export interface MotherPushRecord {
  dataSourceType?: DataSourceType;
  recordKey: string;
  version: number;
  fingerprint: string;
  payload: SecureTransferPayload;
}

export interface MotherPushPayload {
  service: string;
  mode: 'full' | 'delta';
  previousVersion: number;
  currentVersion: number;
  totalRecords: number;
  records: MotherPushRecord[];
  generatedAt: string;
}

export interface MotherPublishedSecureRecord {
  recordKey: string;
  version: number;
  keyVersion: number;
  publicData: JsonObject;
  encryptedData: EncryptedEnvelope;
  encryptFields: string[];
  fingerprint: string;
  syncedAt: string | null;
}

export interface MotherPublishedSyncPayload {
  mode: 'full' | 'delta';
  previousVersion: number;
  currentVersion: number;
  totalRecords: number;
  records: MotherPublishedSecureRecord[];
  generatedAt: string;
}

export interface MotherReportResult {
  delivered: boolean;
  skipped: boolean;
  reason?: string;
  payload?: MotherReportPayload;
  responseCode?: number | null;
}

export interface MotherDatabackExportRecord {
  dataSourceType: DataSourceType;
  payload: JsonObject | SecureTransferPayload;
  payloadEncryptionState: 'plain-json' | 'secure-transfer';
  recordKey: string;
  version: number;
  fingerprint: string;
  updatedAt: string;
}

export interface MotherDatabackExportFile {
  service: string;
  serviceUrl: string;
  afterVersion: number;
  currentVersion: number | null;
  exportedAt: string;
  totalRecords: number;
  records: MotherDatabackExportRecord[];
}

export interface MotherFormSyncRecord {
  databackFingerprint: string;
  databackVersion: number;
  payload: JsonObject;
  recordKey: string;
  updatedAt: string;
}

export interface MotherFormSyncResult {
  databackFingerprint: string;
  motherVersion: number;
  updated: boolean;
  recordKey: string;
}
