import { describe, expect, it } from 'vitest'

import {
  attributionFlags,
  combineExperimentLifts,
} from '~/features/engine/measure/triangulation'

import type { FlagInput } from '~/features/engine/measure/triangulation'

function input(overrides: Partial<FlagInput> = {}): FlagInput {
  return {
    channelKey: 'meta_ads',
    spendMinor: 0,
    firstParty: { conversions: 10, grossProfitMinor: 100_000 },
    firstPartyLastTouch: { conversions: 10, grossProfitMinor: 100_000 },
    platform: null,
    experiment: null,
    ...overrides,
  }
}

function codes(flagInput: FlagInput) {
  return attributionFlags(flagInput).map((flag) => `${flag.code}:${flag.level}`)
}

describe('attributionFlags', () => {
  it('raises nothing when sources agree and there is no spend', () => {
    expect(attributionFlags(input())).toEqual([])
  })

  it('platform_overclaims above 1.5x first-party last touch', () => {
    expect(codes(input({ platform: { conversions: 15, revenueMinor: 0 } }))).toEqual([])
    expect(codes(input({ platform: { conversions: 16, revenueMinor: 0 } }))).toEqual([
      'platform_overclaims:warning',
    ])
  })

  it('platform_overclaims compares against last touch, not the requested model', () => {
    const flagInput = input({
      firstParty: { conversions: 100, grossProfitMinor: 0 },
      firstPartyLastTouch: { conversions: 2, grossProfitMinor: 0 },
      platform: { conversions: 4, revenueMinor: 0 },
    })
    expect(codes(flagInput)).toEqual(['platform_overclaims:warning'])
  })

  it('platform claims with no first-party conversions overclaim', () => {
    const flagInput = input({
      firstPartyLastTouch: { conversions: 0, grossProfitMinor: 0 },
      platform: { conversions: 1, revenueMinor: 500 },
    })
    expect(codes(flagInput)).toEqual(['platform_overclaims:warning'])
    expect(
      codes({ ...flagInput, platform: { conversions: 0, revenueMinor: 0 } }),
    ).toEqual([])
  })

  it('no_incrementality_evidence when spending without an experiment', () => {
    expect(codes(input({ spendMinor: 1 }))).toEqual(['no_incrementality_evidence:info'])
    const withExperiment = input({
      spendMinor: 1,
      experiment: {
        experiments: 1,
        incrementalGrossProfitMinor: 90_000,
        ciLowMinor: -10_000,
        ciHighMinor: 190_000,
      },
    })
    expect(codes(withExperiment)).toEqual([])
  })

  it('experiment_disagrees only when the interval excludes zero and gp is outside 0.5x..2x', () => {
    const experiment = {
      experiments: 1,
      incrementalGrossProfitMinor: 40_000,
      ciLowMinor: 10_000,
      ciHighMinor: 70_000,
    }
    // 100k first party vs 40k incremental: 2.5x
    expect(codes(input({ experiment }))).toEqual(['experiment_disagrees:warning'])
    // 80k is exactly 2x: inside the band
    expect(
      codes(
        input({ experiment, firstParty: { conversions: 1, grossProfitMinor: 80_000 } }),
      ),
    ).toEqual([])
    // 19k is below 0.5x
    expect(
      codes(
        input({ experiment, firstParty: { conversions: 1, grossProfitMinor: 19_000 } }),
      ),
    ).toEqual(['experiment_disagrees:warning'])
    // interval straddles zero: no claim to disagree with
    expect(codes(input({ experiment: { ...experiment, ciLowMinor: -5_000 } }))).toEqual(
      [],
    )
    // missing interval: no claim either
    expect(
      codes(
        input({ experiment: { ...experiment, ciLowMinor: null, ciHighMinor: null } }),
      ),
    ).toEqual([])
  })

  it('sign_mismatch when the experiment is entirely negative but first party is positive', () => {
    const experiment = {
      experiments: 2,
      incrementalGrossProfitMinor: -50_000,
      ciLowMinor: -80_000,
      ciHighMinor: -20_000,
    }
    expect(codes(input({ experiment }))).toEqual(['sign_mismatch:critical'])
    // negative first party within the band agrees
    expect(
      codes(
        input({ experiment, firstParty: { conversions: 1, grossProfitMinor: -60_000 } }),
      ),
    ).toEqual([])
    // zero first party is not a sign mismatch but is outside the band
    expect(
      codes(input({ experiment, firstParty: { conversions: 0, grossProfitMinor: 0 } })),
    ).toEqual(['experiment_disagrees:warning'])
  })

  it('stacks independent flags', () => {
    const flagInput = input({
      spendMinor: 5_000,
      platform: { conversions: 100, revenueMinor: 1 },
    })
    expect(codes(flagInput)).toEqual([
      'platform_overclaims:warning',
      'no_incrementality_evidence:info',
    ])
    for (const flag of attributionFlags(flagInput)) {
      expect(flag.message).toContain('meta_ads')
    }
  })
})

describe('combineExperimentLifts', () => {
  it('is null without results', () => {
    expect(combineExperimentLifts([])).toBeNull()
  })

  it('sums incrementals and combines half-widths in quadrature', () => {
    const combined = combineExperimentLifts([
      {
        incrementalGrossProfitMinor: 100,
        incrementalCiLowMinor: 70,
        incrementalCiHighMinor: 130,
      },
      {
        incrementalGrossProfitMinor: 50,
        incrementalCiLowMinor: 10,
        incrementalCiHighMinor: 90,
      },
    ])
    // half widths 30 and 40 -> 50
    expect(combined).toEqual({
      experiments: 2,
      incrementalGrossProfitMinor: 150,
      ciLowMinor: 100,
      ciHighMinor: 200,
    })
  })

  it('drops the interval when any experiment lacks one', () => {
    const combined = combineExperimentLifts([
      {
        incrementalGrossProfitMinor: 100,
        incrementalCiLowMinor: 70,
        incrementalCiHighMinor: 130,
      },
      {
        incrementalGrossProfitMinor: 5,
        incrementalCiLowMinor: null,
        incrementalCiHighMinor: null,
      },
    ])
    expect(combined).toEqual({
      experiments: 2,
      incrementalGrossProfitMinor: 105,
      ciLowMinor: null,
      ciHighMinor: null,
    })
  })
})
