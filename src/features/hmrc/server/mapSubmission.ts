import type { SubmissionCategoryLine } from '~/features/submission/server/submissionService'

const INCOME_FIELD_BY_CATEGORY: Record<string, 'turnover' | 'other'> = {
  turnover: 'turnover',
  other_business_income: 'other',
}

const EXPENSE_FIELD_BY_CATEGORY: Record<string, string> = {
  cost_of_goods: 'costOfGoods',
  subcontractor_payments: 'paymentsToSubcontractors',
  staff_costs: 'wagesAndStaffCosts',
  car_van_travel: 'carVanTravelExpenses',
  rent_rates_power: 'premisesRunningCosts',
  repairs_renewals: 'maintenanceCosts',
  office_costs: 'adminCosts',
  advertising: 'advertisingCosts',
  interest: 'interestOnBankOtherLoans',
  bank_charges: 'financeCharges',
  bad_debts: 'irrecoverableDebts',
  professional_fees: 'professionalFees',
  depreciation: 'depreciation',
  other_business_expenses: 'otherExpenses',
}

export type HmrcPeriodSummaryPayload = {
  periodDates: {
    periodStartDate: string
    periodEndDate: string
  }
  periodIncome: {
    turnover: number
    other: number
    taxTakenOffTradingIncome: number
  }
  periodExpenses: Record<string, number>
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

export function mapCategoryLinesToHmrcPeriodSummary(input: {
  categoryLines: SubmissionCategoryLine[]
  taxYearStart: string
  periodEnd: string
}): HmrcPeriodSummaryPayload {
  const periodIncome = {
    turnover: 0,
    other: 0,
    taxTakenOffTradingIncome: 0,
  }

  const periodExpenses: Record<string, number> = {
    costOfGoods: 0,
    paymentsToSubcontractors: 0,
    wagesAndStaffCosts: 0,
    carVanTravelExpenses: 0,
    premisesRunningCosts: 0,
    maintenanceCosts: 0,
    adminCosts: 0,
    businessEntertainmentCosts: 0,
    advertisingCosts: 0,
    interestOnBankOtherLoans: 0,
    financeCharges: 0,
    irrecoverableDebts: 0,
    professionalFees: 0,
    depreciation: 0,
    otherExpenses: 0,
  }

  for (const line of input.categoryLines) {
    if (line.type === 'income') {
      const field = INCOME_FIELD_BY_CATEGORY[line.id]
      if (field) {
        periodIncome[field] = roundMoney(periodIncome[field] + line.total)
      }
      continue
    }

    const field = EXPENSE_FIELD_BY_CATEGORY[line.id]
    if (field) {
      periodExpenses[field] = roundMoney((periodExpenses[field] ?? 0) + line.total)
    }
  }

  return {
    periodDates: {
      periodStartDate: input.taxYearStart,
      periodEndDate: input.periodEnd,
    },
    periodIncome,
    periodExpenses,
  }
}
