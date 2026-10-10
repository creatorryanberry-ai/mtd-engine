export function formatMinor(minor: number, currency: string, locale = 'en-GB') {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(
      minor / 100,
    )
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`
  }
}

export function formatNumber(value: number, locale = 'en-GB') {
  return new Intl.NumberFormat(locale).format(value)
}

/** llm cost is stored in usd micro-dollars */
export function formatMicrosUsd(micros: number) {
  const usd = micros / 1_000_000
  if (usd > 0 && usd < 0.01) return `$${usd.toFixed(4)}`
  return formatMinor(Math.round(usd * 100), 'USD', 'en-US')
}

export function formatDate(iso: string | null | undefined, locale = 'en-GB') {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function formatDateTime(iso: string | null | undefined, locale = 'en-GB') {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatRelative(iso: string | null | undefined) {
  if (!iso) return 'never'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 'never'
  const diffMs = Date.now() - then
  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(iso)
}

/** week on week change as a signed percentage string, null when there is no baseline */
export function formatDelta(current: number, previous: number) {
  if (previous === 0) return current === 0 ? null : 'new'
  const pct = ((current - previous) / Math.abs(previous)) * 100
  const rounded = Math.round(pct)
  return `${rounded > 0 ? '+' : ''}${rounded}%`
}

export function contactDisplayName(contact: {
  firstName: string | null
  lastName: string | null
  email: string | null
}) {
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim()
  return name || contact.email || 'Unknown contact'
}

/** audit action keys like `brand_kit.save` read as "Brand kit save" */
export function formatAction(action: string) {
  const words = action
    .replace(/[._-]+/g, ' ')
    .trim()
    .toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function titleCase(value: string) {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

const MINUS = '−'

/** money with an explicit sign, for differences and lifts */
export function formatSignedMinor(minor: number, currency: string, locale = 'en-GB') {
  const rounded = Math.round(minor)
  const body = formatMinor(Math.abs(rounded), currency, locale)
  if (rounded === 0) return body
  return `${rounded > 0 ? '+' : MINUS}${body}`
}

/** a 0..1 ratio as a percentage, trimming noise on small values */
export function formatPercent(ratio: number | null | undefined, digits = 1) {
  if (ratio == null || !Number.isFinite(ratio)) return '—'
  const pct = ratio * 100
  const places = Math.abs(pct) >= 100 ? 0 : digits
  return `${pct.toFixed(places)}%`
}

export function formatSignedPercent(ratio: number | null | undefined, digits = 1) {
  if (ratio == null || !Number.isFinite(ratio)) return '—'
  const body = formatPercent(Math.abs(ratio), digits)
  if (Math.abs(ratio) < 0.5 * 10 ** -(digits + 2)) return body
  return `${ratio > 0 ? '+' : MINUS}${body}`
}

/** a difference between two rates, in percentage points */
export function formatPoints(diff: number, digits = 2) {
  const pts = diff * 100
  const body = `${Math.abs(pts).toFixed(digits)} pp`
  if (Math.abs(pts) < 0.5 * 10 ** -digits) return body
  return `${pts > 0 ? '+' : MINUS}${body}`
}

export function formatPValue(p: number | null | undefined) {
  if (p == null || !Number.isFinite(p)) return 'p n/a'
  if (p < 0.001) return 'p < 0.001'
  if (p < 0.01) return `p = ${p.toFixed(3)}`
  return `p = ${p.toFixed(2)}`
}

/** a probability as a percentage that never claims certainty */
export function formatProbability(p: number | null | undefined) {
  if (p == null || !Number.isFinite(p)) return '—'
  if (p > 0.999) return '>99.9%'
  if (p < 0.001) return '<0.1%'
  return `${(p * 100).toFixed(1)}%`
}

/** YYYY-MM-DD in utc, the shape the measure endpoints take */
export function isoDay(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

export function formatShortDay(isoDate: string, locale = 'en-GB') {
  const date = new Date(isoDate.length === 10 ? `${isoDate}T00:00:00Z` : isoDate)
  if (Number.isNaN(date.getTime())) return isoDate
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(date)
}
