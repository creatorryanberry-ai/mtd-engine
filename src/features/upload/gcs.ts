import { server } from '~/env'

/** matches packages/scripts encodeComposeEnvValue — deploy-safe json env */
const COMPOSE_ENV_B64_PREFIX = 'b64:'

export function parseGcsServiceAccountJson(raw: string): Record<string, unknown> {
  const trimmed = raw.trim()
  const jsonText = trimmed.startsWith(COMPOSE_ENV_B64_PREFIX)
    ? Buffer.from(trimmed.slice(COMPOSE_ENV_B64_PREFIX.length), 'base64').toString('utf8')
    : trimmed

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    throw new Error(
      'GCS_SERVICE_ACCOUNT_JSON is not valid JSON (deploy may have mangled `{...}` — redeploy after compose env fix)',
    )
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('GCS_SERVICE_ACCOUNT_JSON must be a JSON object')
  }

  return parsed as Record<string, unknown>
}

export function isGcsConfigured() {
  const raw = server.GCS_SERVICE_ACCOUNT_JSON
  if (!server.GCS_RECEIPTS_BUCKET || !raw) return false
  // mangled deploy leaves a single "{" — treat as unset
  if (raw.trim() === '{') return false
  return true
}

export function gcsPublicObjectUrl(bucket: string, key: string) {
  const encodedKey = key
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')
  return `https://storage.googleapis.com/${bucket}/${encodedKey}`
}

let gcsStoragePromise: Promise<
  InstanceType<typeof import('@google-cloud/storage').Storage>
> | null = null

export async function getGcsStorage() {
  if (gcsStoragePromise) return gcsStoragePromise
  gcsStoragePromise = (async () => {
    const { Storage } = await import('@google-cloud/storage')
    const credentials = parseGcsServiceAccountJson(server.GCS_SERVICE_ACCOUNT_JSON)
    return new Storage({
      projectId:
        server.GCS_PROJECT_ID ||
        (typeof credentials.project_id === 'string' ? credentials.project_id : undefined),
      credentials,
    })
  })()
  return gcsStoragePromise
}
