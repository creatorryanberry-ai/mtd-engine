import { and, eq } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import { engineContact, engineIdentity } from '~/database/engineSchema'

import { hashBucket, newId, normalizeEmail } from '../../core/ids'

import type { EngineContact } from '~/database/engineSchema'

export type IdentityHint = {
  kind:
    | 'email'
    | 'phone'
    | 'cookie'
    | 'click_id'
    | 'crm_id'
    | 'stripe_customer'
    | 'device'
  provider?: string | null
  value: string
}

export type ResolveContactInput = {
  workspaceId: string
  email?: string | null
  phone?: string | null
  firstName?: string | null
  lastName?: string | null
  jobTitle?: string | null
  country?: string | null
  companyId?: string | null
  source?: string | null
  identities?: IdentityHint[]
  /** merged into contact.attributes */
  attributes?: Record<string, unknown>
  /** merged into contact.externalIds, keyed by provider */
  externalIds?: Record<string, string>
  lifecycleStage?: string | null
  activityAt?: string | null
}

/**
 * identity resolution: find a contact by any known identifier (email first,
 * then explicit identities), else create one. all identifiers are recorded so
 * later touches from other channels resolve to the same person.
 */
export async function resolveContact(input: ResolveContactInput): Promise<EngineContact> {
  const emailNormalized = normalizeEmail(input.email)
  const hints: IdentityHint[] = [...(input.identities ?? [])]
  if (emailNormalized) hints.unshift({ kind: 'email', value: emailNormalized })

  let existing: EngineContact | null = null

  if (emailNormalized) {
    const [row] = await drizzle
      .select()
      .from(engineContact)
      .where(
        and(
          eq(engineContact.workspaceId, input.workspaceId),
          eq(engineContact.emailNormalized, emailNormalized),
        ),
      )
      .limit(1)
    existing = row ?? null
  }

  if (!existing) {
    for (const hint of hints) {
      const [row] = await drizzle
        .select({ contact: engineContact })
        .from(engineIdentity)
        .innerJoin(engineContact, eq(engineContact.id, engineIdentity.contactId))
        .where(
          and(
            eq(engineIdentity.workspaceId, input.workspaceId),
            eq(engineIdentity.kind, hint.kind),
            hint.provider
              ? eq(engineIdentity.provider, hint.provider)
              : eq(engineIdentity.value, hint.value),
            eq(engineIdentity.value, hint.value),
          ),
        )
        .limit(1)
      if (row) {
        existing = row.contact
        break
      }
    }
  }

  const now = new Date().toISOString()
  const activityAt = input.activityAt ?? now

  if (!existing) {
    const id = newId('ct')
    const [created] = await drizzle
      .insert(engineContact)
      .values({
        id,
        workspaceId: input.workspaceId,
        companyId: input.companyId ?? null,
        email: input.email?.trim() || null,
        emailNormalized,
        phone: input.phone ?? null,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        jobTitle: input.jobTitle ?? null,
        country: input.country ?? null,
        lifecycleStage: input.lifecycleStage ?? 'lead',
        hashBucket: hashBucket(emailNormalized ?? id, input.workspaceId),
        source: input.source ?? null,
        externalIds: input.externalIds ?? {},
        attributes: input.attributes ?? {},
        firstSeenAt: activityAt,
        lastActivityAt: activityAt,
      })
      .returning()
    existing = created!
  } else {
    const patch: Partial<typeof engineContact.$inferInsert> = { updatedAt: now }
    if (!existing.email && input.email) {
      patch.email = input.email.trim()
      patch.emailNormalized = emailNormalized
    }
    if (!existing.phone && input.phone) patch.phone = input.phone
    if (!existing.firstName && input.firstName) patch.firstName = input.firstName
    if (!existing.lastName && input.lastName) patch.lastName = input.lastName
    if (!existing.jobTitle && input.jobTitle) patch.jobTitle = input.jobTitle
    if (!existing.country && input.country) patch.country = input.country
    if (!existing.companyId && input.companyId) patch.companyId = input.companyId
    if (input.lifecycleStage) patch.lifecycleStage = input.lifecycleStage
    if (input.externalIds && Object.keys(input.externalIds).length > 0) {
      patch.externalIds = { ...existing.externalIds, ...input.externalIds }
    }
    if (input.attributes && Object.keys(input.attributes).length > 0) {
      patch.attributes = { ...existing.attributes, ...input.attributes }
    }
    if (!existing.lastActivityAt || activityAt > existing.lastActivityAt) {
      patch.lastActivityAt = activityAt
    }
    const [updated] = await drizzle
      .update(engineContact)
      .set(patch)
      .where(eq(engineContact.id, existing.id))
      .returning()
    existing = updated ?? existing
  }

  for (const hint of hints) {
    await drizzle
      .insert(engineIdentity)
      .values({
        id: newId('idn'),
        workspaceId: input.workspaceId,
        contactId: existing.id,
        kind: hint.kind,
        provider: hint.provider ?? null,
        value: hint.value,
      })
      .onConflictDoNothing()
  }

  return existing
}
