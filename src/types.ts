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
  serviceWatermark: string;
  serviceUrl: string;
  databackVersion: number | null;
  reportCount: number;
  reportedAt: string;
  mediaStats?: SchoolMediaStats;
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

export type SchoolMediaStatus =
  | 'uploading'
  | 'pending_review'
  | 'approved'
  | 'rejected';

export interface SchoolMediaTag {
  id: string;
  slug: string;
  label: string;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SchoolMediaRecord {
  id: string;
  objectKey: string;
  publicUrl: string;
  mediaType: 'image' | 'video';
  contentType: string;
  byteSize: number;
  fileName: string;
  schoolName: string;
  schoolNameNorm: string;
  schoolAddress: string;
  province: string;
  city: string;
  county: string;
  isR18: boolean;
  status: SchoolMediaStatus;
  reviewNote: string | null;
  uploadedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  tags: SchoolMediaTag[];
}

export interface SchoolMediaStats {
  approved: number;
  pendingReview: number;
  rejected: number;
  r18: number;
  schools: number;
  total: number;
}

export interface MotherMediaSyncRecord {
  byteSize: number;
  city: string;
  contentType: string;
  county: string;
  fileName: string;
  id: string;
  isR18: boolean;
  mediaType: 'image' | 'video';
  objectKey: string;
  province: string;
  publicUrl: string;
  schoolAddress: string;
  schoolName: string;
  schoolNameNorm: string;
  tags: Array<{
    label: string;
    slug: string;
    isSystem: boolean;
  }>;
  updatedAt: string;
  uploadedAt: string | null;
}

export interface MotherMediaSyncResult {
  mediaId: string;
  updated: boolean;
}
