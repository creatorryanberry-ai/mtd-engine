import type { AttributionChannelDto } from '../contract'

/**
 * attribution triangulation rules. first-party credit, platform claims and
 * holdout-backed experiment lift are reported side by side, never blended;
 * when they disagree the channel gets a flag. pure so it is unit tested.
 */

export type AttributionFlag = AttributionChannelDto['flags'][number]
type Credit = AttributionChannelDto['firstParty']
type PlatformNumbers = NonNullable<AttributionChannelDto['platform']>
type ExperimentLift = NonNullable<AttributionChannelDto['experiment']>

export const PLATFORM_OVERCLAIM_RATIO = 1.5
export const EXPERIMENT_AGREEMENT_BAND = { low: 0.5, high: 2 } as const

export type FlagInput = {
  channelKey: string
  spendMinor: number
  /** credit under the requested model */
  firstParty: Credit
  /** first-party last-touch credit (what platforms are compared against) */
  firstPartyLastTouch: Credit
  platform: PlatformNumbers | null
  experiment: ExperimentLift | null
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

/**
 * - platform_overclaims (warning): platform conversions > 1.5x first-party last-touch conversions
 * - sign_mismatch (critical): experiment interval entirely below zero while first-party gp is positive
 * - experiment_disagrees (warning): experiment interval excludes zero and first-party gp (requested
 *   model) sits outside [0.5x, 2x] of the experiment's incremental gp; not raised alongside sign_mismatch
 * - no_incrementality_evidence (info): spend > 0 and no experiment result for the channel
 */
export function attributionFlags(input: FlagInput): AttributionFlag[] {
  const flags: AttributionFlag[] = []
  const { channelKey, platform, experiment, firstParty, firstPartyLastTouch } = input

  if (
    platform &&
    platform.conversions > PLATFORM_OVERCLAIM_RATIO * firstPartyLastTouch.conversions
  ) {
    flags.push({
      code: 'platform_overclaims',
      level: 'warning',
      message: `${channelKey} reports ${formatNumber(platform.conversions)} conversions but first-party last touch credits ${formatNumber(firstPartyLastTouch.conversions)}`,
    })
  }

  if (experiment) {
    const low = experiment.ciLowMinor
    const high = experiment.ciHighMinor
    const excludesZero = low != null && high != null && (low > 0 || high < 0)
    const signMismatch = high != null && high < 0 && firstParty.grossProfitMinor > 0
    if (signMismatch) {
      flags.push({
        code: 'sign_mismatch',
        level: 'critical',
        message: `${channelKey} lowers gross profit in holdout experiments, yet first-party attribution credits it with positive gross profit`,
      })
    } else if (excludesZero) {
      const incremental = experiment.incrementalGrossProfitMinor
      const a = EXPERIMENT_AGREEMENT_BAND.low * incremental
      const b = EXPERIMENT_AGREEMENT_BAND.high * incremental
      const gp = firstParty.grossProfitMinor
      if (gp < Math.min(a, b) || gp > Math.max(a, b)) {
        flags.push({
          code: 'experiment_disagrees',
          level: 'warning',
          message: `${channelKey} first-party gross profit is outside half to double the experiment's incremental gross profit`,
        })
      }
    }
  }

  if (input.spendMinor > 0 && !experiment) {
    flags.push({
      code: 'no_incrementality_evidence',
      level: 'info',
      message: `${channelKey} has spend but no holdout experiment measuring its incremental gross profit`,
    })
  }

  return flags
}

export type ExperimentPrimary = {
  incrementalGrossProfitMinor: number
  incrementalCiLowMinor: number | null
  incrementalCiHighMinor: number | null
}

/**
 * sum incremental gp across experiments on one channel; the interval is
 * sum +/- sqrt(sum of squared half-widths), null when any interval is missing
 */
export function combineExperimentLifts(
  results: ExperimentPrimary[],
): ExperimentLift | null {
  if (results.length === 0) return null
  let total = 0
  let squared = 0
  let complete = true
  for (const result of results) {
    total += result.incrementalGrossProfitMinor
    const low = result.incrementalCiLowMinor
    const high = result.incrementalCiHighMinor
    if (low == null || high == null || !Number.isFinite(low) || !Number.isFinite(high)) {
      complete = false
      continue
    }
    squared += ((high - low) / 2) ** 2
  }
  const half = Math.sqrt(squared)
  return {
    experiments: results.length,
    incrementalGrossProfitMinor: Math.round(total),
    ciLowMinor: complete ? Math.round(total - half) : null,
    ciHighMinor: complete ? Math.round(total + half) : null,
  }
}
