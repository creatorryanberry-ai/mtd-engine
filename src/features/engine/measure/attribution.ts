import type { AttributionModelValue } from '../contract'

/**
 * first-party multi-touch attribution. pure: no node, db or react imports so
 * the server (rollups, attribution report) and the client share it.
 *
 * data conventions (shared by the measure stage):
 * - days are utc YYYY-MM-DD
 * - touches are engineEvent rows with a channelKey and a type in TOUCH_EVENT_TYPES
 * - outcomes are engineOutcome rows with a type in OUTCOME_TYPES
 * - spend is engineEvent type 'spend' (valueMinor = spend, channelKey set)
 * - platform-reported numbers are engineEvent type 'platform_report' (channelKey
 *   set, valueMinor = claimed revenue, properties.conversions = claimed conversions)
 * - unsubscribes and complaints are event types 'unsubscribe' / 'complaint'
 *
 * models (shares per outcome always sum to 1, merged by channel):
 * - last_touch / first_touch: 100% to the latest / earliest touch
 * - linear: equal shares
 * - time_decay: weight 2^(-age / halfLife), age in days before the outcome (default 7)
 * - position_based: 40% first, 40% last, 20% spread over the middle; 50/50 with two touches
 */

export const ATTRIBUTION_MODELS = [
  'last_touch',
  'first_touch',
  'linear',
  'time_decay',
  'position_based',
] as const satisfies readonly AttributionModelValue[]

export const TOUCH_EVENT_TYPES = [
  'impression',
  'click',
  'open',
  'visit',
  'form',
  'reply',
  'call',
  'meeting',
] as const

export const OUTCOME_TYPES = ['purchase', 'first_purchase', 'deal_won'] as const

export const DEFAULT_LOOKBACK_DAYS = 30
export const DEFAULT_HALF_LIFE_DAYS = 7

const DAY_MS = 24 * 60 * 60 * 1000

export type Touch = { channelKey: string; occurredAt: string }

export type CreditShares = Record<string, number>

/** epoch ms from iso strings and postgres text timestamps ("2026-10-10 12:00:00.1+00") */
export function parseTimestamp(value: string): number {
  const direct = Date.parse(value)
  if (Number.isFinite(direct)) return direct
  const normalized = value
    .trim()
    .replace(' ', 'T')
    .replace(/([+-]\d{2})$/, '$1:00')
  return Date.parse(normalized)
}

function touchWeights(
  count: number,
  model: AttributionModelValue,
  ages: number[],
  halfLifeDays: number,
): number[] {
  if (count === 1) return [1]
  switch (model) {
    case 'last_touch':
      return Array.from({ length: count }, (_, i) => (i === count - 1 ? 1 : 0))
    case 'first_touch':
      return Array.from({ length: count }, (_, i) => (i === 0 ? 1 : 0))
    case 'linear':
      return Array.from({ length: count }, () => 1 / count)
    case 'time_decay': {
      // relative to the youngest touch so long lookbacks cannot underflow to 0
      const youngest = Math.min(...ages)
      return ages.map((age) => 2 ** (-(age - youngest) / halfLifeDays))
    }
    case 'position_based': {
      if (count === 2) return [0.5, 0.5]
      const middle = 0.2 / (count - 2)
      return Array.from({ length: count }, (_, i) =>
        i === 0 || i === count - 1 ? 0.4 : middle,
      )
    }
  }
}

/**
 * credit one outcome to the channels that touched the contact before it.
 * touches after the outcome or with unparseable times are ignored; lookback
 * filtering is the caller's job. returns {} when nothing qualifies.
 */
export function creditTouches(
  touches: Touch[],
  outcomeAt: string,
  model: AttributionModelValue,
  options?: { halfLifeDays?: number },
): CreditShares {
  const outcomeTime = parseTimestamp(outcomeAt)
  if (!Number.isFinite(outcomeTime)) return {}
  const halfLifeDays =
    options?.halfLifeDays && options.halfLifeDays > 0
      ? options.halfLifeDays
      : DEFAULT_HALF_LIFE_DAYS

  const ordered = touches
    .map((touch, index) => ({ touch, index, time: parseTimestamp(touch.occurredAt) }))
    .filter((entry) => Number.isFinite(entry.time) && entry.time <= outcomeTime)
    .sort((a, b) => a.time - b.time || a.index - b.index)
  if (ordered.length === 0) return {}

  const ages = ordered.map((entry) => (outcomeTime - entry.time) / DAY_MS)
  const weights = touchWeights(ordered.length, model, ages, halfLifeDays)
  const total = weights.reduce((acc, weight) => acc + weight, 0)
  if (!(total > 0)) return {}

  const shares: CreditShares = {}
  for (let i = 0; i < ordered.length; i++) {
    const weight = weights[i]! / total
    if (weight === 0) continue
    const key = ordered[i]!.touch.channelKey
    shares[key] = (shares[key] ?? 0) + weight
  }
  return shares
}
