import type { Pence } from './money'

/**
 * HMRC-style rounding for this estimator:
 * - user amounts enter as pounds and are rounded to the nearest penny
 * - each tax band / component is rounded to the nearest penny
 * - the final liability is the sum of already-rounded components (not re-rounded)
 */
export type TaxRoundingPolicy = {
  roundComponent(pence: number): Pence
  applyRate(amountPence: Pence, rate: number): Pence
}

export const nearestPennyRounding: TaxRoundingPolicy = {
  roundComponent(pence) {
    if (!Number.isFinite(pence) || pence <= 0) return 0
    return Math.round(pence)
  },
  applyRate(amountPence, rate) {
    if (amountPence <= 0 || rate <= 0) return 0
    return Math.round(amountPence * rate)
  },
}

export function getTaxRoundingPolicy(): TaxRoundingPolicy {
  return nearestPennyRounding
}
