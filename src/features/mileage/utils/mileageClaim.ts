import { getTaxYearStart } from '~/features/mtd/utils/quarterPeriods'

export const MILEAGE_RATE_HIGH_PENCE = 55
export const MILEAGE_RATE_LOW_PENCE = 25
export const MILEAGE_ANNUAL_HIGH_RATE_THRESHOLD = 10_000

export type MileageEntryInput = {
  id: string
  date: string
  miles: number
  createdAt: string
  updatedAt: string
}

export type MileageClaimBreakdown = {
  milesAtHighRate: number
  milesAtLowRate: number
  rateLabel: string
  claimPounds: number
}

export type MileageEntryWithClaim = MileageEntryInput & {
  journeyDetails: string
  cumulativeMilesBefore: number
  claim: MileageClaimBreakdown
}

function isInTaxYear(date: string, taxYearStart: string) {
  const taxYearEndYear = Number.parseInt(taxYearStart.slice(0, 4), 10) + 1
  const taxYearEnd = `${taxYearEndYear}-04-05`
  return date >= taxYearStart && date <= taxYearEnd
}

export function calculateMileageClaim(
  miles: number,
  cumulativeMilesBefore: number,
): MileageClaimBreakdown {
  if (miles <= 0) {
    return {
      milesAtHighRate: 0,
      milesAtLowRate: 0,
      rateLabel: `${MILEAGE_RATE_HIGH_PENCE}p`,
      claimPounds: 0,
    }
  }

  const remainingHighRateMiles = Math.max(
    0,
    MILEAGE_ANNUAL_HIGH_RATE_THRESHOLD - cumulativeMilesBefore,
  )
  const milesAtHighRate = Math.min(miles, remainingHighRateMiles)
  const milesAtLowRate = miles - milesAtHighRate

  const claimPounds =
    (milesAtHighRate * MILEAGE_RATE_HIGH_PENCE +
      milesAtLowRate * MILEAGE_RATE_LOW_PENCE) /
    100

  let rateLabel: string
  if (milesAtLowRate === 0) {
    rateLabel = `${MILEAGE_RATE_HIGH_PENCE}p`
  } else if (milesAtHighRate === 0) {
    rateLabel = `${MILEAGE_RATE_LOW_PENCE}p`
  } else {
    rateLabel = `${MILEAGE_RATE_HIGH_PENCE}p/${MILEAGE_RATE_LOW_PENCE}p`
  }

  return {
    milesAtHighRate,
    milesAtLowRate,
    rateLabel,
    claimPounds,
  }
}

export function enrichMileageEntriesWithClaims<
  T extends MileageEntryInput & { journeyDetails: string },
>(
  entries: T[],
): Array<T & { cumulativeMilesBefore: number; claim: MileageClaimBreakdown }> {
  const sorted = [...entries].sort((left, right) => {
    if (left.date !== right.date) return left.date.localeCompare(right.date)
    return left.createdAt.localeCompare(right.createdAt)
  })

  const cumulativeByTaxYear = new Map<string, number>()

  return sorted.map((entry) => {
    const taxYearStart = getTaxYearStart(new Date(`${entry.date}T12:00:00`))
    const cumulativeMilesBefore = cumulativeByTaxYear.get(taxYearStart) ?? 0
    const claim = calculateMileageClaim(entry.miles, cumulativeMilesBefore)

    cumulativeByTaxYear.set(taxYearStart, cumulativeMilesBefore + entry.miles)

    return {
      ...entry,
      cumulativeMilesBefore,
      claim,
    }
  })
}

export function getCumulativeMilesBeforeEntry(
  entries: MileageEntryInput[],
  target: { date: string; createdAt?: string; excludeId?: string },
) {
  const taxYearStart = getTaxYearStart(new Date(`${target.date}T12:00:00`))
  const targetCreatedAt = target.createdAt ?? '9999-12-31T23:59:59.999Z'

  return entries
    .filter(
      (entry) => entry.id !== target.excludeId && isInTaxYear(entry.date, taxYearStart),
    )
    .filter((entry) => {
      if (entry.date < target.date) return true
      if (entry.date > target.date) return false
      return entry.createdAt < targetCreatedAt
    })
    .reduce((total, entry) => total + entry.miles, 0)
}

export function formatMileageClaimPounds(claimPounds: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(claimPounds)
}

export function formatMileageDisplayDate(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00`)
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
