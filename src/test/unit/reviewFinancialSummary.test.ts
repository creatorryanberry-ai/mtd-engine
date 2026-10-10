import { describe, expect, it } from 'vitest'

import {
  estimateClass4NationalInsurance,
  estimateTaxDue,
} from '~/features/submission/reviewFinancialEstimates'

describe('estimateTaxDue', () => {
  it('returns 0 when profit is not positive', () => {
    expect(estimateTaxDue(0)).toBe(0)
    expect(estimateTaxDue(-100)).toBe(0)
  })

  it('applies the homepage 15% mock rate', () => {
    expect(estimateTaxDue(10_000)).toBe(1_500)
    expect(estimateTaxDue(100.5)).toBe(15.08)
  })
})

describe('estimateClass4NationalInsurance', () => {
  it('returns 0 at or below lower profits limit', () => {
    expect(estimateClass4NationalInsurance(0)).toBe(0)
    expect(estimateClass4NationalInsurance(12_570)).toBe(0)
  })

  it('applies main rate between lower and upper limits', () => {
    // (22570 - 12570) * 6% = 600
    expect(estimateClass4NationalInsurance(22_570)).toBe(600)
  })

  it('applies higher rate above upper profits limit', () => {
    // (50270 - 12570) * 6% + (60270 - 50270) * 2% = 2262 + 200 = 2462
    expect(estimateClass4NationalInsurance(60_270)).toBe(2_462)
  })
})
