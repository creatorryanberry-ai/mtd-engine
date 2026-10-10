import { toTitleCase } from '~/features/mtd/utils/formatTransactionDisplay'

const DISPLAY_SUFFIX =
  /\b(ltd\.?|limited|llc|plc|llp|inc\.?|incorporated|corp\.?|corporation|aps|gmbh|ab|oy|as|nv|sa|bv)\b/gi

export function normalizeMerchantNames(raw: string): {
  merchantRaw: string
  merchantDisplay: string
} {
  const merchantRaw = toTitleCase(raw.replace(/\s+/g, ' ').trim())
  const withoutSuffix = merchantRaw
    .replace(DISPLAY_SUFFIX, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const merchantDisplay = withoutSuffix || merchantRaw
  return { merchantRaw, merchantDisplay }
}
