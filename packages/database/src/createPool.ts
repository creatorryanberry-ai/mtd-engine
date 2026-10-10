import pg, { type Pool } from 'pg'

import { normalizePgConnectionString, pgPoolSsl } from './pgConnection'
import { wrapPoolWithRls } from './wrapPoolWithRls'

export type CreatePoolOptions = {
  connectionString: string
  max?: number
  idleTimeoutMillis?: number
  connectionTimeoutMillis?: number
  keepAlive?: boolean
  keepAliveInitialDelayMillis?: number
}

export function createPool(options: CreatePoolOptions): Pool {
  const {
    connectionString,
    max = 20,
    idleTimeoutMillis = 30_000,
    connectionTimeoutMillis = 5_000,
    keepAlive = true,
    keepAliveInitialDelayMillis = 10_000,
  } = options

  const ssl = pgPoolSsl(connectionString)

  const pool = new pg.Pool({
    connectionString: normalizePgConnectionString(connectionString),
    max,
    idleTimeoutMillis,
    connectionTimeoutMillis,
    keepAlive,
    keepAliveInitialDelayMillis,
    ssl,
  })

  pool.on('error', (error) => {
    console.error(`[database] pool error`, error.message, error.stack)
  })

  pool.on('connect', (client) => {
    client.on('error', (error) => {
      console.error(`[database] client error`, error.message, error.stack)
    })

    // pg-protocol's parser can throw synchronously inside the stream 'data' handler
    // (e.g. RangeError when reading corrupted/stale buffer data from a zombie connection).
    // wrapping the stream with its own error handler catches them at the source.
    const stream = (client as any).connection?.stream
    if (stream && !stream.__pgErrorPatched) {
      stream.__pgErrorPatched = true
      stream.on('error', (error: Error) => {
        console.error(`[database] stream error`, error.message, error.stack)
      })
    }
  })

  return wrapPoolWithRls(pool)
}
