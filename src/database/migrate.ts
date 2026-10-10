import { join } from 'node:path'

import { createDatabase, loadMigrationsFromDir } from '@mtd/database'

import { server } from '../env'
import * as coreSchema from './schema'
import * as engineSchema from './engineSchema'
import { relations } from './relations'

const db = createDatabase({
  connectionString: server.DATABASE_URL,
  schema: { ...coreSchema, ...engineSchema },
  relations,
})

export async function main() {
  await db.migrate({
    migrations: loadMigrationsFromDir(join(import.meta.dirname, 'migrations')),
    gitSha: process.env.GIT_SHA,
    // remote databases (e.g. vercel builds) need longer than the 5s default
    defaultTimeout: Number(process.env.MIGRATION_TIMEOUT_MS) || undefined,
  })
}

if (import.meta.main) {
  main().catch((err: unknown) => {
    console.error('Migration failed:', err)
    process.exit(1)
  })
}
