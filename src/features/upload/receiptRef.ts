export const RECEIPT_REF_PREFIX = 'mtd-receipt:'

export function toReceiptRef(key: string) {
  return `${RECEIPT_REF_PREFIX}${key}`
}

export function parseReceiptRef(value: string | null | undefined): string | null {
  if (!value) return null
  if (value.startsWith(RECEIPT_REF_PREFIX)) {
    return value.slice(RECEIPT_REF_PREFIX.length)
  }
  return null
}

export function isReceiptRef(value: string | null | undefined): boolean {
  return Boolean(value?.startsWith(RECEIPT_REF_PREFIX))
}

/** keep stable receipt refs; ignore expired signed URLs when an existing ref is present */
export function normalizeAttachmentForStorage(
  incoming: string | null | undefined,
  existing: string | null | undefined,
): string | null {
  if (incoming == null || incoming === '') return null
  if (isReceiptRef(incoming)) return incoming
  if (isReceiptRef(existing) && /^https?:\/\//.test(incoming)) {
    return existing ?? null
  }
  return incoming
}
