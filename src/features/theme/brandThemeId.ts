import { createEmitter, createStorageValue } from '@mtd/helpers'

import {
  BRAND_THEME_STORAGE_KEY,
  defaultBrandTheme,
  type BrandThemeId,
} from './brandThemes'

const brandThemeStorage = createStorageValue<BrandThemeId>(BRAND_THEME_STORAGE_KEY)

export function readStoredBrandId(): BrandThemeId {
  try {
    const stored = brandThemeStorage.get()
    if (stored === 'actor' || stored === 'curator' || stored === 'parkins') return stored
  } catch {
    // storage unavailable during SSR / early native boot
  }
  return defaultBrandTheme.id
}

export const brandThemeIdEmitter = createEmitter<BrandThemeId>(
  'brand-theme-id',
  readStoredBrandId(),
)

export function persistBrandThemeId(id: BrandThemeId) {
  try {
    brandThemeStorage.set(id)
  } catch {
    // ignore persistence failures
  }
  brandThemeIdEmitter.emit(id)
}
