import { Upload } from '@aws-sdk/lib-storage'

import { server } from '~/env'

import { gcsPublicObjectUrl, getGcsStorage, isGcsConfigured } from './gcs'
import { getS3Client, isMinioConfigured } from './s3client'

import type { UploadParams, UploadResult } from './types'

export const defaultBucket = 'chat'

async function bodyToBuffer(body: UploadParams['body']): Promise<Buffer> {
  if (Buffer.isBuffer(body)) return body
  if (body instanceof Uint8Array) return Buffer.from(body)
  if (typeof body === 'string') return Buffer.from(body)
  if (body instanceof ArrayBuffer) return Buffer.from(body)

  // aws upload accepts streams; buffer for gcs
  const stream = body as AsyncIterable<Uint8Array> | ReadableStream<Uint8Array>
  if (typeof (stream as ReadableStream).getReader === 'function') {
    const reader = (stream as ReadableStream<Uint8Array>).getReader()
    const chunks: Uint8Array[] = []
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) chunks.push(value)
    }
    return Buffer.concat(chunks.map((c) => Buffer.from(c)))
  }

  const chunks: Buffer[] = []
  for await (const chunk of stream as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

async function uploadObjectToGcs({
  key,
  body,
  contentType,
  isPublic,
}: UploadParams): Promise<UploadResult> {
  const bucket = server.GCS_RECEIPTS_BUCKET
  const storage = await getGcsStorage()
  const file = storage.bucket(bucket).file(key)
  await file.save(await bodyToBuffer(body), {
    contentType,
    resumable: false,
    public: isPublic,
    metadata: contentType ? { contentType } : undefined,
  })

  return {
    key,
    url: gcsPublicObjectUrl(bucket, key),
  }
}

async function uploadObjectToMinio({
  bucket = defaultBucket,
  key,
  body,
  contentType,
  isPublic = false,
}: UploadParams): Promise<UploadResult> {
  const uploadParams = {
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    ...(isPublic && { ACL: 'public-read' as const }),
  }

  const uploader = new Upload({
    client: getS3Client(),
    params: uploadParams,
  })

  await uploader.done()

  return {
    key: uploadParams.Key,
    url: `${server.MINIO_PUBLIC_URL}/${bucket}/${key}`,
  }
}

/** Public/generic uploads — MinIO locally, GCS public objects in staging/production. */
export async function uploadObject(params: UploadParams): Promise<UploadResult> {
  if (isMinioConfigured()) {
    return uploadObjectToMinio(params)
  }
  if (isGcsConfigured()) {
    return uploadObjectToGcs({ ...params, isPublic: params.isPublic ?? true })
  }
  throw new Error(
    'Object storage is not configured. Set GCS_RECEIPTS_BUCKET and GCS_SERVICE_ACCOUNT_JSON (staging/production), or MinIO for local dev.',
  )
}
