import { enrichMileageEntriesWithClaims } from '~/features/mileage/utils/mileageClaim'

import type { MileageEntryInput } from '~/features/mileage/utils/mileageClaim'

export type MileageSeriesPreview = {
  journeyCount: number
  totalMiles: number
  claimPounds: number
}

export function previewMileageSeriesClaim(input: {
  dates: string[]
  milesPerJourney: number
  journeyDetails?: string
  existingEntries: Array<MileageEntryInput & { journeyDetails: string }>
}): MileageSeriesPreview {
  const journeyCount = input.dates.length
  const totalMiles = journeyCount * input.milesPerJourney

  if (journeyCount === 0 || input.milesPerJourney <= 0) {
    return { journeyCount, totalMiles: 0, claimPounds: 0 }
  }

  const previewIds = new Set(input.dates.map((_, index) => `preview-${index}`))
  const previewEntries = input.dates.map((date, index) => ({
    id: `preview-${index}`,
    date,
    miles: input.milesPerJourney,
    journeyDetails: input.journeyDetails?.trim() || 'Journey',
    createdAt: '9999-12-31T23:59:59.999Z',
    updatedAt: '9999-12-31T23:59:59.999Z',
  }))

  const enriched = enrichMileageEntriesWithClaims([
    ...input.existingEntries,
    ...previewEntries,
  ])

  const claimPounds = enriched
    .filter((entry) => previewIds.has(entry.id))
    .reduce((total, entry) => total + entry.claim.claimPounds, 0)

  return { journeyCount, totalMiles, claimPounds }
}
