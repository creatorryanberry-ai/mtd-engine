import { PgBoss } from 'pg-boss'

import { normalizePgConnectionString, pgPoolSsl } from '@mtd/database'

import { server } from '~/env'

let boss: PgBoss | null = null

export const JOB_NAMES = {
  submissionSubmit: 'submission.submit',
  engineConnectionSync: 'engine.connection.sync',
  engineExperimentsRefresh: 'engine.experiments.refresh',
  engineMetricsRollup: 'engine.metrics.rollup',
} as const

export async function getBoss() {
  if (boss) return boss
  const rawUrl = server.DATABASE_URL
  if (!rawUrl) {
    throw new Error('DATABASE_URL is not configured for pg-boss')
  }
  const connectionString = normalizePgConnectionString(rawUrl)
  const instance = new PgBoss({
    connectionString,
    ssl: pgPoolSsl(rawUrl),
  })
  // pg-boss emits 'error' events; without a listener node crashes the process
  instance.on('error', (error) => console.error('[pg-boss] error', error))
  await instance.start()
  // queues must exist before send()/work() in pg-boss v10+ (idempotent)
  for (const name of Object.values(JOB_NAMES)) {
    await instance.createQueue(name)
  }
  boss = instance
  return boss
}
