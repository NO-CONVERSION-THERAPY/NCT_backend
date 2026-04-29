import { afterEach, describe, expect, it, vi } from 'vitest';
import { completeMediaUpload, getMediaSubmitTarget, uploadMediaDirect } from './media';

type StoredMediaRow = {
  byte_size: number;
  city: string;
  content_type: string;
  county: string;
  created_at: string;
  file_name: string;
  id: string;
  is_r18: number;
  media_type: 'image' | 'video';
  mother_sync_attempts: number;
  mother_sync_last_attempt_at: string | null;
  mother_sync_last_error: string | null;
  mother_sync_last_success_at: string | null;
  mother_sync_status: string;
  mother_object_sync_attempts: number;
  mother_object_sync_last_attempt_at: string | null;
  mother_object_sync_last_error: string | null;
  mother_object_sync_last_success_at: string | null;
  mother_object_sync_status: string;
  object_key: string;
  province: string;
  public_url: string;
  review_note: string | null;
  reviewed_at: string | null;
  school_address: string;
  school_name: string;
  school_name_norm: string;
  status: string;
  updated_at: string;
  uploaded_at: string | null;
};

function createMediaDb(seedRow?: StoredMediaRow) {
  let row: StoredMediaRow | null = seedRow ?? null;

  return {
    db: {
      prepare(sql: string) {
        return {
          bind(...params: unknown[]) {
            return {
              all: async () => {
                if (sql.includes('FROM media_tags AS tags')) {
                  return { results: [] };
                }
                throw new Error(`Unexpected all SQL: ${sql}`);
              },
              first: async () => {
                if (sql.includes('FROM school_media') && sql.includes('WHERE id = ?')) {
                  return row;
                }
                throw new Error(`Unexpected first SQL: ${sql}`);
              },
              run: async () => {
                if (sql.includes('INSERT INTO school_media')) {
                  const [
                    id,
                    objectKey,
                    publicUrl,
                    mediaType,
                    contentType,
                    byteSize,
                    fileName,
                    schoolName,
                    schoolNameNorm,
                    schoolAddress,
                    province,
                    city,
                    county,
                    isR18,
                    createdAt,
                    updatedAt,
                  ] = params;
                  row = {
                    byte_size: Number(byteSize),
                    city: String(city),
                    content_type: String(contentType),
                    county: String(county),
                    created_at: String(createdAt),
                    file_name: String(fileName),
                    id: String(id),
                    is_r18: Number(isR18),
                    media_type: mediaType as 'image' | 'video',
                    mother_sync_attempts: 0,
                    mother_sync_last_attempt_at: null,
                    mother_sync_last_error: null,
                    mother_sync_last_success_at: null,
                    mother_sync_status: 'pending',
                    mother_object_sync_attempts: 0,
                    mother_object_sync_last_attempt_at: null,
                    mother_object_sync_last_error: null,
                    mother_object_sync_last_success_at: null,
                    mother_object_sync_status: 'pending',
                    object_key: String(objectKey),
                    province: String(province),
                    public_url: String(publicUrl),
                    review_note: null,
                    reviewed_at: null,
                    school_address: String(schoolAddress),
                    school_name: String(schoolName),
                    school_name_norm: String(schoolNameNorm),
                    status: 'uploading',
                    updated_at: String(updatedAt),
                    uploaded_at: null,
                  };
                  return {};
                }

                if (sql.includes('UPDATE school_media')) {
                  if (row) {
                    row.status = 'pending_review';
                    row.uploaded_at = String(params[0]);
                    row.updated_at = String(params[1]);
                  }
                  return {};
                }

                throw new Error(`Unexpected run SQL: ${sql}`);
              },
            };
          },
        };
      },
    } as unknown as D1Database,
    getRow: () => row,
  };
}

function stubB2DirectUploadFetch() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === 'https://api.backblazeb2.com/b2api/v3/b2_authorize_account') {
      return Response.json({
        accountId: 'account-id',
        apiInfo: {
          storageApi: {
            apiUrl: 'https://b2-api.example',
          },
        },
        authorizationToken: 'b2-auth',
      });
    }
    if (url === 'https://b2-api.example/b2api/v3/b2_list_buckets') {
      return Response.json({
        buckets: [
          {
            bucketId: 'bucket-id',
            bucketName: 'jiaozheng',
          },
        ],
      });
    }
    if (url === 'https://b2-api.example/b2api/v3/b2_get_upload_url') {
      return Response.json({
        authorizationToken: 'upload-auth',
        uploadUrl: 'https://upload.example/media',
      });
    }
    if (url === 'https://upload.example/media') {
      return new Response(null, { status: 200 });
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('media uploads', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stores direct B2-only uploads in D1', async () => {
    const { db, getRow } = createMediaDb();
    const fetchMock = stubB2DirectUploadFetch();
    const file = new File(['media-bytes'], 'gate.png', { type: 'image/png' });

    const media = await uploadMediaDirect({
      B2_APPLICATION_KEY: 'application-key',
      B2_APPLICATION_KEY_ID: 'application-key-id',
      DB: db,
      NO_TORSION_MEDIA_SUBMIT_TARGET: 'b2',
    } as Env, {
      file,
      schoolName: 'B2 School',
      tags: [],
    });

    expect(media.status).toBe('pending_review');
    expect(media.publicUrl).toMatch(/^https:\/\/f003\.backblazeb2\.com\/file\/jiaozheng\//);
    expect(getRow()).toMatchObject({
      content_type: 'image/png',
      school_name: 'B2 School',
      status: 'pending_review',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://upload.example/media',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('stores direct R2-only uploads in D1', async () => {
    const { db, getRow } = createMediaDb();
    const r2Put = vi.fn(async () => null);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const file = new File(['media-bytes'], 'gate.png', { type: 'image/png' });

    const media = await uploadMediaDirect({
      DB: db,
      MEDIA_BUCKET: {
        put: r2Put,
      } as unknown as R2Bucket,
      NO_TORSION_MEDIA_SUBMIT_TARGET: 'r2',
    } as Env, {
      file,
      schoolName: 'R2 School',
      tags: [],
    });

    expect(media.status).toBe('pending_review');
    expect(media.publicUrl).toBe(`/api/media/files/${media.objectKey}`);
    expect(getRow()).toMatchObject({
      content_type: 'image/png',
      school_name: 'R2 School',
      status: 'pending_review',
    });
    expect(r2Put).toHaveBeenCalledWith(
      media.objectKey,
      file,
      expect.objectContaining({
        httpMetadata: {
          contentType: 'image/png',
        },
      }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('builds absolute R2 public URLs from bare configured service hosts', async () => {
    const { db } = createMediaDb();
    const r2Put = vi.fn(async () => null);
    vi.stubGlobal('fetch', vi.fn());
    const file = new File(['media-bytes'], 'gate.png', { type: 'image/png' });

    const media = await uploadMediaDirect({
      DB: db,
      MEDIA_BUCKET: {
        put: r2Put,
      } as unknown as R2Bucket,
      NO_TORSION_MEDIA_SUBMIT_TARGET: 'r2',
      SERVICE_PUBLIC_URL: 'testbk.medicago.top',
    } as Env, {
      file,
      schoolName: 'R2 School',
      tags: [],
    });

    expect(media.publicUrl).toBe(`https://testbk.medicago.top/api/media/files/${media.objectKey}`);
  });

  it('uses the request origin fallback for R2 public URLs', async () => {
    const { db } = createMediaDb();
    const r2Put = vi.fn(async () => null);
    vi.stubGlobal('fetch', vi.fn());
    const file = new File(['media-bytes'], 'gate.png', { type: 'image/png' });

    const media = await uploadMediaDirect({
      DB: db,
      MEDIA_BUCKET: {
        put: r2Put,
      } as unknown as R2Bucket,
      NO_TORSION_MEDIA_SUBMIT_TARGET: 'r2',
    } as Env, {
      file,
      schoolName: 'R2 School',
      tags: [],
    }, {
      fallbackOrigin: 'https://request.example.test',
    });

    expect(media.publicUrl).toBe(`https://request.example.test/api/media/files/${media.objectKey}`);
  });

  it('mirrors direct uploads to R2 when media submit target is both', async () => {
    const { db } = createMediaDb();
    const r2Put = vi.fn(async () => null);
    const fetchMock = stubB2DirectUploadFetch();

    const file = new File(['media-bytes'], 'gate.png', { type: 'image/png' });
    const media = await uploadMediaDirect({
      B2_APPLICATION_KEY: 'application-key',
      B2_APPLICATION_KEY_ID: 'application-key-id',
      DB: db,
      MEDIA_BUCKET: {
        put: r2Put,
      } as unknown as R2Bucket,
      NO_TORSION_MEDIA_SUBMIT_TARGET: 'both',
    } as Env, {
      file,
      schoolName: 'Example School',
      tags: [],
    });

    expect(media.status).toBe('pending_review');
    expect(r2Put).toHaveBeenCalledTimes(1);
    expect(r2Put).toHaveBeenCalledWith(
      media.objectKey,
      file,
      expect.objectContaining({
        httpMetadata: {
          contentType: 'image/png',
        },
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://upload.example/media',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('normalizes media submit target values to lowercase options', () => {
    expect(getMediaSubmitTarget({
      NO_TORSION_MEDIA_SUBMIT_TARGET: 'R2',
    } as Env)).toBe('r2');
    expect(getMediaSubmitTarget({
      NO_TORSION_MEDIA_SUBMIT_TARGET: 'Both',
    } as Env)).toBe('both');
  });

  it('falls back to both for unsupported media submit targets', () => {
    expect(getMediaSubmitTarget({
      NO_TORSION_MEDIA_SUBMIT_TARGET: 'cloudflare',
    } as Env)).toBe('both');
  });

  it('copies completed presigned B2 uploads to R2 when media submit target is both', async () => {
    const seedRow: StoredMediaRow = {
      byte_size: 11,
      city: '',
      content_type: 'image/png',
      county: '',
      created_at: '2026-01-01T00:00:00.000Z',
      file_name: 'gate.png',
      id: 'media-id',
      is_r18: 0,
      media_type: 'image',
      mother_sync_attempts: 0,
      mother_sync_last_attempt_at: null,
      mother_sync_last_error: null,
      mother_sync_last_success_at: null,
      mother_sync_status: 'pending',
      mother_object_sync_attempts: 0,
      mother_object_sync_last_attempt_at: null,
      mother_object_sync_last_error: null,
      mother_object_sync_last_success_at: null,
      mother_object_sync_status: 'pending',
      object_key: 'media/schools/example/2026/media-id.png',
      province: '',
      public_url: 'https://f003.backblazeb2.com/file/jiaozheng/media/schools/example/2026/media-id.png',
      review_note: null,
      reviewed_at: null,
      school_address: '',
      school_name: 'Example School',
      school_name_norm: 'example school',
      status: 'uploading',
      updated_at: '2026-01-01T00:00:00.000Z',
      uploaded_at: null,
    };
    const { db } = createMediaDb(seedRow);
    const r2Put = vi.fn(async () => null);
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url !== 'https://s3.eu-central-003.backblazeb2.com/jiaozheng/media/schools/example/2026/media-id.png') {
        throw new Error(`Unexpected fetch URL: ${url}`);
      }
      if (init?.method === 'HEAD') {
        return new Response(null, {
          headers: {
            'content-length': '11',
          },
          status: 200,
        });
      }
      if (init?.method === 'GET') {
        return new Response('media-bytes', {
          headers: {
            'content-length': '11',
            'content-type': 'image/png',
          },
          status: 200,
        });
      }
      throw new Error(`Unexpected fetch method: ${init?.method}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const media = await completeMediaUpload({
      B2_APPLICATION_KEY: 'application-key',
      B2_APPLICATION_KEY_ID: 'application-key-id',
      DB: db,
      MEDIA_BUCKET: {
        put: r2Put,
      } as unknown as R2Bucket,
      NO_TORSION_MEDIA_SUBMIT_TARGET: 'both',
    } as Env, {
      mediaId: 'media-id',
    });

    expect(media.status).toBe('pending_review');
    expect(fetchMock).toHaveBeenCalledWith(
      seedRow.public_url.replace('https://f003.backblazeb2.com/file/', 'https://s3.eu-central-003.backblazeb2.com/'),
      expect.objectContaining({ method: 'HEAD' }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      seedRow.public_url.replace('https://f003.backblazeb2.com/file/', 'https://s3.eu-central-003.backblazeb2.com/'),
      expect.objectContaining({ method: 'GET' }),
    );
    expect(r2Put).toHaveBeenCalledWith(
      seedRow.object_key,
      expect.any(ReadableStream),
      expect.objectContaining({
        httpMetadata: {
          contentType: 'image/png',
        },
      }),
    );
  });
});
