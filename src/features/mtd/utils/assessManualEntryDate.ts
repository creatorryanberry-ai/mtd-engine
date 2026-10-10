import {
  formatDisplayTaxYear,
  getQuarterForDate,
  isDateInQuarter,
  type QuarterInfo,
} from '~/features/mtd/utils/quarterPeriods'

export type ManualEntryDateAssessment =
  | { action: 'allow' }
  | {
      action: 'confirm'
      quarter: QuarterInfo
      title: string
      description: string
    }
  | {
      action: 'block'
      quarter: QuarterInfo
      title: string
      description: string
    }

function quarterLabel(quarter: QuarterInfo) {
  return `${quarter.label} · ${formatDisplayTaxYear(quarter.taxYearStart)} (${quarter.periodLabel})`
}

export function assessManualEntryDate(
  isoDate: string,
  options: {
    currentQuarter: QuarterInfo
    /** true when the date's quarter has already been submitted to HMRC */
    dateQuarterSubmitted: boolean
  },
): ManualEntryDateAssessment {
  const { currentQuarter } = options
  const quarter = getQuarterForDate(isoDate)

  if (isDateInQuarter(isoDate, currentQuarter)) {
    return { action: 'allow' }
  }

  const datePeriod = quarterLabel(quarter)
  const currentPeriod = quarterLabel(currentQuarter)

  if (options.dateQuarterSubmitted) {
    return {
      action: 'block',
      quarter,
      title: 'Period already submitted',
      description: `This date falls in ${datePeriod}, which has already been submitted to HMRC. Use a date in the current period (${currentPeriod}) instead.`,
    }
  }

  return {
    action: 'confirm',
    quarter,
    title: 'Outside current period',
    description: `This date falls in ${datePeriod}, not the current period (${currentPeriod}). That period hasn’t been submitted yet. Add it anyway?`,
  }
}
