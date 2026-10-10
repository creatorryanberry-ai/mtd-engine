import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg'

import { getDbUserContext } from './userContext'

async function applyRlsSession(client: PoolClient) {
  const ctx = getDbUserContext()
  if (!ctx.bypassRls && ctx.userId) {
    await client.query(
      `SELECT set_config('app.user_id', $1, false), set_config('app.bypass_rls', 'off', false)`,
      [ctx.userId],
    )
    return
  }

  await client.query(
    `SELECT set_config('app.bypass_rls', 'on', false), set_config('app.user_id', '', false)`,
  )
}

/**
 * Ensures every checkout/query applies RLS session GUCs from AsyncLocalStorage.
 * When no user context is set, bypass stays on (auth, migrations, jobs bootstrap).
 */
export function wrapPoolWithRls(pool: Pool): Pool {
  const originalConnect = pool.connect.bind(pool)

  pool.connect = ((arg?: unknown) => {
    if (typeof arg === 'function') {
      return originalConnect(async (err, client, done) => {
        if (err || !client) {
          ;(
            arg as (
              err: Error | undefined,
              client?: PoolClient,
              done?: () => void,
            ) => void
          )(err ?? undefined, client, done)
          return
        }
        try {
          await applyRlsSession(client)
          ;(arg as (err: Error | null, client: PoolClient, done: () => void) => void)(
            null,
            client,
            done!,
          )
        } catch (applyErr) {
          done?.()
          ;(arg as (err: Error) => void)(applyErr as Error)
        }
      })
    }

    return originalConnect().then(async (client) => {
      await applyRlsSession(client)
      return client
    })
  }) as typeof pool.connect

  // drizzle uses pool.query for most statements — run SET on the same checked-out client
  pool.query = ((...args: unknown[]) => {
    const callback = typeof args[args.length - 1] === 'function' ? args.pop() : undefined

    const run = async (): Promise<QueryResult<QueryResultRow>> => {
      const client = await originalConnect()
      try {
        await applyRlsSession(client)
        return await (
          client.query as (...a: unknown[]) => Promise<QueryResult<QueryResultRow>>
        )(...args)
      } finally {
        client.release()
      }
    }

    if (callback) {
      void run().then(
        (result) =>
          (callback as (err: Error | null, result?: QueryResult) => void)(null, result),
        (err) => (callback as (err: Error) => void)(err),
      )
      return undefined as unknown as QueryResult
    }

    return run()
  }) as typeof pool.query

  return pool
}
