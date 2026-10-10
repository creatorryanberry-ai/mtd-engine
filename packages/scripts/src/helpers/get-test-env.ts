import { join } from 'node:path'

import { loadEnv } from './env-load'

export async function getTestEnv() {
  const devEnv = await loadEnv('development')

  // import src/env.ts for server env fallback values
  const envModule = await import(join(process.cwd(), 'src/env.ts'))
  const serverEnvFallback = envModule.server || {}

  // ports come from VITE_PORT_* in .env.development (loaded by loadEnv)
  const dbPort = process.env.VITE_PORT_POSTGRES || '5433'
  const appPort = process.env.VITE_PORT_WEB || '8082'
  const minioPort = process.env.VITE_PORT_MINIO || '9200'

  const dockerDbBase = `postgresql://user:password@127.0.0.1:${dbPort}`

  return {
    ...serverEnvFallback,
    ...devEnv,
    CI: 'true',
    // Child test processes may import src/env.ts directly. Keep them pinned to
    // development mode even when the parent release flow started from
    // production-flavored env.
    MTD_ENV_MODE: 'development',
    DO_NOT_TRACK: '1',
    // force localhost urls so cross-subdomain cookies don't activate in test
    BETTER_AUTH_URL: `http://localhost:${appPort}`,
    ONE_SERVER_URL: `http://localhost:${appPort}`,
    DATABASE_URL: `${dockerDbBase}/postgres`,
    MINIO_ENDPOINT: `http://127.0.0.1:${minioPort}`,
    MINIO_PUBLIC_URL: `http://127.0.0.1:${minioPort}`,
    MINIO_ACCESS_KEY: 'minio',
    MINIO_SECRET_KEY: 'minio_password',
  }
}
