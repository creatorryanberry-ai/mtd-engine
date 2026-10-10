import type { PoolClient } from 'pg'

const INBOX_USER_ID_TABLES = [
  'inboundEmailAddress',
  'inboundEmail',
  'inboxDocument',
] as const

export async function up(client: PoolClient) {
  for (const table of INBOX_USER_ID_TABLES) {
    await client.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`)
    await client.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`)
    await client.query(`DROP POLICY IF EXISTS ${table}_isolation ON "${table}"`)
    await client.query(`
      CREATE POLICY ${table}_isolation ON "${table}"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR "userId" = current_setting('app.user_id', true)
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR "userId" = current_setting('app.user_id', true)
      )
    `)
  }
}
