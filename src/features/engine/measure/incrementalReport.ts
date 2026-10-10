import { classifyLift, isInGlobalHoldout, meanOf, welchDifference } from './stats'
import { finiteOrNull } from './metricsMath'

import type { IncrementalReportDto } from '../contract'
import type { Moments } from './stats'

/**
 * workspace incremental gross profit against the permanent holdout, intent to
 * treat: every contact counts in its group whether or not anything reached it.
 * incremental = (treated mean - holdout mean) x treated contacts.
 */

export const INCREMENTAL_MIN_SAMPLE = 100

/**
 * hash buckets below this number are in the global holdout; the same cut as
 * isInGlobalHoldout (rate clamped to 0..0.5, x10000, rounded) so sql and code agree
 */
export function holdoutBucketThreshold(globalHoldoutRate: number) {
  let lo = 0
  let hi = 10_000
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (isInGlobalHoldout(mid, globalHoldoutRate)) lo = mid + 1
    else hi = mid
  }
  return lo
}

export type IncrementalInput = {
  windowFrom: string
  windowTo: string
  currency: string
  holdoutRate: number
  treated: Moments
  holdout: Moments
  unattributedOrders: number
  minSample?: number
}

function roundOrNull(value: number | null) {
  return value == null ? null : Math.round(value)
}

function plainNote(input: IncrementalInput, verdict: IncrementalReportDto['verdict']) {
  const minSample = input.minSample ?? INCREMENTAL_MIN_SAMPLE
  const parts: string[] = []
  if (input.holdoutRate <= 0) {
    parts.push(
      'The workspace holdout rate is 0, so there is no baseline to compare against.',
    )
  } else if (verdict === 'collecting') {
    parts.push(
      `Collecting: both groups need at least ${minSample} contacts (treated ${input.treated.n}, holdout ${input.holdout.n}) before a result is called.`,
    )
  } else if (verdict === 'positive') {
    parts.push(
      'Contacts outside the holdout produced more gross profit per head; the 95% interval is above zero.',
    )
  } else if (verdict === 'negative') {
    parts.push(
      'Contacts outside the holdout produced less gross profit per head; the 95% interval is below zero.',
    )
  } else {
    parts.push(
      'The 95% interval includes zero, so no difference between the groups can be claimed yet.',
    )
  }
  parts.push(
    'Before any automated programme runs, both groups are untreated, so the estimate should straddle zero; a persistent gap before then points at a biased split or bad data.',
  )
  if (input.unattributedOrders > 0) {
    parts.push(
      `${input.unattributedOrders} paid order${input.unattributedOrders === 1 ? '' : 's'} in the window could not be tied to a contact and are excluded.`,
    )
  }
  return parts.join(' ')
}

export function buildIncrementalReport(input: IncrementalInput): IncrementalReportDto {
  const welch = welchDifference(input.treated, input.holdout)
  const scale = input.treated.n
  const estimate = finiteOrNull(welch.estimate)
  const low = finiteOrNull(welch.low)
  const high = finiteOrNull(welch.high)
  const verdict = classifyLift({
    low: welch.low,
    high: welch.high,
    nTreatment: input.treated.n,
    nBaseline: input.holdout.n,
    minSample: input.minSample ?? INCREMENTAL_MIN_SAMPLE,
  })
  return {
    method: 'global_holdout',
    windowFrom: input.windowFrom,
    windowTo: input.windowTo,
    currency: input.currency,
    holdoutRate: input.holdoutRate,
    treatedContacts: input.treated.n,
    holdoutContacts: input.holdout.n,
    treatedMeanMinor: meanOf(input.treated),
    holdoutMeanMinor: meanOf(input.holdout),
    incrementalMinor: roundOrNull(estimate == null ? null : estimate * scale),
    ciLowMinor: roundOrNull(low == null ? null : low * scale),
    ciHighMinor: roundOrNull(high == null ? null : high * scale),
    pValue: finiteOrNull(welch.pValue),
    verdict,
    unattributedOrders: input.unattributedOrders,
    note: plainNote(input, verdict),
  }
}
