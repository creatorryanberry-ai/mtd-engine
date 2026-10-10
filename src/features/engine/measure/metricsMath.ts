/**
 * pure helpers for the daily metrics rollup and the measure routes. days are
 * utc YYYY-MM-DD; a day d covers [d 00:00z, d+1 00:00z).
 */

const DAY_MS = 24 * 60 * 60 * 1000
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function isDay(value: string) {
  return DAY_PATTERN.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
}

export function utcDay(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function addDays(day: string, days: number) {
  return utcDay(new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS))
}

/** iso timestamp of a day's utc midnight */
export function dayStartIso(day: string) {
  return `${day}T00:00:00.000Z`
}

/** whole days from `from` to `to` (negative when to is earlier) */
export function dayDiff(from: string, to: string) {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS,
  )
}

/** every day from fromDay to toDay inclusive */
export function listDays(fromDay: string, toDay: string) {
  const days: string[] = []
  const count = dayDiff(fromDay, toDay)
  for (let i = 0; i <= count; i++) days.push(addDays(fromDay, i))
  return days
}

/**
 * inclusive day range with defaults; ranges longer than maxDays keep the most
 * recent maxDays (the start moves forward). returns null when from > to.
 */
export function resolveDayRange(input: {
  from?: string
  to?: string
  today: string
  defaultDays: number
  maxDays: number
}) {
  const toDay = input.to ?? input.today
  let fromDay = input.from ?? addDays(toDay, -(input.defaultDays - 1))
  if (dayDiff(fromDay, toDay) < 0) return null
  if (dayDiff(fromDay, toDay) + 1 > input.maxDays) {
    fromDay = addDays(toDay, -(input.maxDays - 1))
  }
  return { fromDay, toDay, days: dayDiff(fromDay, toDay) + 1 }
}

/**
 * banker's rounding. fractional attribution credit is summed per channel per
 * day and rounded once at the end so ties do not drift upwards across days.
 */
export function roundHalfEven(value: number) {
  if (!Number.isFinite(value)) return 0
  const floor = Math.floor(value)
  const fraction = value - floor
  const epsilon = 1e-9
  if (Math.abs(fraction - 0.5) < epsilon) return floor % 2 === 0 ? floor : floor + 1
  return Math.round(value)
}

/** NaN and +/-Infinity become null (contract nullables) */
export function finiteOrNull(value: number | null | undefined) {
  return value != null && Number.isFinite(value) ? value : null
}

export type EventAggregate = {
  day: string
  channelKey: string | null
  type: string
  count: number
  valueMinor: number
  platformConversions: number
}

export type DayMetrics = {
  spendMinor: number
  impressions: number
  clicks: number
  unsubscribes: number
  complaints: number
  platformConversions: number | null
  platformRevenueMinor: number | null
}

export function emptyDayMetrics(): DayMetrics {
  return {
    spendMinor: 0,
    impressions: 0,
    clicks: 0,
    unsubscribes: 0,
    complaints: 0,
    platformConversions: null,
    platformRevenueMinor: null,
  }
}

/** fold one grouped event aggregate (day x channel x type) into a day's metrics */
export function applyEventAggregate(target: DayMetrics, row: EventAggregate) {
  switch (row.type) {
    case 'impression':
      target.impressions += row.count
      break
    case 'click':
      target.clicks += row.count
      break
    case 'spend':
      target.spendMinor += row.valueMinor
      break
    case 'unsubscribe':
      target.unsubscribes += row.count
      break
    case 'complaint':
      target.complaints += row.count
      break
    case 'platform_report':
      target.platformConversions =
        (target.platformConversions ?? 0) + row.platformConversions
      target.platformRevenueMinor = (target.platformRevenueMinor ?? 0) + row.valueMinor
      break
  }
}

export function hasActivity(metrics: DayMetrics) {
  return (
    metrics.spendMinor !== 0 ||
    metrics.impressions !== 0 ||
    metrics.clicks !== 0 ||
    metrics.unsubscribes !== 0 ||
    metrics.complaints !== 0 ||
    metrics.platformConversions !== null ||
    metrics.platformRevenueMinor !== null
  )
}

export type ChannelCredit = {
  conversions: number
  newCustomers: number
  revenueMinor: number
  grossProfitMinor: number
}

/** accumulate fractional credit keyed by `${day}|${channelKey}` */
export function addChannelCredit(
  target: Map<string, ChannelCredit>,
  key: string,
  share: number,
  outcome: { revenueMinor: number; grossProfitMinor: number; isNewCustomer: boolean },
) {
  const current = target.get(key) ?? {
    conversions: 0,
    newCustomers: 0,
    revenueMinor: 0,
    grossProfitMinor: 0,
  }
  current.conversions += share
  if (outcome.isNewCustomer) current.newCustomers += share
  current.revenueMinor += share * outcome.revenueMinor
  current.grossProfitMinor += share * outcome.grossProfitMinor
  target.set(key, current)
}

export function roundCredit(credit: ChannelCredit): ChannelCredit {
  return {
    conversions: roundHalfEven(credit.conversions),
    newCustomers: roundHalfEven(credit.newCustomers),
    revenueMinor: roundHalfEven(credit.revenueMinor),
    grossProfitMinor: roundHalfEven(credit.grossProfitMinor),
  }
}
