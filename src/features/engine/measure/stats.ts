/**
 * isomorphic statistics for the measure stage. no node, db or react imports so
 * the client (sample size calculator) and the server (experiment results) share
 * one implementation. all monetary inputs are minor units.
 *
 * methods:
 * - gross profit per contact: welch's t interval on the difference in means
 * - conversion rate: newcombe hybrid score interval on the difference in
 *   proportions, two-proportion z test, and a beta-binomial probability that
 *   treatment beats baseline
 * - allocation sanity: chi-square sample ratio mismatch test
 */

// --- special functions -------------------------------------------------------

const LANCZOS = [
  676.5203681218851, -1259.1392167224028, 771.3234287776531, -176.6150291621406,
  12.507343278686905, -0.13857109526572012, 9.984369578019572e-6, 1.5056327351493116e-7,
]

export function lnGamma(x: number): number {
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x)
  }
  const z = x - 1
  let a = 0.9999999999998099
  const t = z + 7.5
  for (let i = 0; i < LANCZOS.length; i++) a += LANCZOS[i]! / (z + i + 1)
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a)
}

export function lnBeta(a: number, b: number) {
  return lnGamma(a) + lnGamma(b) - lnGamma(a + b)
}

/** continued fraction for the incomplete beta (numerical recipes betacf) */
function betaContinuedFraction(a: number, b: number, x: number) {
  const maxIterations = 300
  const epsilon = 3e-14
  const tiny = 1e-300
  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c = 1
  let d = 1 - (qab * x) / qap
  if (Math.abs(d) < tiny) d = tiny
  d = 1 / d
  let h = d
  for (let m = 1; m <= maxIterations; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < tiny) d = tiny
    c = 1 + aa / c
    if (Math.abs(c) < tiny) c = tiny
    d = 1 / d
    h *= d * c
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < tiny) d = tiny
    c = 1 + aa / c
    if (Math.abs(c) < tiny) c = tiny
    d = 1 / d
    const delta = d * c
    h *= delta
    if (Math.abs(delta - 1) < epsilon) break
  }
  return h
}

/** regularized incomplete beta I_x(a, b) */
export function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - lnBeta(a, b))
  if (x < (a + 1) / (a + b + 2)) {
    return (front * betaContinuedFraction(a, b, x)) / a
  }
  return 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b
}

/** regularized lower incomplete gamma P(a, x) */
export function incompleteGamma(a: number, x: number): number {
  if (x <= 0) return 0
  const gln = lnGamma(a)
  if (x < a + 1) {
    let sum = 1 / a
    let term = sum
    let ap = a
    for (let n = 0; n < 500; n++) {
      ap += 1
      term *= x / ap
      sum += term
      if (Math.abs(term) < Math.abs(sum) * 3e-14) break
    }
    return sum * Math.exp(-x + a * Math.log(x) - gln)
  }
  const tiny = 1e-300
  let b = x + 1 - a
  let c = 1 / tiny
  let d = 1 / b
  let h = d
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - a)
    b += 2
    d = an * d + b
    if (Math.abs(d) < tiny) d = tiny
    c = b + an / c
    if (Math.abs(c) < tiny) c = tiny
    d = 1 / d
    const delta = d * c
    h *= delta
    if (Math.abs(delta - 1) < 3e-14) break
  }
  return 1 - Math.exp(-x + a * Math.log(x) - gln) * h
}

// --- distributions -----------------------------------------------------------

/** complementary error function (numerical recipes erfcc), |error| < 1.2e-7 */
export function erfc(x: number): number {
  const z = Math.abs(x)
  const t = 1 / (1 + 0.5 * z)
  const poly =
    -1.26551223 +
    t *
      (1.00002368 +
        t *
          (0.37409196 +
            t *
              (0.09678418 +
                t *
                  (-0.18628806 +
                    t *
                      (0.27886807 +
                        t *
                          (-1.13520398 +
                            t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))
  const r = t * Math.exp(-z * z + poly)
  return x >= 0 ? r : 2 - r
}

export function normalCdf(z: number): number {
  return 0.5 * erfc(-z / Math.SQRT2)
}

/** acklam's rational approximation, relative error < 1.15e-9 */
export function normalQuantile(p: number): number {
  if (p <= 0) return Number.NEGATIVE_INFINITY
  if (p >= 1) return Number.POSITIVE_INFINITY
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2,
    -3.066479806614716e1, 2.506628277459239,
  ]
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1,
    -1.328068155288572e1,
  ]
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734,
    4.374664141464968, 2.938163982698783,
  ]
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416,
  ]
  const low = 0.02425
  const high = 1 - low
  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p))
    return (
      (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
    )
  }
  if (p <= high) {
    const q = p - 0.5
    const r = q * q
    return (
      ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q) /
      (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1)
    )
  }
  const q = Math.sqrt(-2 * Math.log(1 - p))
  return -(
    (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
    ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
  )
}

export function studentTCdf(t: number, df: number): number {
  if (!Number.isFinite(df) || df > 1e7) return normalCdf(t)
  const x = df / (df + t * t)
  const tail = 0.5 * incompleteBeta(x, df / 2, 0.5)
  return t >= 0 ? 1 - tail : tail
}

/** inverse student t by bisection on the exact cdf */
export function studentTQuantile(p: number, df: number): number {
  if (!Number.isFinite(df) || df > 1e7) return normalQuantile(p)
  if (p === 0.5) return 0
  if (p < 0.5) return -studentTQuantile(1 - p, df)
  let lo = 0
  let hi = 1
  while (studentTCdf(hi, df) < p && hi < 1e6) hi *= 2
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (studentTCdf(mid, df) < p) lo = mid
    else hi = mid
    if (hi - lo < 1e-12) break
  }
  return (lo + hi) / 2
}

export function chiSquareSurvival(x: number, df: number): number {
  if (x <= 0) return 1
  return 1 - incompleteGamma(df / 2, x / 2)
}

// --- summaries -----------------------------------------------------------------

/** sufficient statistics: what sql returns so raw rows never leave the db */
export type Moments = { n: number; sum: number; sumSq: number }

export function momentsOf(values: number[]): Moments {
  let sum = 0
  let sumSq = 0
  for (const value of values) {
    sum += value
    sumSq += value * value
  }
  return { n: values.length, sum, sumSq }
}

export function meanOf(m: Moments) {
  return m.n > 0 ? m.sum / m.n : 0
}

/** unbiased sample variance; 0 below two observations */
export function varianceOf(m: Moments) {
  if (m.n < 2) return 0
  const v = (m.sumSq - (m.sum * m.sum) / m.n) / (m.n - 1)
  return v > 0 ? v : 0
}

export type Interval = {
  estimate: number
  low: number
  high: number
  /** two-sided p-value against no difference; null when undefined */
  pValue: number | null
}

/** welch's t interval for mean(treatment) - mean(baseline) */
export function welchDifference(
  treatment: Moments,
  baseline: Moments,
  confidence = 0.95,
): Interval & { df: number; standardError: number } {
  const estimate = meanOf(treatment) - meanOf(baseline)
  if (treatment.n < 2 || baseline.n < 2) {
    return {
      estimate,
      low: Number.NEGATIVE_INFINITY,
      high: Number.POSITIVE_INFINITY,
      pValue: null,
      df: 0,
      standardError: Number.POSITIVE_INFINITY,
    }
  }
  const vt = varianceOf(treatment) / treatment.n
  const vb = varianceOf(baseline) / baseline.n
  const se = Math.sqrt(vt + vb)
  if (se === 0) {
    return {
      estimate,
      low: estimate,
      high: estimate,
      pValue: estimate === 0 ? 1 : 0,
      df: Infinity,
      standardError: 0,
    }
  }
  const df =
    (vt + vb) ** 2 / ((vt * vt) / (treatment.n - 1) + (vb * vb) / (baseline.n - 1))
  const crit = studentTQuantile(1 - (1 - confidence) / 2, df)
  const tStat = estimate / se
  const pValue = 2 * (1 - studentTCdf(Math.abs(tStat), df))
  return {
    estimate,
    low: estimate - crit * se,
    high: estimate + crit * se,
    pValue,
    df,
    standardError: se,
  }
}

export type Counts = { n: number; conversions: number }

export function wilsonInterval(c: Counts, confidence = 0.95) {
  if (c.n === 0) return { estimate: 0, low: 0, high: 1 }
  const z = normalQuantile(1 - (1 - confidence) / 2)
  const p = c.conversions / c.n
  const z2n = (z * z) / c.n
  const centre = (p + z2n / 2) / (1 + z2n)
  const half = (z * Math.sqrt((p * (1 - p)) / c.n + z2n / (4 * c.n))) / (1 + z2n)
  return {
    estimate: p,
    low: Math.max(0, centre - half),
    high: Math.min(1, centre + half),
  }
}

/** newcombe hybrid score interval for p(treatment) - p(baseline) */
export function proportionDifference(
  treatment: Counts,
  baseline: Counts,
  confidence = 0.95,
): Interval {
  const t = wilsonInterval(treatment, confidence)
  const b = wilsonInterval(baseline, confidence)
  const estimate = t.estimate - b.estimate
  const low = estimate - Math.sqrt((t.estimate - t.low) ** 2 + (b.high - b.estimate) ** 2)
  const high =
    estimate + Math.sqrt((t.high - t.estimate) ** 2 + (b.estimate - b.low) ** 2)

  let pValue: number | null = null
  if (treatment.n > 0 && baseline.n > 0) {
    const pooled =
      (treatment.conversions + baseline.conversions) / (treatment.n + baseline.n)
    const se = Math.sqrt(pooled * (1 - pooled) * (1 / treatment.n + 1 / baseline.n))
    pValue =
      se === 0 ? (estimate === 0 ? 1 : 0) : 2 * (1 - normalCdf(Math.abs(estimate / se)))
  }
  return { estimate, low, high, pValue }
}

/**
 * P(rate_treatment > rate_baseline) under independent beta(1+x, 1+n-x)
 * posteriors. exact sum (evan miller) for moderate counts, normal
 * approximation beyond that.
 */
export function probabilityTreatmentBetter(treatment: Counts, baseline: Counts): number {
  const aT = 1 + treatment.conversions
  const bT = 1 + treatment.n - treatment.conversions
  const aB = 1 + baseline.conversions
  const bB = 1 + baseline.n - baseline.conversions
  if (aT <= 20_000) {
    let total = 0
    for (let i = 0; i < aT; i++) {
      total += Math.exp(
        lnBeta(aB + i, bB + bT) - Math.log(bT + i) - lnBeta(1 + i, bT) - lnBeta(aB, bB),
      )
    }
    return Math.min(1, Math.max(0, total))
  }
  const meanT = aT / (aT + bT)
  const meanB = aB / (aB + bB)
  const varT = (aT * bT) / ((aT + bT) ** 2 * (aT + bT + 1))
  const varB = (aB * bB) / ((aB + bB) ** 2 * (aB + bB + 1))
  return normalCdf((meanT - meanB) / Math.sqrt(varT + varB))
}

/** chi-square goodness of fit of observed group sizes against intended shares */
export function sampleRatioMismatch(observed: number[], expectedShares: number[]) {
  const total = observed.reduce((a, b) => a + b, 0)
  const shareTotal = expectedShares.reduce((a, b) => a + b, 0)
  if (total === 0 || observed.length < 2 || shareTotal <= 0) {
    return { chiSquare: 0, pValue: 1 }
  }
  let chiSquare = 0
  for (let i = 0; i < observed.length; i++) {
    const expected = (total * expectedShares[i]!) / shareTotal
    if (expected > 0) chiSquare += (observed[i]! - expected) ** 2 / expected
  }
  return { chiSquare, pValue: chiSquareSurvival(chiSquare, observed.length - 1) }
}

// --- decisions -----------------------------------------------------------------

export type LiftVerdict = 'collecting' | 'positive' | 'negative' | 'inconclusive'

/** the engine only calls a result once both groups reach the minimum sample */
export function classifyLift(input: {
  low: number
  high: number
  nTreatment: number
  nBaseline: number
  minSample: number
}): LiftVerdict {
  if (input.nTreatment < input.minSample || input.nBaseline < input.minSample) {
    return 'collecting'
  }
  if (input.low > 0) return 'positive'
  if (input.high < 0) return 'negative'
  return 'inconclusive'
}

/** relative lift of a difference against the baseline level, ignoring baseline noise */
export function relativeLift(interval: Interval, baselineLevel: number) {
  if (!(baselineLevel > 0)) return null
  return {
    estimate: interval.estimate / baselineLevel,
    low: interval.low / baselineLevel,
    high: interval.high / baselineLevel,
  }
}

// --- planning --------------------------------------------------------------------

export type PowerInput = {
  /** two-sided significance level, default 0.05 */
  alpha?: number
  /** default 0.8 */
  power?: number
  /** share of the population in the baseline (holdout/control), 0..1 */
  baselineShare: number
}

function zSum(alpha = 0.05, power = 0.8) {
  return normalQuantile(1 - alpha / 2) + normalQuantile(power)
}

function allocationFactor(baselineShare: number) {
  const r = Math.min(Math.max(baselineShare, 1e-6), 1 - 1e-6)
  return { r, factor: 1 / r + 1 / (1 - r) }
}

/** total population needed to detect a relative lift in a conversion rate */
export function sampleSizeForConversion(
  input: PowerInput & { baselineRate: number; relativeLift: number },
) {
  const p1 = input.baselineRate
  const p2 = p1 * (1 + input.relativeLift)
  const delta = p2 - p1
  if (!(p1 > 0 && p1 < 1) || !(p2 > 0 && p2 < 1) || delta === 0) return null
  const { r } = allocationFactor(input.baselineShare)
  const z = zSum(input.alpha, input.power)
  const total =
    (z * z * ((p1 * (1 - p1)) / r + (p2 * (1 - p2)) / (1 - r))) / (delta * delta)
  return splitTotal(Math.ceil(total), r)
}

/** total population needed to detect an absolute change in a mean (e.g. gp per contact) */
export function sampleSizeForMean(
  input: PowerInput & { standardDeviation: number; minimumEffect: number },
) {
  if (!(input.standardDeviation > 0) || input.minimumEffect === 0) return null
  const { r, factor } = allocationFactor(input.baselineShare)
  const z = zSum(input.alpha, input.power)
  const total = (z * z * input.standardDeviation ** 2 * factor) / input.minimumEffect ** 2
  return splitTotal(Math.ceil(total), r)
}

/** smallest absolute effect on a mean detectable with a given total population */
export function minimumDetectableMean(
  input: PowerInput & { standardDeviation: number; total: number },
) {
  if (!(input.total > 0) || !(input.standardDeviation > 0)) return null
  const { factor } = allocationFactor(input.baselineShare)
  return (
    zSum(input.alpha, input.power) *
    input.standardDeviation *
    Math.sqrt(factor / input.total)
  )
}

function splitTotal(total: number, baselineShare: number) {
  const baseline = Math.ceil(total * baselineShare)
  return { total, baseline, treatment: Math.max(0, total - baseline) }
}

// --- assignment --------------------------------------------------------------------

export type ArmWeight = { id: string; weight: number }

/**
 * map a uniform draw u in [0,1) to holdout or an arm. the draw comes from a
 * salted hash of the contact id (server side) so assignment is deterministic.
 */
export function pickArm(u: number, holdoutRate: number, arms: ArmWeight[]) {
  const rate = Math.min(Math.max(holdoutRate, 0), 1)
  if (u < rate || arms.length === 0) return { armId: null, isHoldout: true }
  const scaled = rate >= 1 ? 0 : (u - rate) / (1 - rate)
  const total = arms.reduce((acc, arm) => acc + Math.max(arm.weight, 0), 0)
  if (total <= 0) {
    const index = Math.min(arms.length - 1, Math.floor(scaled * arms.length))
    return { armId: arms[index]!.id, isHoldout: false }
  }
  let cumulative = 0
  for (const arm of arms) {
    cumulative += Math.max(arm.weight, 0) / total
    if (scaled < cumulative) return { armId: arm.id, isHoldout: false }
  }
  return { armId: arms[arms.length - 1]!.id, isHoldout: false }
}

/** contacts in the permanent workspace holdout (hashBucket is 0..9999) */
export function isInGlobalHoldout(hashBucket: number, globalHoldoutRate: number) {
  return hashBucket < Math.round(Math.min(Math.max(globalHoldoutRate, 0), 0.5) * 10_000)
}
