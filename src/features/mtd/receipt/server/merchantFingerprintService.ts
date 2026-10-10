import { and, eq, inArray, ne, sql } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import { merchantFingerprint } from '~/database/schema'
import {
  isMerchantFingerprintSignalType,
  pickBestFingerprintSignal,
  type DocumentFingerprintSignal,
  type MerchantFingerprintSignalType,
} from '~/features/mtd/receipt/merchant/extractDocumentFingerprints'
import {
  isMerchantProcessKind,
  type MerchantProcessKind,
} from '~/features/mtd/receipt/merchant/matchFingerprint'

export type MerchantFingerprintRow = typeof merchantFingerprint.$inferSelect

export type MerchantFingerprintDto = {
  id: string
  signalType: MerchantFingerprintSignalType
  signalValue: string
  canonicalName: string
  sourceSuggestedName: string | null
  processKind: MerchantProcessKind | null
  privateUsePercent: number | null
  hitCount: number
  updatedAt: string
}

export { pickBestFingerprintSignal }

export function normalizeFingerprintPrivateUsePercent(
  value: number | null | undefined,
): number | null {
  if (value == null || !Number.isFinite(value)) return null
  const percent = Math.round(value)
  if (percent < 1 || percent > 99) return null
  return percent
}

function toDto(row: MerchantFingerprintRow): MerchantFingerprintDto | null {
  if (!isMerchantFingerprintSignalType(row.signalType)) return null
  const processKind =
    row.processKind && isMerchantProcessKind(row.processKind) ? row.processKind : null
  return {
    id: row.id,
    signalType: row.signalType,
    signalValue: row.signalValue,
    canonicalName: row.canonicalName,
    sourceSuggestedName: row.sourceSuggestedName,
    processKind,
    privateUsePercent: normalizeFingerprintPrivateUsePercent(row.privateUsePercent),
    hitCount: row.hitCount,
    updatedAt: row.updatedAt,
  }
}

export async function listMerchantFingerprints(
  userId: string,
): Promise<MerchantFingerprintDto[]> {
  const rows = await drizzle
    .select()
    .from(merchantFingerprint)
    .where(eq(merchantFingerprint.userId, userId))

  return rows.map(toDto).filter((row): row is MerchantFingerprintDto => row != null)
}

/**
 * save exactly one fingerprint row for this merchant.
 * prefers an existing row with the same signal; otherwise reuses the merchant's
 * existing row; otherwise inserts. drops sibling rows for the same name.
 */
export async function upsertMerchantFingerprint(
  userId: string,
  input: {
    canonicalName: string
    sourceSuggestedName?: string | null
    processKind: MerchantProcessKind
    privateUsePercent?: number | null
    signal: DocumentFingerprintSignal
  },
): Promise<MerchantFingerprintDto | null> {
  const canonicalName = input.canonicalName.trim()
  if (!canonicalName) return null
  if (!isMerchantFingerprintSignalType(input.signal.type)) return null
  const signalValue = input.signal.value.trim()
  if (!signalValue) return null
  if (!isMerchantProcessKind(input.processKind)) return null

  const now = new Date().toISOString()
  const sourceSuggestedName = input.sourceSuggestedName?.trim() || null
  const nameKey = canonicalName.toLowerCase()
  // private use only applies to expense receipts; other kinds keep the prior value
  const nextPrivateUse =
    input.processKind === 'receipt'
      ? normalizeFingerprintPrivateUsePercent(input.privateUsePercent)
      : undefined

  const bySignal = await drizzle
    .select()
    .from(merchantFingerprint)
    .where(
      and(
        eq(merchantFingerprint.userId, userId),
        eq(merchantFingerprint.signalType, input.signal.type),
        eq(merchantFingerprint.signalValue, signalValue),
      ),
    )
    .limit(1)

  let row = bySignal[0]

  if (!row) {
    const byName = await drizzle
      .select()
      .from(merchantFingerprint)
      .where(
        and(
          eq(merchantFingerprint.userId, userId),
          sql`lower(${merchantFingerprint.canonicalName}) = ${nameKey}`,
        ),
      )
      .limit(1)
    row = byName[0]
  }

  let saved: MerchantFingerprintRow | undefined
  if (row) {
    const [updated] = await drizzle
      .update(merchantFingerprint)
      .set({
        signalType: input.signal.type,
        signalValue,
        canonicalName,
        sourceSuggestedName,
        processKind: input.processKind,
        ...(nextPrivateUse !== undefined ? { privateUsePercent: nextPrivateUse } : {}),
        hitCount: sql`${merchantFingerprint.hitCount} + 1`,
        updatedAt: now,
      })
      .where(eq(merchantFingerprint.id, row.id))
      .returning()
    saved = updated
  } else {
    const [created] = await drizzle
      .insert(merchantFingerprint)
      .values({
        id: crypto.randomUUID(),
        userId,
        signalType: input.signal.type,
        signalValue,
        canonicalName,
        sourceSuggestedName,
        processKind: input.processKind,
        privateUsePercent: nextPrivateUse ?? null,
        hitCount: 1,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
    saved = created
  }

  if (!saved) return null

  // one merchant name → one fingerprint row
  await drizzle
    .delete(merchantFingerprint)
    .where(
      and(
        eq(merchantFingerprint.userId, userId),
        sql`lower(${merchantFingerprint.canonicalName}) = ${nameKey}`,
        ne(merchantFingerprint.id, saved.id),
      ),
    )

  return toDto(saved)
}

/** @deprecated use upsertMerchantFingerprint — kept for callers that still pass arrays */
export async function upsertMerchantFingerprints(
  userId: string,
  input: {
    canonicalName: string
    sourceSuggestedName?: string | null
    processKind: MerchantProcessKind
    privateUsePercent?: number | null
    signals: DocumentFingerprintSignal[]
  },
): Promise<MerchantFingerprintDto[]> {
  const signal = pickBestFingerprintSignal(input.signals)
  if (!signal) return []
  const row = await upsertMerchantFingerprint(userId, {
    canonicalName: input.canonicalName,
    sourceSuggestedName: input.sourceSuggestedName,
    processKind: input.processKind,
    privateUsePercent: input.privateUsePercent,
    signal,
  })
  return row ? [row] : []
}

const WEAK_SIGNAL_TYPES = ['phone', 'postcode', 'address_norm'] as const

/** remove customer-side legacy fingerprints that match every invoice */
export async function clearWeakMerchantFingerprints(userId: string) {
  const deleted = await drizzle
    .delete(merchantFingerprint)
    .where(
      and(
        eq(merchantFingerprint.userId, userId),
        inArray(merchantFingerprint.signalType, [...WEAK_SIGNAL_TYPES]),
      ),
    )
    .returning({ id: merchantFingerprint.id })
  return deleted.length
}
