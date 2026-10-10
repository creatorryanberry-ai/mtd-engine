import { createDrizzle } from './createDrizzle'
import { createPool, type CreatePoolOptions } from './createPool'
import { createServerHelpers } from './createServerHelpers'
import { migrate } from './migrate'
import { waitForDatabase } from './waitForDatabase'

import type { AnyRelations, EmptyRelations } from 'drizzle-orm'
import type { Pool } from 'pg'

export type DatabaseConfig<
  TSchema extends Record<string, unknown>,
  TRelations extends AnyRelations | Record<string, unknown> = EmptyRelations,
> = {
  /**
   * The PG connection string. Required unless a pre-built `pool` is provided
   * (it is still used by `migrate()` / `waitForDatabase()`, which need a string).
   */
  connectionString?: string
  schema: TSchema
  relations?: TRelations
  /**
   * Optional pre-built Pool-like client (e.g. a DoBackend-backed Pool for the
   * Cloudflare Durable Object runtime, where there is no external Postgres).
   * When provided, `createPool` is skipped and this pool is used directly.
   * `connectionString` is then only needed for the migration helpers.
   */
  pool?: Pool
  /** Options forwarded to the default `createPool` (ignored when `pool` is set). */
  poolOptions?: Omit<CreatePoolOptions, 'connectionString'>
}

export type MigrateOptions = {
  migrations: Record<string, () => Promise<unknown>>
  createDatabases?: string[]
  gitSha?: string
  defaultTimeout?: number
  onMigrationComplete?: () => Promise<void>
}

export function createDatabase<
  TSchema extends Record<string, unknown>,
  TRelations extends AnyRelations = EmptyRelations,
>(config: DatabaseConfig<TSchema, TRelations>) {
  const { connectionString, schema, relations } = config

  const pool =
    config.pool ??
    createPool({
      connectionString: connectionString ?? '',
      ...config.poolOptions,
    })

  const drizzle = createDrizzle({
    pool,
    schema,
    relations: relations as TRelations & AnyRelations,
  })

  const { sql, getDBClient: getBoundDBClient } = createServerHelpers(pool)

  async function close() {
    try {
      await pool.end()
    } catch (e) {
      console.error('[database] error closing:', e)
    }
  }

  async function runMigrate(options: MigrateOptions) {
    if (!connectionString) {
      throw new Error(
        'createDatabase: migrate() requires a `connectionString` (it is not derivable from a pre-built `pool`)',
      )
    }
    console.info('[database] waiting for database to be ready...')
    await waitForDatabase(connectionString)

    console.info('[database] running migrations...')
    await migrate({
      connectionString,
      migrations: options.migrations,
      createDatabases: options.createDatabases,
      gitSha: options.gitSha,
      defaultTimeout: options.defaultTimeout,
      onMigrationComplete: options.onMigrationComplete,
    })
    console.info('[database] migrations complete')
    await close()
    process.exit(0)
  }

  return {
    pool,
    drizzle,
    sql,
    getDBClient: getBoundDBClient,
    close,
    migrate: runMigrate,
    config,
  }
}
