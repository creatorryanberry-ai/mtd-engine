export type ManualEntryListMode = 'income' | 'expenses'

let currentMode: ManualEntryListMode = 'expenses'

export function setManualEntryListMode(mode: ManualEntryListMode) {
  currentMode = mode
}

export function getManualEntryListMode(): ManualEntryListMode {
  return currentMode
}

export function parseManualEntryListMode(
  value: string | null | undefined,
): ManualEntryListMode | null {
  if (value === 'income' || value === 'expenses') return value
  return null
}
