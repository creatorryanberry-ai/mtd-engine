import { describe, expect, it } from 'vitest'

import {
  chiSquareSurvival,
  classifyLift,
  incompleteBeta,
  isInGlobalHoldout,
  lnGamma,
  meanOf,
  minimumDetectableMean,
  momentsOf,
  normalCdf,
  normalQuantile,
  pickArm,
  probabilityTreatmentBetter,
  proportionDifference,
  relativeLift,
  sampleRatioMismatch,
  sampleSizeForConversion,
  sampleSizeForMean,
  studentTCdf,
  studentTQuantile,
  varianceOf,
  welchDifference,
  wilsonInterval,
} from '~/features/engine/measure/stats'

describe('special functions', () => {
  it('lnGamma matches factorials', () => {
    expect(Math.exp(lnGamma(5))).toBeCloseTo(24, 8)
    expect(Math.exp(lnGamma(0.5))).toBeCloseTo(Math.sqrt(Math.PI), 8)
  })

  it('incompleteBeta matches known values', () => {
    expect(incompleteBeta(0.5, 2, 2)).toBeCloseTo(0.5, 10)
    // I_0.3(2,5) = 0.579825
    expect(incompleteBeta(0.3, 2, 5)).toBeCloseTo(0.579825, 5)
  })
})

describe('distributions', () => {
  it('normal cdf and quantile are inverse and match tables', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 7)
    expect(normalCdf(1.959964)).toBeCloseTo(0.975, 5)
    expect(normalCdf(-1.644854)).toBeCloseTo(0.05, 5)
    expect(normalQuantile(0.975)).toBeCloseTo(1.959964, 5)
    expect(normalQuantile(0.8)).toBeCloseTo(0.841621, 5)
    expect(normalQuantile(0.001)).toBeCloseTo(-3.090232, 5)
  })

  it('student t quantiles match tables', () => {
    expect(studentTQuantile(0.975, 10)).toBeCloseTo(2.228139, 4)
    expect(studentTQuantile(0.975, 30)).toBeCloseTo(2.042272, 4)
    expect(studentTQuantile(0.975, 2)).toBeCloseTo(4.302653, 4)
    expect(studentTQuantile(0.025, 10)).toBeCloseTo(-2.228139, 4)
    expect(studentTCdf(2.228139, 10)).toBeCloseTo(0.975, 5)
  })

  it('chi-square survival matches tables', () => {
    expect(chiSquareSurvival(3.841459, 1)).toBeCloseTo(0.05, 5)
    expect(chiSquareSurvival(5.991465, 2)).toBeCloseTo(0.05, 5)
    expect(chiSquareSurvival(0, 3)).toBe(1)
  })
})

describe('moments', () => {
  it('computes mean and sample variance from sufficient statistics', () => {
    const m = momentsOf([2, 4, 4, 4, 5, 5, 7, 9])
    expect(meanOf(m)).toBe(5)
    expect(varianceOf(m)).toBeCloseTo(32 / 7, 10)
    expect(varianceOf(momentsOf([3]))).toBe(0)
  })
})

describe('welchDifference', () => {
  it('matches a hand-computed welch interval', () => {
    const a = momentsOf([19.8, 20.4, 19.6, 17.8, 18.5, 18.9, 18.3, 18.9, 19.5, 22.0])
    const b = momentsOf([
      28.2, 26.6, 20.1, 23.3, 25.2, 22.1, 17.7, 27.6, 20.6, 13.7, 23.2, 17.5, 20.6, 18.0,
      23.9, 21.6, 24.3, 20.4, 23.9, 13.3,
    ])
    const r = welchDifference(a, b)
    // reference: scipy.stats.ttest_ind(a, b, equal_var=False) and t.ppf(0.975, df)
    expect(r.estimate / r.standardError).toBeCloseTo(-2.225512, 5)
    expect(r.df).toBeCloseTo(24.524635, 4)
    expect(r.pValue).toBeCloseTo(0.035485, 5)
    expect(r.low).toBeCloseTo(-4.276459, 4)
    expect(r.high).toBeCloseTo(-0.163541, 4)
  })

  it('is undefined below two observations per group', () => {
    const r = welchDifference(momentsOf([1]), momentsOf([1, 2, 3]))
    expect(r.pValue).toBeNull()
    expect(r.low).toBe(Number.NEGATIVE_INFINITY)
  })
})

describe('proportions', () => {
  it('wilson interval matches reference', () => {
    // 15/148 at 95%: 0.0624 to 0.1605 (newcombe 1998)
    const w = wilsonInterval({ n: 148, conversions: 15 })
    expect(w.low).toBeCloseTo(0.0624, 3)
    expect(w.high).toBeCloseTo(0.1605, 3)
  })

  it('newcombe difference matches reference', () => {
    // newcombe 1998 example: 56/70 vs 48/80 -> 0.0524 to 0.3339
    const d = proportionDifference({ n: 70, conversions: 56 }, { n: 80, conversions: 48 })
    expect(d.estimate).toBeCloseTo(0.2, 6)
    expect(d.low).toBeCloseTo(0.0524, 3)
    expect(d.high).toBeCloseTo(0.3339, 3)
    expect(d.pValue).toBeLessThan(0.01)
  })

  it('probability treatment better is symmetric and sensible', () => {
    const same = probabilityTreatmentBetter(
      { n: 1000, conversions: 100 },
      { n: 1000, conversions: 100 },
    )
    expect(same).toBeCloseTo(0.5, 2)
    const better = probabilityTreatmentBetter(
      { n: 1000, conversions: 130 },
      { n: 1000, conversions: 100 },
    )
    // monte carlo reference with 2m beta draws: 0.98226
    expect(better).toBeCloseTo(0.9823, 3)
    const reverse = probabilityTreatmentBetter(
      { n: 1000, conversions: 100 },
      { n: 1000, conversions: 130 },
    )
    expect(better + reverse).toBeCloseTo(1, 3)
  })

  it('uses the normal approximation for very large counts without blowing up', () => {
    const p = probabilityTreatmentBetter(
      { n: 500_000, conversions: 50_500 },
      { n: 500_000, conversions: 50_000 },
    )
    expect(p).toBeGreaterThan(0.9)
    expect(p).toBeLessThanOrEqual(1)
  })
})

describe('sample ratio mismatch', () => {
  it('passes a healthy split and flags a broken one', () => {
    expect(sampleRatioMismatch([905, 95], [0.9, 0.1]).pValue).toBeGreaterThan(0.05)
    expect(sampleRatioMismatch([950, 50], [0.9, 0.1]).pValue).toBeLessThan(0.001)
  })
})

describe('decisions', () => {
  it('refuses to call a result below the minimum sample', () => {
    expect(
      classifyLift({ low: 1, high: 2, nTreatment: 50, nBaseline: 500, minSample: 200 }),
    ).toBe('collecting')
    expect(
      classifyLift({ low: 1, high: 2, nTreatment: 500, nBaseline: 500, minSample: 200 }),
    ).toBe('positive')
    expect(
      classifyLift({
        low: -2,
        high: -1,
        nTreatment: 500,
        nBaseline: 500,
        minSample: 200,
      }),
    ).toBe('negative')
    expect(
      classifyLift({ low: -1, high: 2, nTreatment: 500, nBaseline: 500, minSample: 200 }),
    ).toBe('inconclusive')
  })

  it('relative lift divides by the baseline level', () => {
    expect(relativeLift({ estimate: 10, low: 5, high: 15, pValue: 0.01 }, 100)).toEqual({
      estimate: 0.1,
      low: 0.05,
      high: 0.15,
    })
    expect(relativeLift({ estimate: 10, low: 5, high: 15, pValue: 0.01 }, 0)).toBeNull()
  })
})

describe('planning', () => {
  it('conversion sample size matches the textbook 50/50 case', () => {
    // 10% -> 12% at alpha .05 power .8, 50/50: about 3,840 per arm (7,680 total)
    const s = sampleSizeForConversion({
      baselineRate: 0.1,
      relativeLift: 0.2,
      baselineShare: 0.5,
    })
    expect(s).not.toBeNull()
    expect(s!.total).toBeGreaterThan(7_500)
    expect(s!.total).toBeLessThan(7_800)
  })

  it('small holdouts need a bigger population', () => {
    const even = sampleSizeForMean({
      standardDeviation: 100,
      minimumEffect: 10,
      baselineShare: 0.5,
    })!
    const skewed = sampleSizeForMean({
      standardDeviation: 100,
      minimumEffect: 10,
      baselineShare: 0.1,
    })!
    expect(skewed.total).toBeGreaterThan(even.total * 2.5)
    expect(skewed.baseline / skewed.total).toBeCloseTo(0.1, 2)
  })

  it('mde is the inverse of the mean sample size', () => {
    const s = sampleSizeForMean({
      standardDeviation: 50,
      minimumEffect: 5,
      baselineShare: 0.2,
    })!
    const mde = minimumDetectableMean({
      standardDeviation: 50,
      total: s.total,
      baselineShare: 0.2,
    })!
    expect(mde).toBeCloseTo(5, 1)
  })
})

describe('assignment', () => {
  const arms = [
    { id: 'a', weight: 1 },
    { id: 'b', weight: 1 },
  ]

  it('sends draws below the holdout rate to holdout', () => {
    expect(pickArm(0.05, 0.1, arms)).toEqual({ armId: null, isHoldout: true })
    expect(pickArm(0.1, 0.1, arms).isHoldout).toBe(false)
  })

  it('splits the remaining draws by weight', () => {
    const counts = { a: 0, b: 0, holdout: 0 }
    for (let i = 0; i < 10_000; i++) {
      const r = pickArm(i / 10_000, 0.1, arms)
      if (r.isHoldout) counts.holdout++
      else counts[r.armId as 'a' | 'b']++
    }
    expect(counts.holdout).toBe(1000)
    expect(counts.a).toBe(4500)
    expect(counts.b).toBe(4500)
  })

  it('respects uneven weights', () => {
    let a = 0
    for (let i = 0; i < 10_000; i++)
      if (
        pickArm(i / 10_000, 0, [
          { id: 'a', weight: 3 },
          { id: 'b', weight: 1 },
        ]).armId === 'a'
      )
        a++
    expect(a).toBe(7500)
  })

  it('global holdout uses the bucket and caps at 50%', () => {
    expect(isInGlobalHoldout(499, 0.05)).toBe(true)
    expect(isInGlobalHoldout(500, 0.05)).toBe(false)
    expect(isInGlobalHoldout(5_000, 0.9)).toBe(false)
    expect(isInGlobalHoldout(4_999, 0.9)).toBe(true)
  })
})
