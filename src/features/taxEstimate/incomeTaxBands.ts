import type { Pence } from './money'
import { getTaxRoundingPolicy } from './rounding'
import type { IncomeTaxBand } from './taxYearRules'
import type { BandTaxSlice } from './types'

export type OccupiedBand = {
  bandId: string
  label: string
  rate: number
  occupiedPence: Pence
}

function extendedThreshold(
  band: IncomeTaxBand,
  index: number,
  bands: IncomeTaxBand[],
  bandExtensionPence: Pence,
): number {
  if (band.toPence == null) return Number.POSITIVE_INFINITY
  const higherIndex = bands.findIndex((item) => item.rate >= 0.4)
  const extendFrom = higherIndex <= 0 ? 0 : higherIndex - 1
  if (index >= extendFrom) return band.toPence + bandExtensionPence
  return band.toPence
}

/** occupy `amountPence` of income starting at `fromPence` in total-income space. */
export function occupyFrom(input: {
  fromPence: Pence
  amountPence: Pence
  bands: IncomeTaxBand[]
  personalAllowancePence: Pence
  bandExtensionPence: Pence
}): OccupiedBand[] {
  const occupied: OccupiedBand[] = []
  let remaining = Math.max(0, input.amountPence)
  let cursor = Math.max(0, input.fromPence)

  for (const [index, band] of input.bands.entries()) {
    if (remaining <= 0) break
    const to = extendedThreshold(band, index, input.bands, input.bandExtensionPence)
    if (cursor >= to) continue
    const room = to - cursor
    const take = Math.min(remaining, room)
    if (take > 0) {
      occupied.push({
        bandId: band.id,
        label: band.label,
        rate: band.rate,
        occupiedPence: take,
      })
      remaining -= take
      cursor += take
    }
  }

  return occupied
}

export function taxOccupied(
  occupied: OccupiedBand[],
  rateForBand?: (band: OccupiedBand) => number,
): { slices: BandTaxSlice[]; taxPence: Pence } {
  const rounding = getTaxRoundingPolicy()
  const slices: BandTaxSlice[] = []
  let taxPence = 0

  for (const band of occupied) {
    const rate = rateForBand ? rateForBand(band) : band.rate
    const tax = rounding.applyRate(band.occupiedPence, rate)
    taxPence += tax
    slices.push({
      bandId: band.bandId,
      label: band.label,
      amountPence: band.occupiedPence,
      rate,
      taxPence: tax,
    })
  }

  return { slices, taxPence }
}

export function occupiedWidth(occupied: OccupiedBand[]): Pence {
  return occupied.reduce((sum, item) => sum + item.occupiedPence, 0)
}

export function remainingBasicRateRoom(input: {
  fromPence: Pence
  bands: IncomeTaxBand[]
  bandExtensionPence: Pence
}): Pence {
  const basic = input.bands.find((band) => band.id === 'basic')
  if (!basic?.toPence) return 0
  const basicIndex = input.bands.findIndex((band) => band.id === 'basic')
  const to = extendedThreshold(basic, basicIndex, input.bands, input.bandExtensionPence)
  return Math.max(0, to - input.fromPence)
}
