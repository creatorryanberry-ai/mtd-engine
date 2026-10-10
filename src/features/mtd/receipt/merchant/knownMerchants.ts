export type KnownMerchant = {
  canonical: string
  aliases: string[]
}

/** starter alias store — extend later with vat/phone/domain fingerprints */
export const KNOWN_MERCHANTS: KnownMerchant[] = [
  {
    canonical: 'Tesco',
    aliases: ['TESCO', 'TESCO STORES', 'TESCO STR', 'TESC0'],
  },
  {
    canonical: 'Lemon Squeezy',
    aliases: ['LEMON SQUEEZY', 'LEMON SQUEEZY LLC'],
  },
  {
    canonical: 'Screwfix',
    aliases: ['SCREWFIX', 'SCREWFIX DIRECT'],
  },
  {
    canonical: 'Driversnote',
    aliases: ['DRIVERSNOTE', 'DRIVERSNOTE APS'],
  },
]

export function normalizeForMatch(value: string) {
  return value
    .toLowerCase()
    .replace(
      /\b(ltd\.?|limited|llc|plc|llp|inc\.?|incorporated|corp\.?|corporation|aps|gmbh)\b/gi,
      ' ',
    )
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function matchKnownMerchant(candidate: string): {
  canonical: string
  exact: boolean
} | null {
  const normalized = normalizeForMatch(candidate)
  if (!normalized) return null

  for (const merchant of KNOWN_MERCHANTS) {
    const aliases = [merchant.canonical, ...merchant.aliases].map(normalizeForMatch)
    if (aliases.some((alias) => alias === normalized)) {
      return { canonical: merchant.canonical, exact: true }
    }
    if (
      aliases.some(
        (alias) =>
          alias.length >= 4 && (normalized.includes(alias) || alias.includes(normalized)),
      )
    ) {
      return { canonical: merchant.canonical, exact: false }
    }
  }
  return null
}
