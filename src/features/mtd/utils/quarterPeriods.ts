export type QuarterId = 'Q1' | 'Q2' | 'Q3' | 'Q4'

export type TaxYear = {
  start: string
  end: string
  label: string
}

export type QuarterInfo = {
  id: QuarterId
  label: string
  taxYearStart: string
  periodStart: string
  periodEnd: string
  deadline: string
  periodLabel: string
  deadlineLabel: string
  /** cumulative HMRC update period: tax year start → quarter end */
  hmrcUpdatePeriodLabel: string
}

const QUARTER_ORDER: QuarterId[] = ['Q1', 'Q2', 'Q3', 'Q4']

const TAX_YEAR_START_PATTERN = /^\d{4}-04-06$/

function formatIsoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDisplayDate(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00`)
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatShortPeriodDate(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00`)
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

export function getTaxYearStart(forDate = new Date()): string {
  const year = forDate.getFullYear()
  const month = forDate.getMonth()
  const day = forDate.getDate()

  if (month < 3 || (month === 3 && day < 6)) {
    return `${year - 1}-04-06`
  }

  return `${year}-04-06`
}

export function getTaxYearEnd(taxYearStart: string): string {
  const startYear = getTaxYearStartYear(taxYearStart)
  return `${startYear + 1}-04-05`
}

export function getTaxYearForDate(isoDate: string): TaxYear {
  const taxYearStart = getTaxYearStart(new Date(`${isoDate}T12:00:00`))
  return buildTaxYear(taxYearStart)
}

export function buildTaxYear(taxYearStart: string): TaxYear {
  return {
    start: taxYearStart,
    end: getTaxYearEnd(taxYearStart),
    label: formatDisplayTaxYear(taxYearStart),
  }
}

export function formatDisplayTaxYear(taxYearStart: string) {
  const startYear = getTaxYearStartYear(taxYearStart)
  const endYearSuffix = String(startYear + 1).slice(2)
  return `${startYear}/${endYearSuffix}`
}

function getTaxYearStartYear(taxYearStart: string) {
  return Number.parseInt(taxYearStart.slice(0, 4), 10)
}

function getQuarterPeriodEnd(taxYearStart: string, quarterId: QuarterId) {
  const year = getTaxYearStartYear(taxYearStart)

  switch (quarterId) {
    case 'Q1':
      return `${year}-07-05`
    case 'Q2':
      return `${year}-10-05`
    case 'Q3':
      return `${year + 1}-01-05`
    case 'Q4':
      return `${year + 1}-04-05`
  }
}

function addOneDay(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00`)
  date.setDate(date.getDate() + 1)
  return formatIsoDate(date)
}

export function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T12:00:00`)
  date.setDate(date.getDate() + days)
  return formatIsoDate(date)
}

export function getQuarterPeriodStart(taxYearStart: string, quarterId: QuarterId) {
  if (quarterId === 'Q1') return taxYearStart

  const previousId = QUARTER_ORDER[QUARTER_ORDER.indexOf(quarterId) - 1]!
  return addOneDay(getQuarterPeriodEnd(taxYearStart, previousId))
}

function getQuarterDeadline(taxYearStart: string, quarterId: QuarterId) {
  const year = getTaxYearStartYear(taxYearStart)

  switch (quarterId) {
    case 'Q1':
      return `${year}-08-07`
    case 'Q2':
      return `${year}-11-07`
    case 'Q3':
      return `${year + 1}-02-07`
    case 'Q4':
      return `${year + 1}-05-07`
  }
}

export function getFinalDeclarationDeadline(taxYearStart: string) {
  const endYear = getTaxYearStartYear(taxYearStart) + 2
  return `${endYear}-01-31`
}

function buildQuarterInfo(taxYearStart: string, quarterId: QuarterId): QuarterInfo {
  const periodStart = getQuarterPeriodStart(taxYearStart, quarterId)
  const periodEnd = getQuarterPeriodEnd(taxYearStart, quarterId)
  const deadline = getQuarterDeadline(taxYearStart, quarterId)

  return {
    id: quarterId,
    label: quarterId,
    taxYearStart,
    periodStart,
    periodEnd,
    deadline,
    periodLabel: `${formatShortPeriodDate(periodStart)} – ${formatDisplayDate(periodEnd)}`,
    deadlineLabel: formatDisplayDate(deadline),
    hmrcUpdatePeriodLabel: `${formatDisplayDate(taxYearStart)} – ${formatDisplayDate(periodEnd)}`,
  }
}

export function getQuarterInfo(quarterId: QuarterId, taxYearStart?: string): QuarterInfo {
  const resolvedTaxYearStart = taxYearStart ?? getTaxYearStart()
  return buildQuarterInfo(resolvedTaxYearStart, quarterId)
}

export function getQuartersForTaxYear(taxYearStart: string): QuarterInfo[] {
  return QUARTER_ORDER.map((quarterId) => buildQuarterInfo(taxYearStart, quarterId))
}

export function getQuarterForDate(isoDate: string): QuarterInfo {
  const taxYearStart = getTaxYearStart(new Date(`${isoDate}T12:00:00`))
  const ends = QUARTER_ORDER.map((id) => ({
    id,
    end: getQuarterPeriodEnd(taxYearStart, id),
  }))

  const match = ends.find((quarter) => isoDate <= quarter.end) ?? ends[ends.length - 1]!

  return buildQuarterInfo(taxYearStart, match.id)
}

export function getCurrentQuarter(forDate = new Date()): QuarterInfo {
  const today = formatIsoDate(forDate)
  return getQuarterForDate(today)
}

export function isDateInTaxYear(isoDate: string, taxYearStart: string) {
  const taxYearEnd = getTaxYearEnd(taxYearStart)
  return isoDate >= taxYearStart && isoDate <= taxYearEnd
}

export function isDateInQuarter(isoDate: string, quarter: QuarterInfo) {
  return isoDate >= quarter.periodStart && isoDate <= quarter.periodEnd
}

export function isDateInHmrcUpdatePeriod(isoDate: string, quarter: QuarterInfo) {
  return isoDate >= quarter.taxYearStart && isoDate <= quarter.periodEnd
}

export function listAvailableTaxYears(options?: {
  fromTaxYearStart?: string
  throughTaxYearStart?: string
}): TaxYear[] {
  const currentStart = getTaxYearStart()
  const currentStartYear = getTaxYearStartYear(currentStart)
  const fromStart = options?.fromTaxYearStart ?? `${currentStartYear - 2}-04-06`
  const throughStart = options?.throughTaxYearStart ?? `${currentStartYear + 1}-04-06`

  const years: TaxYear[] = []
  let cursor = fromStart

  while (cursor <= throughStart) {
    years.push(buildTaxYear(cursor))
    const nextYear = getTaxYearStartYear(cursor) + 1
    cursor = `${nextYear}-04-06`
  }

  return years.reverse()
}

export function formatHmrcTaxYear(taxYearStart: string) {
  const startYear = getTaxYearStartYear(taxYearStart)
  const endYearSuffix = String(startYear + 1).slice(2)
  return `${startYear}-${endYearSuffix}`
}

export function usesCumulativeHmrcSubmission(taxYearStart: string) {
  return getTaxYearStartYear(taxYearStart) >= 2025
}

export function parseQuarterId(value: string | null | undefined): QuarterId | null {
  if (value === 'Q1' || value === 'Q2' || value === 'Q3' || value === 'Q4') {
    return value
  }

  return null
}

export function parseTaxYearStart(value: string | null | undefined): string | null {
  if (!value || !TAX_YEAR_START_PATTERN.test(value)) {
    return null
  }

  return value
}

export function quarterIdFromPeriodEnd(
  taxYearStart: string,
  periodEndDate: string,
): QuarterId | null {
  const quarters = getQuartersForTaxYear(taxYearStart)
  const match = quarters.find((quarter) => quarter.periodEnd === periodEndDate)
  return match?.id ?? null
}
