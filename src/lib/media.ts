import type {
  MotherMediaSyncRecord,
  MotherMediaSyncResult,
  SchoolMediaRecord,
  SchoolMediaStats,
  SchoolMediaStatus,
  SchoolMediaTag,
} from '../types';

const R18_TAG_ID = 'tag:r18';
const R18_TAG_SLUG = 'r18';
const DEFAULT_ALLOWED_MIME_TYPES = [
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/webm',
];
const DEFAULT_UPLOAD_MAX_BYTES = 100 * 1024 * 1024;
const MEDIA_FAST_RETRY_LIMIT = 5;
const MEDIA_FAST_RETRY_DELAY_MS = 60 * 1000;
const MEDIA_SLOW_RETRY_DELAY_MS = 30 * 60 * 1000;

type SchoolMediaRow = {
  id: string;
  object_key: string;
  public_url: string;
  media_type: 'image' | 'video';
  content_type: string;
  byte_size: number;
  file_name: string;
  school_name: string;
  school_name_norm: string;
  school_address: string;
  province: string;
  city: string;
  county: string;
  is_r18: number;
  status: SchoolMediaStatus;
  review_note: string | null;
  mother_sync_status: string;
  mother_sync_attempts: number;
  mother_sync_last_error: string | null;
  mother_sync_last_attempt_at: string | null;
  mother_sync_last_success_at: string | null;
  uploaded_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type MediaTagRow = {
  id: string;
  slug: string;
  label: string;
  normalized_label: string;
  is_system: number;
  created_at: string;
  updated_at: string;
};

export type MediaUploadPresignInput = {
  byteSize: unknown;
  city?: unknown;
  contentType: unknown;
  county?: unknown;
  fileName: unknown;
  isR18?: unknown;
  province?: unknown;
  schoolAddress?: unknown;
  schoolName: unknown;
  tags?: unknown;
};

export type MediaUploadCompleteInput = {
  mediaId: unknown;
};

export type MediaUploadDirectInput = Omit<
  MediaUploadPresignInput,
  'byteSize' | 'contentType' | 'fileName'
> & {
  file: File;
};

function nowIso(): string {
  return new Date().toISOString();
}

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function utf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

async function sha256Hex(value: string): Promise<string> {
  return bytesToHex(await crypto.subtle.digest('SHA-256', utf8(value)));
}

async function sha1BytesHex(value: ArrayBuffer): Promise<string> {
  return bytesToHex(await crypto.subtle.digest('SHA-1', value));
}

async function hmacBytes(
  key: Uint8Array | ArrayBuffer,
  value: string,
): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    {
      hash: 'SHA-256',
      name: 'HMAC',
    },
    false,
    ['sign'],
  );

  return crypto.subtle.sign('HMAC', cryptoKey, utf8(value));
}

async function hmacHex(
  key: Uint8Array | ArrayBuffer,
  value: string,
): Promise<string> {
  return bytesToHex(await hmacBytes(key, value));
}

function encodePathSegment(segment: string): string {
  return encodeURIComponent(segment).replaceAll('%2F', '/');
}

function encodeObjectKeyPath(objectKey: string): string {
  return objectKey
    .split('/')
    .map((segment) => encodePathSegment(segment))
    .join('/');
}

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeSchoolName(value: string): string {
  return normalizeSpaces(value).toLocaleLowerCase('zh-CN');
}

function slugify(value: string): string {
  const ascii = normalizeSpaces(value)
    .toLocaleLowerCase('zh-CN')
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return ascii || 'school';
}

function normalizeTagLabel(value: string): string {
  return normalizeSpaces(value).slice(0, 40);
}

function tagSlug(value: string): string {
  const normalized = normalizeTagLabel(value).toLocaleLowerCase('zh-CN');
  return normalized
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || `tag-${crypto.randomUUID()}`;
}

function getString(value: unknown, maxLength: number): string {
  return typeof value === 'string'
    ? normalizeSpaces(value).slice(0, maxLength)
    : '';
}

function getAllowedMimeTypes(env: Env): Set<string> {
  const configured = env.B2_ALLOWED_MIME_TYPES?.split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return new Set(configured?.length ? configured : DEFAULT_ALLOWED_MIME_TYPES);
}

function getUploadMaxBytes(env: Env): number {
  const configured = Number(env.B2_UPLOAD_MAX_BYTES ?? '');
  return Number.isFinite(configured) && configured > 0
    ? Math.trunc(configured)
    : DEFAULT_UPLOAD_MAX_BYTES;
}

function getMediaType(contentType: string): 'image' | 'video' {
  return contentType.startsWith('video/') ? 'video' : 'image';
}

function isMediaFile(value: unknown): value is File {
  return typeof value === 'object'
    && value !== null
    && typeof (value as { arrayBuffer?: unknown }).arrayBuffer === 'function'
    && typeof (value as { name?: unknown }).name === 'string'
    && typeof (value as { size?: unknown }).size === 'number'
    && typeof (value as { type?: unknown }).type === 'string';
}

function getExtension(fileName: string, contentType: string): string {
  const fromName = /\.([a-z0-9]{1,12})$/i.exec(fileName.trim())?.[1]?.toLowerCase();
  if (fromName) {
    return fromName;
  }

  const fallback: Record<string, string> = {
    'image/gif': 'gif',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
  };

  return fallback[contentType] ?? 'bin';
}

function resolveB2Config(env: Env): {
  applicationKey: string;
  applicationKeyId: string;
  bucketName: string;
  endpoint: URL;
  publicBaseUrl: string;
  region: string;
} {
  const applicationKeyId = env.B2_APPLICATION_KEY_ID?.trim();
  const applicationKey = env.B2_APPLICATION_KEY?.trim();
  const bucketName = env.B2_BUCKET_NAME?.trim();
  const endpointValue = env.B2_S3_ENDPOINT?.trim();
  const publicBaseUrl = env.B2_PUBLIC_BASE_URL?.trim();

  if (!applicationKeyId || !applicationKey || !bucketName || !endpointValue || !publicBaseUrl) {
    throw new Error('B2 media upload is not configured.');
  }

  const endpoint = new URL(endpointValue);
  const hostParts = endpoint.hostname.split('.');
  const region = hostParts[0] === 's3' && hostParts[1]
    ? hostParts[1]
    : 'us-west-004';

  return {
    applicationKey,
    applicationKeyId,
    bucketName,
    endpoint,
    publicBaseUrl: publicBaseUrl.replace(/\/+$/g, ''),
    region,
  };
}

async function getSigningKey(
  secret: string,
  dateStamp: string,
  region: string,
): Promise<ArrayBuffer> {
  const dateKey = await hmacBytes(utf8(`AWS4${secret}`), dateStamp);
  const regionKey = await hmacBytes(dateKey, region);
  const serviceKey = await hmacBytes(regionKey, 's3');
  return hmacBytes(serviceKey, 'aws4_request');
}

function amzDates(now = new Date()): {
  amzDate: string;
  dateStamp: string;
} {
  const iso = now.toISOString().replaceAll(/[:-]|\.\d{3}/g, '');
  return {
    amzDate: iso,
    dateStamp: iso.slice(0, 8),
  };
}

function canonicalQuery(params: URLSearchParams): string {
  return Array.from(params.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

async function presignPutUrl(
  env: Env,
  objectKey: string,
  expiresSeconds = 900,
): Promise<string> {
  const config = resolveB2Config(env);
  const { amzDate, dateStamp } = amzDates();
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const host = config.endpoint.host;
  const canonicalUri = `/${encodePathSegment(config.bucketName)}/${encodeObjectKeyPath(objectKey)}`;
  const params = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Content-Sha256': 'UNSIGNED-PAYLOAD',
    'X-Amz-Credential': `${config.applicationKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresSeconds),
    'X-Amz-SignedHeaders': 'host',
  });
  const canonicalRequest = [
    'PUT',
    canonicalUri,
    canonicalQuery(params),
    `host:${host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');
  const signature = await hmacHex(
    await getSigningKey(config.applicationKey, dateStamp, config.region),
    stringToSign,
  );
  params.set('X-Amz-Signature', signature);

  return `${config.endpoint.origin}${canonicalUri}?${canonicalQuery(params)}`;
}

async function signedB2Head(
  env: Env,
  objectKey: string,
): Promise<Response> {
  const config = resolveB2Config(env);
  const { amzDate, dateStamp } = amzDates();
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const host = config.endpoint.host;
  const canonicalUri = `/${encodePathSegment(config.bucketName)}/${encodeObjectKeyPath(objectKey)}`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [
    'HEAD',
    canonicalUri,
    '',
    `host:${host}\nx-amz-content-sha256:UNSIGNED-PAYLOAD\nx-amz-date:${amzDate}\n`,
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');
  const signature = await hmacHex(
    await getSigningKey(config.applicationKey, dateStamp, config.region),
    stringToSign,
  );
  const authorization = [
    `AWS4-HMAC-SHA256 Credential=${config.applicationKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(', ');

  return fetch(`${config.endpoint.origin}${canonicalUri}`, {
    method: 'HEAD',
    headers: {
      authorization,
      'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
      'x-amz-date': amzDate,
    },
  });
}

function buildPublicUrl(env: Env, objectKey: string): string {
  return `${resolveB2Config(env).publicBaseUrl}/${encodeObjectKeyPath(objectKey)}`;
}

type B2NativeAuth = {
  accountId: string;
  apiInfo: {
    storageApi: {
      apiUrl: string;
    };
  };
  authorizationToken: string;
};

type B2BucketListResponse = {
  buckets?: Array<{
    bucketId: string;
    bucketName: string;
  }>;
};

type B2UploadUrlResponse = {
  authorizationToken: string;
  uploadUrl: string;
};

function encodeB2FileName(value: string): string {
  return encodeURIComponent(value).replaceAll('*', '%2A');
}

async function readB2Error(response: Response): Promise<string> {
  const text = await response.text().catch(() => '');
  if (!text) {
    return `B2 request failed: ${response.status}.`;
  }

  try {
    const payload = JSON.parse(text) as {
      code?: unknown;
      message?: unknown;
    };
    if (typeof payload.message === 'string') {
      return typeof payload.code === 'string'
        ? `${payload.code}: ${payload.message}`
        : payload.message;
    }
  } catch {
    // Native and S3 APIs return different error formats; keep raw XML/text when it is not JSON.
  }

  return text;
}

async function authorizeB2Native(
  config: ReturnType<typeof resolveB2Config>,
): Promise<B2NativeAuth> {
  const response = await fetch('https://api.backblazeb2.com/b2api/v3/b2_authorize_account', {
    headers: {
      authorization: `Basic ${btoa(`${config.applicationKeyId}:${config.applicationKey}`)}`,
    },
  });
  if (!response.ok) {
    throw new Error(await readB2Error(response));
  }

  return response.json<B2NativeAuth>();
}

async function b2JsonPost<T>(
  url: string,
  authorizationToken: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: authorizationToken,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(await readB2Error(response));
  }

  return response.json<T>();
}

async function findB2BucketId(
  config: ReturnType<typeof resolveB2Config>,
  auth: B2NativeAuth,
): Promise<string> {
  const payload = await b2JsonPost<B2BucketListResponse>(
    `${auth.apiInfo.storageApi.apiUrl}/b2api/v3/b2_list_buckets`,
    auth.authorizationToken,
    {
      accountId: auth.accountId,
      bucketName: config.bucketName,
    },
  );
  const bucket = payload.buckets?.find((item) => item.bucketName === config.bucketName);
  if (!bucket) {
    throw new Error('B2 bucket was not found.');
  }

  return bucket.bucketId;
}

async function uploadB2Native(
  env: Env,
  objectKey: string,
  file: File,
  contentType: string,
): Promise<void> {
  const config = resolveB2Config(env);
  const auth = await authorizeB2Native(config);
  const bucketId = await findB2BucketId(config, auth);
  const upload = await b2JsonPost<B2UploadUrlResponse>(
    `${auth.apiInfo.storageApi.apiUrl}/b2api/v3/b2_get_upload_url`,
    auth.authorizationToken,
    {
      bucketId,
    },
  );
  const payload = await file.arrayBuffer();
  const sha1 = await sha1BytesHex(payload);
  const response = await fetch(upload.uploadUrl, {
    method: 'POST',
    headers: {
      authorization: upload.authorizationToken,
      'content-type': contentType,
      'x-bz-content-sha1': sha1,
      'x-bz-file-name': encodeB2FileName(objectKey),
    },
    body: payload,
  });
  if (!response.ok) {
    throw new Error(await readB2Error(response));
  }
}

function mapTag(row: MediaTagRow): SchoolMediaTag {
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    isSystem: Boolean(row.is_system),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listTagsForMedia(
  db: D1Database,
  mediaId: string,
): Promise<SchoolMediaTag[]> {
  const result = await db.prepare(
    `
      SELECT tags.*
      FROM media_tags AS tags
      INNER JOIN school_media_tags AS links
        ON links.tag_id = tags.id
      WHERE links.media_id = ?
      ORDER BY tags.is_system DESC, tags.label ASC
    `,
  )
    .bind(mediaId)
    .all<MediaTagRow>();

  return (result.results ?? []).map(mapTag);
}

async function mapMediaRecord(
  db: D1Database,
  row: SchoolMediaRow,
): Promise<SchoolMediaRecord> {
  return {
    id: row.id,
    objectKey: row.object_key,
    publicUrl: row.public_url,
    mediaType: row.media_type,
    contentType: row.content_type,
    byteSize: Number(row.byte_size),
    fileName: row.file_name,
    schoolName: row.school_name,
    schoolNameNorm: row.school_name_norm,
    schoolAddress: row.school_address,
    province: row.province,
    city: row.city,
    county: row.county,
    isR18: Boolean(row.is_r18),
    status: row.status,
    reviewNote: row.review_note,
    uploadedAt: row.uploaded_at,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags: await listTagsForMedia(db, row.id),
  };
}

async function ensureR18Tag(db: D1Database): Promise<SchoolMediaTag> {
  const now = nowIso();
  await db.prepare(
    `
      INSERT INTO media_tags (
        id,
        slug,
        label,
        normalized_label,
        is_system,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(slug) DO UPDATE SET
        label = excluded.label,
        normalized_label = excluded.normalized_label,
        is_system = 1,
        updated_at = excluded.updated_at
    `,
  )
    .bind(R18_TAG_ID, R18_TAG_SLUG, 'R18', 'r18', now, now)
    .run();

  const tag = await db.prepare(
    `
      SELECT *
      FROM media_tags
      WHERE slug = ?
      LIMIT 1
    `,
  )
    .bind(R18_TAG_SLUG)
    .first<MediaTagRow>();

  if (!tag) {
    throw new Error('Failed to initialize R18 media tag.');
  }

  return mapTag(tag);
}

async function ensureTag(
  db: D1Database,
  label: string,
): Promise<SchoolMediaTag> {
  const normalizedLabel = normalizeTagLabel(label);
  if (!normalizedLabel) {
    throw new Error('Media tag is empty.');
  }
  if (normalizedLabel.toLocaleLowerCase('zh-CN') === R18_TAG_SLUG) {
    return ensureR18Tag(db);
  }

  const slug = tagSlug(normalizedLabel);
  const now = nowIso();
  const id = `tag:${slug}`;

  await db.prepare(
    `
      INSERT INTO media_tags (
        id,
        slug,
        label,
        normalized_label,
        is_system,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, 0, ?, ?)
      ON CONFLICT(normalized_label) DO UPDATE SET
        label = excluded.label,
        updated_at = excluded.updated_at
    `,
  )
    .bind(
      id,
      slug,
      normalizedLabel,
      normalizedLabel.toLocaleLowerCase('zh-CN'),
      now,
      now,
    )
    .run();

  const tag = await db.prepare(
    `
      SELECT *
      FROM media_tags
      WHERE normalized_label = ?
      LIMIT 1
    `,
  )
    .bind(normalizedLabel.toLocaleLowerCase('zh-CN'))
    .first<MediaTagRow>();

  if (!tag) {
    throw new Error('Failed to store media tag.');
  }

  return mapTag(tag);
}

async function ensureTags(
  db: D1Database,
  labels: string[],
  isR18: boolean,
): Promise<SchoolMediaTag[]> {
  const unique = new Map<string, string>();
  for (const label of labels) {
    const normalized = normalizeTagLabel(label);
    if (normalized) {
      unique.set(normalized.toLocaleLowerCase('zh-CN'), normalized);
    }
  }

  const tags = [];
  if (isR18) {
    tags.push(await ensureR18Tag(db));
  }
  for (const label of unique.values()) {
    const tag = await ensureTag(db, label);
    if (!tags.some((item) => item.id === tag.id)) {
      tags.push(tag);
    }
  }

  return tags;
}

function parseTagLabels(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => getString(item, 40))
      .filter(Boolean)
      .slice(0, 12);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => getString(item, 40))
      .filter(Boolean)
      .slice(0, 12);
  }
  return [];
}

function tagsContainR18(labels: string[]): boolean {
  return labels.some((label) => (
    normalizeTagLabel(label).toLocaleLowerCase('zh-CN') === R18_TAG_SLUG
  ));
}

function validatePresignInput(
  env: Env,
  input: MediaUploadPresignInput,
): {
  byteSize: number;
  city: string;
  contentType: string;
  county: string;
  fileName: string;
  isR18: boolean;
  province: string;
  schoolAddress: string;
  schoolName: string;
  tags: string[];
} {
  const schoolName = getString(input.schoolName, 120);
  const fileName = getString(input.fileName, 160);
  const contentType = getString(input.contentType, 120).toLowerCase();
  const byteSize = Number(input.byteSize);
  const tags = parseTagLabels(input.tags);
  const isR18 = tagsContainR18(tags);

  if (!schoolName) {
    throw new Error('School name is required.');
  }
  if (!fileName) {
    throw new Error('File name is required.');
  }
  if (!getAllowedMimeTypes(env).has(contentType)) {
    throw new Error('Media content type is not allowed.');
  }
  if (!Number.isFinite(byteSize) || byteSize <= 0 || byteSize > getUploadMaxBytes(env)) {
    throw new Error('Media file size is invalid.');
  }

  return {
    byteSize: Math.trunc(byteSize),
    city: getString(input.city, 80),
    contentType,
    county: getString(input.county, 80),
    fileName,
    isR18,
    province: getString(input.province, 80),
    schoolAddress: getString(input.schoolAddress, 200),
    schoolName,
    tags,
  };
}

export async function listMediaTags(
  db: D1Database,
): Promise<SchoolMediaTag[]> {
  await ensureR18Tag(db);
  const result = await db.prepare(
    `
      SELECT *
      FROM media_tags
      ORDER BY is_system DESC, label ASC
    `,
  ).all<MediaTagRow>();

  return (result.results ?? []).map(mapTag);
}

export async function createMediaUpload(
  env: Env,
  input: MediaUploadPresignInput,
): Promise<{
  headers: Record<string, string>;
  media: SchoolMediaRecord;
  method: 'PUT';
  uploadUrl: string;
}> {
  const values = validatePresignInput(env, input);
  const tags = await ensureTags(env.DB, values.tags, values.isR18);
  const mediaId = crypto.randomUUID();
  const schoolSlug = slugify(values.schoolName).slice(0, 80);
  const year = new Date().getUTCFullYear();
  const objectKey = [
    'media',
    'schools',
    schoolSlug,
    String(year),
    `${mediaId}.${getExtension(values.fileName, values.contentType)}`,
  ].join('/');
  const publicUrl = buildPublicUrl(env, objectKey);
  const createdAt = nowIso();

  await env.DB.prepare(
    `
      INSERT INTO school_media (
        id,
        object_key,
        public_url,
        media_type,
        content_type,
        byte_size,
        file_name,
        school_name,
        school_name_norm,
        school_address,
        province,
        city,
        county,
        is_r18,
        status,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'uploading', ?, ?)
    `,
  )
    .bind(
      mediaId,
      objectKey,
      publicUrl,
      getMediaType(values.contentType),
      values.contentType,
      values.byteSize,
      values.fileName,
      values.schoolName,
      normalizeSchoolName(values.schoolName),
      values.schoolAddress,
      values.province,
      values.city,
      values.county,
      values.isR18 ? 1 : 0,
      createdAt,
      createdAt,
    )
    .run();

  for (const tag of tags) {
    await env.DB.prepare(
      `
        INSERT OR IGNORE INTO school_media_tags (
          media_id,
          tag_id
        )
        VALUES (?, ?)
      `,
    )
      .bind(mediaId, tag.id)
      .run();
  }

  const stored = await readMediaRecord(env.DB, mediaId);
  if (!stored) {
    throw new Error('Failed to create media record.');
  }

  return {
    headers: {
      'content-type': values.contentType,
    },
    media: stored,
    method: 'PUT',
    uploadUrl: await presignPutUrl(env, objectKey),
  };
}

export async function readMediaRecord(
  db: D1Database,
  mediaId: string,
): Promise<SchoolMediaRecord | null> {
  const row = await db.prepare(
    `
      SELECT *
      FROM school_media
      WHERE id = ?
      LIMIT 1
    `,
  )
    .bind(mediaId)
    .first<SchoolMediaRow>();

  return row ? mapMediaRecord(db, row) : null;
}

export async function completeMediaUpload(
  env: Env,
  input: MediaUploadCompleteInput,
): Promise<SchoolMediaRecord> {
  const mediaId = getString(input.mediaId, 80);
  if (!mediaId) {
    throw new Error('Media id is required.');
  }

  const media = await readMediaRecord(env.DB, mediaId);
  if (!media) {
    throw new Error('Media record was not found.');
  }

  const headResponse = await signedB2Head(env, media.objectKey);
  if (!headResponse.ok) {
    throw new Error(`B2 object was not found after upload: ${headResponse.status}.`);
  }
  const uploadedSize = Number(headResponse.headers.get('content-length') ?? '');
  if (Number.isFinite(uploadedSize) && uploadedSize > 0 && uploadedSize !== media.byteSize) {
    throw new Error('B2 object size does not match the presigned upload record.');
  }

  const uploadedAt = nowIso();
  await env.DB.prepare(
    `
      UPDATE school_media
      SET status = 'pending_review',
          mother_sync_status = 'pending',
          mother_sync_last_error = NULL,
          uploaded_at = COALESCE(uploaded_at, ?),
          updated_at = ?
      WHERE id = ?
    `,
  )
    .bind(uploadedAt, uploadedAt, mediaId)
    .run();

  const stored = await readMediaRecord(env.DB, mediaId);
  if (!stored) {
    throw new Error('Failed to read completed media record.');
  }

  return stored;
}

async function markMediaUploadComplete(
  db: D1Database,
  mediaId: string,
): Promise<SchoolMediaRecord> {
  const uploadedAt = nowIso();
  await db.prepare(
    `
      UPDATE school_media
      SET status = 'pending_review',
          mother_sync_status = 'pending',
          mother_sync_last_error = NULL,
          uploaded_at = COALESCE(uploaded_at, ?),
          updated_at = ?
      WHERE id = ?
    `,
  )
    .bind(uploadedAt, uploadedAt, mediaId)
    .run();

  const stored = await readMediaRecord(db, mediaId);
  if (!stored) {
    throw new Error('Failed to read completed media record.');
  }

  return stored;
}

export async function uploadMediaDirect(
  env: Env,
  input: MediaUploadDirectInput,
): Promise<SchoolMediaRecord> {
  const file = input.file;
  if (!isMediaFile(file)) {
    throw new Error('Media file is required.');
  }

  const upload = await createMediaUpload(env, {
    ...input,
    byteSize: file.size,
    contentType: file.type || 'application/octet-stream',
    fileName: file.name,
  });
  await uploadB2Native(env, upload.media.objectKey, file, upload.media.contentType);

  return markMediaUploadComplete(env.DB, upload.media.id);
}

export async function getSchoolMediaStats(
  db: D1Database,
): Promise<SchoolMediaStats> {
  const row = await db.prepare(
    `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'pending_review' THEN 1 ELSE 0 END) AS pendingReview,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
        SUM(CASE WHEN is_r18 = 1 THEN 1 ELSE 0 END) AS r18,
        COUNT(DISTINCT school_name_norm) AS schools
      FROM school_media
      WHERE status != 'uploading'
    `,
  ).first<SchoolMediaStats>();

  return {
    approved: Number(row?.approved ?? 0),
    pendingReview: Number(row?.pendingReview ?? 0),
    rejected: Number(row?.rejected ?? 0),
    r18: Number(row?.r18 ?? 0),
    schools: Number(row?.schools ?? 0),
    total: Number(row?.total ?? 0),
  };
}

function mediaRetryDelayMs(attemptCount: number): number {
  return attemptCount > MEDIA_FAST_RETRY_LIMIT
    ? MEDIA_SLOW_RETRY_DELAY_MS
    : MEDIA_FAST_RETRY_DELAY_MS;
}

export async function listPendingMotherMediaSyncRecords(
  db: D1Database,
  limit = 20,
): Promise<MotherMediaSyncRecord[]> {
  const fastRetryBefore = new Date(
    Date.now() - mediaRetryDelayMs(MEDIA_FAST_RETRY_LIMIT),
  ).toISOString();
  const slowRetryBefore = new Date(
    Date.now() - mediaRetryDelayMs(MEDIA_FAST_RETRY_LIMIT + 1),
  ).toISOString();
  const result = await db.prepare(
    `
      SELECT *
      FROM school_media
      WHERE status != 'uploading'
        AND COALESCE(mother_sync_status, 'pending') != 'synced'
        AND (
          COALESCE(mother_sync_status, 'pending') = 'pending'
          OR mother_sync_last_attempt_at IS NULL
          OR (
            COALESCE(mother_sync_attempts, 0) <= ?
            AND mother_sync_last_attempt_at <= ?
          )
          OR (
            COALESCE(mother_sync_attempts, 0) > ?
            AND mother_sync_last_attempt_at <= ?
          )
        )
      ORDER BY updated_at ASC
      LIMIT ?
    `,
  )
    .bind(
      MEDIA_FAST_RETRY_LIMIT,
      fastRetryBefore,
      MEDIA_FAST_RETRY_LIMIT,
      slowRetryBefore,
      Math.max(1, Math.min(limit, 200)),
    )
    .all<SchoolMediaRow>();

  const records = [];
  for (const row of result.results ?? []) {
    const media = await mapMediaRecord(db, row);
    records.push({
      byteSize: media.byteSize,
      city: media.city,
      contentType: media.contentType,
      county: media.county,
      fileName: media.fileName,
      id: media.id,
      isR18: media.isR18,
      mediaType: media.mediaType,
      objectKey: media.objectKey,
      province: media.province,
      publicUrl: media.publicUrl,
      schoolAddress: media.schoolAddress,
      schoolName: media.schoolName,
      schoolNameNorm: media.schoolNameNorm,
      tags: media.tags.map((tag) => ({
        label: tag.label,
        slug: tag.slug,
        isSystem: tag.isSystem,
      })),
      updatedAt: media.updatedAt,
      uploadedAt: media.uploadedAt,
    });
  }

  return records;
}

export async function markMotherMediaSyncFailure(
  db: D1Database,
  mediaId: string,
  errorMessage: string,
): Promise<void> {
  const attemptedAt = nowIso();
  await db.prepare(
    `
      UPDATE school_media
      SET mother_sync_status = 'failed',
          mother_sync_attempts = COALESCE(mother_sync_attempts, 0) + 1,
          mother_sync_last_error = ?,
          mother_sync_last_attempt_at = ?
      WHERE id = ?
    `,
  )
    .bind(errorMessage, attemptedAt, mediaId)
    .run();
}

export async function markMotherMediaSyncSuccess(
  db: D1Database,
  result: MotherMediaSyncResult,
): Promise<void> {
  const syncedAt = nowIso();
  await db.prepare(
    `
      UPDATE school_media
      SET mother_sync_status = 'synced',
          mother_sync_attempts = COALESCE(mother_sync_attempts, 0) + 1,
          mother_sync_last_error = NULL,
          mother_sync_last_attempt_at = ?,
          mother_sync_last_success_at = ?,
          updated_at = updated_at
      WHERE id = ?
    `,
  )
    .bind(syncedAt, syncedAt, result.mediaId)
    .run();
}
