/** all amounts are integer minor units (pence, cents) */

export type OrderAmounts = {
  revenueMinor: number
  costMinor?: number
  feesMinor?: number
  refundedMinor?: number
}

/** the only reward signal the engine optimises for */
export function grossProfitMinor(amounts: OrderAmounts) {
  const cost = amounts.costMinor ?? 0
  const fees = amounts.feesMinor ?? 0
  const refunded = amounts.refundedMinor ?? 0
  return Math.round(amounts.revenueMinor - cost - fees - refunded)
}

/** derive cost when a source has no margin data: unit cost first, then margin rate */
export function estimateCostMinor(input: {
  revenueMinor: number
  unitCostMinor?: number | null
  quantity?: number
  grossMarginRate?: number | null
}) {
  if (input.unitCostMinor != null) {
    return Math.round(input.unitCostMinor * (input.quantity ?? 1))
  }
  if (input.grossMarginRate != null) {
    const rate = Math.min(Math.max(input.grossMarginRate, 0), 1)
    return Math.round(input.revenueMinor * (1 - rate))
  }
  return 0
}

export function formatMinor(minor: number, currency: string, locale = 'en-GB') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(
    minor / 100,
  )
}

/** usd micro-dollars (1e-6 usd) for llm cost accounting */
export function usdToMicros(usd: number) {
  return Math.round(usd * 1_000_000)
}

export function microsToCents(micros: number) {
  return Math.round(micros / 10_000)
}
