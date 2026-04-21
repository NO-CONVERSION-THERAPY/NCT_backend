export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  | JsonPrimitive
  | JsonObject
  | JsonValue[];

export type JsonObject = {
  [key: string]: JsonValue;
};

export interface EncryptedEnvelope {
  algorithm: 'AES-GCM';
  iv: string;
  ciphertext: string;
}

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

export interface RecordWriteInput {
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
  serviceUrl: string;
  databackVersion: number | null;
  reportCount: number;
  reportedAt: string;
}

export interface MotherPushRecord {
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

export interface MotherReportResult {
  delivered: boolean;
  skipped: boolean;
  reason?: string;
  payload?: MotherReportPayload;
  responseCode?: number | null;
}

export interface MotherDatabackExportRecord {
  recordKey: string;
  version: number;
  fingerprint: string;
  payload: SecureTransferPayload;
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
