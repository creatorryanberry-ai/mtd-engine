import { beforeEach, describe, expect, it, vi } from 'vitest'

const save = vi.fn(async () => {})
const file = vi.fn(() => ({ save }))
const bucket = vi.fn(() => ({ file }))

vi.mock('@google-cloud/storage', () => ({
  Storage: class {
    bucket = bucket
  },
}))

vi.mock('~/env', () => ({
  server: {
    MINIO_ACCESS_KEY: '',
    MINIO_ENDPOINT: '',
    MINIO_PUBLIC_URL: '',
    MINIO_SECRET_KEY: '',
    GCS_RECEIPTS_BUCKET: 'straightuptax-receipts-staging',
    GCS_SERVICE_ACCOUNT_JSON: JSON.stringify({
      type: 'service_account',
      project_id: 'test-project',
      client_email: 'test@test.iam.gserviceaccount.com',
      private_key: 'fake',
    }),
    GCS_PROJECT_ID: 'test-project',
  },
}))

vi.mock('~/features/upload/s3client', () => ({
  getS3Client: vi.fn(() => {
    throw new Error('MinIO should not be used when GCS is configured')
  }),
  isMinioConfigured: () => false,
}))

describe('uploadObject (GCS public)', () => {
  beforeEach(() => {
    save.mockClear()
    file.mockClear()
    bucket.mockClear()
  })

  it('uploads to GCS and returns a permanent public URL when MinIO is unset', async () => {
    const { uploadObject } = await import('~/features/upload/storage')
    const { gcsPublicObjectUrl } = await import('~/features/upload/gcs')

    const result = await uploadObject({
      key: 'uploads/avatar-1.jpg',
      body: new Uint8Array([1, 2, 3]),
      contentType: 'image/jpeg',
      isPublic: true,
    })

    expect(bucket).toHaveBeenCalledWith('straightuptax-receipts-staging')
    expect(file).toHaveBeenCalledWith('uploads/avatar-1.jpg')
    expect(save).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({
        contentType: 'image/jpeg',
        public: true,
        resumable: false,
      }),
    )
    expect(result).toEqual({
      key: 'uploads/avatar-1.jpg',
      url: gcsPublicObjectUrl('straightuptax-receipts-staging', 'uploads/avatar-1.jpg'),
    })
  })
})

describe('gcsPublicObjectUrl', () => {
  it('builds a stable googleapis public URL', async () => {
    const { gcsPublicObjectUrl } = await import('~/features/upload/gcs')
    expect(gcsPublicObjectUrl('my-bucket', 'avatars/x y.png')).toBe(
      'https://storage.googleapis.com/my-bucket/avatars/x%20y.png',
    )
  })
})

describe('parseGcsServiceAccountJson', () => {
  it('accepts raw json and b64-prefixed deploy values', async () => {
    const { parseGcsServiceAccountJson } = await import('~/features/upload/gcs')
    const raw = { type: 'service_account', project_id: 'p1' }
    expect(parseGcsServiceAccountJson(JSON.stringify(raw))).toEqual(raw)
    const b64 = `b64:${Buffer.from(JSON.stringify(raw), 'utf8').toString('base64')}`
    expect(parseGcsServiceAccountJson(b64)).toEqual(raw)
  })
})
