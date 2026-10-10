import { createCipheriv, createHash, randomBytes } from 'node:crypto'

import type { PoolClient } from 'pg'

const ALGORITHM = 'aes-256-gcm'

function encryptNino(secret: string, nino: string) {
  const key = createHash('sha256').update(secret).digest()
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(nino, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`
}

function looksEncrypted(value: string) {
  const parts = value.split(':')
  return parts.length === 3 && parts.every((part) => part.length > 0)
}

async function encryptTableColumn(client: PoolClient, table: string, secret: string) {
  const result = await client.query<{ id: string; nino: string }>(
    `SELECT id, nino FROM "${table}"`,
  )
  for (const row of result.rows) {
    if (!row.nino || looksEncrypted(row.nino)) continue
    const encrypted = encryptNino(secret, row.nino.replace(/\s+/g, '').toUpperCase())
    await client.query(`UPDATE "${table}" SET nino = $1 WHERE id = $2`, [
      encrypted,
      row.id,
    ])
  }
}

/** re-run encrypt after RLS: earlier encrypt migration could not see rows without bypass */
export async function up(client: PoolClient) {
  await client.query(`SELECT set_config('app.bypass_rls', 'on', true)`)

  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) {
    throw new Error('BETTER_AUTH_SECRET is required to encrypt existing NINOs')
  }

  await encryptTableColumn(client, 'hmrcConnection', secret)
  await encryptTableColumn(client, 'hmrcOAuthState', secret)
}
