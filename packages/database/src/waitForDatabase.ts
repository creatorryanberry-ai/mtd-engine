import pg from 'pg'

import { normalizePgConnectionString, pgPoolSsl } from './pgConnection'

export async function waitForDatabase(connectionString: string, maxRetries = 30) {
  const url = normalizePgConnectionString(connectionString)
  const ssl = pgPoolSsl(connectionString)
  for (let i = 0; i < maxRetries; i++) {
    try {
      const client = new pg.Client({
        connectionString: url,
        connectionTimeoutMillis: 5_000,
        ssl,
      })
      await client.connect()
      await client.query('SELECT 1')
      await client.end()
      console.info('[database] connection successful')
      return
    } catch {
      const delay = Math.min(1000 * 1.5 ** i, 10000)
      console.info(
        `[database] waiting... attempt ${i + 1}/${maxRetries} (retry in ${delay}ms)`,
      )
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
  throw new Error('database connection timeout after ' + maxRetries + ' attempts')
}
