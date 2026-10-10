import { S3Client } from '@aws-sdk/client-s3'

import { server } from '~/env'

import type { S3Config } from './types'

export const defaultConfig: S3Config = {
  endpoint: server.MINIO_ENDPOINT,
  region: 'auto',
  forcePathStyle: true,
  accessKeyId: server.MINIO_ACCESS_KEY,
  secretAccessKey: server.MINIO_SECRET_KEY,
}

export function isMinioConfigured() {
  return Boolean(
    server.MINIO_ACCESS_KEY && server.MINIO_SECRET_KEY && server.MINIO_ENDPOINT,
  )
}

export const createS3Client = (config: S3Config = {}) => {
  const finalConfig = {
    ...defaultConfig,
    ...config,
    credentials: {
      accessKeyId: config.accessKeyId ?? defaultConfig.accessKeyId ?? '',
      secretAccessKey: config.secretAccessKey ?? defaultConfig.secretAccessKey ?? '',
    },
  }

  if (!finalConfig.credentials.accessKeyId || !finalConfig.credentials.secretAccessKey) {
    throw new Error('Missing required MinIO credentials for local upload storage')
  }

  return new S3Client(finalConfig)
}

/** lazy — staging/prod can boot GCS-only without MinIO credentials */
let cached: S3Client | null = null

export function getS3Client(config: S3Config = {}): S3Client {
  if (cached && Object.keys(config).length === 0) return cached
  const client = createS3Client(config)
  if (Object.keys(config).length === 0) cached = client
  return client
}
