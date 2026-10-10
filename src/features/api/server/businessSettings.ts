import { eq } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import { businessSettings } from '~/database/schema'
import { ensureDefaultBankAccounts } from '~/features/bankAccounts/server/ensureDefaultBankAccounts'

import {
  normalizeBusinessSettingsPatch,
  validateBusinessSettingsPatch,
} from '~/features/business/businessSettingsValidation'
import type { BusinessType } from '~/features/business/businessSettingsValidation'

import type { BusinessSettingsPatch } from '~/features/business/businessSettingsValidation'

export type { BusinessSettingsPatch } from '~/features/business/businessSettingsValidation'

export type BusinessSettingsRow = typeof businessSettings.$inferSelect

export { validateBusinessSettingsPatch, normalizeBusinessSettingsPatch }

export async function getBusinessSettings(
  userId: string,
): Promise<BusinessSettingsRow | null> {
  const rows = await drizzle
    .select()
    .from(businessSettings)
    .where(eq(businessSettings.userId, userId))
    .limit(1)
  return rows[0] ?? null
}

export async function upsertBusinessSettings(
  userId: string,
  patch: BusinessSettingsPatch,
): Promise<BusinessSettingsRow> {
  validateBusinessSettingsPatch(patch)
  const values = normalizeBusinessSettingsPatch(patch)

  const rows = await drizzle
    .insert(businessSettings)
    .values({ userId, ...values })
    .onConflictDoUpdate({
      target: businessSettings.userId,
      set: values,
    })
    .returning()

  const row = rows[0]
  if (!row) {
    throw new Error('Failed to save business settings')
  }

  await ensureDefaultBankAccounts(userId, {
    cisRegistered: row.cisRegistered,
    businessType: row.businessType as BusinessType | null,
  })

  return row
}
