import { and, eq } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import { inboundEmailAddress } from '~/database/schema'
import { server } from '~/env'
import {
  buildInboundEmailAddress,
  generateInboundToken,
} from '~/features/inbox/inboundToken'

const TOKEN_RETRY_LIMIT = 8

export type InboundEmailAddressDto = {
  id: string
  emailAddress: string
  isActive: boolean
  createdAt: string
}

function toDto(row: typeof inboundEmailAddress.$inferSelect): InboundEmailAddressDto {
  return {
    id: row.id,
    emailAddress: row.emailAddress,
    isActive: row.isActive,
    createdAt: row.createdAt,
  }
}

async function insertAddress(userId: string) {
  const domain = server.INBOUND_EMAIL_DOMAIN
  for (let attempt = 0; attempt < TOKEN_RETRY_LIMIT; attempt++) {
    const token = generateInboundToken()
    const emailAddress = buildInboundEmailAddress(token, domain)
    try {
      const [created] = await drizzle
        .insert(inboundEmailAddress)
        .values({
          id: crypto.randomUUID(),
          userId,
          token,
          emailAddress,
          isActive: true,
          createdAt: new Date().toISOString(),
        })
        .returning()
      if (created) return created
    } catch (error) {
      const code =
        typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
      const message = error instanceof Error ? error.message : ''
      if (code !== '23505' && !message.toLowerCase().includes('unique')) {
        throw error
      }
    }
  }
  throw new Error('Could not allocate an inbound email address')
}

export async function getOrCreateInboundEmailAddress(userId: string) {
  const [existing] = await drizzle
    .select()
    .from(inboundEmailAddress)
    .where(
      and(eq(inboundEmailAddress.userId, userId), eq(inboundEmailAddress.isActive, true)),
    )
    .limit(1)

  if (existing) return toDto(existing)
  return toDto(await insertAddress(userId))
}

export async function regenerateInboundEmailAddress(userId: string) {
  const now = new Date().toISOString()
  await drizzle
    .update(inboundEmailAddress)
    .set({ isActive: false, revokedAt: now })
    .where(
      and(eq(inboundEmailAddress.userId, userId), eq(inboundEmailAddress.isActive, true)),
    )

  return toDto(await insertAddress(userId))
}

export async function findActiveInboundEmailAddressByToken(token: string) {
  const [row] = await drizzle
    .select()
    .from(inboundEmailAddress)
    .where(
      and(eq(inboundEmailAddress.token, token), eq(inboundEmailAddress.isActive, true)),
    )
    .limit(1)
  return row ?? null
}
