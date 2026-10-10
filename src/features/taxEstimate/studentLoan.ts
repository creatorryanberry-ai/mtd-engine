import type { Pence } from './money'
import { getTaxRoundingPolicy } from './rounding'
import type { StudentLoanPlanId, TaxYearRules } from './taxYearRules'

export function calculateStudentLoanRepayment(input: {
  incomePence: Pence
  undergraduatePlan: Exclude<StudentLoanPlanId, 'postgraduate'> | null
  postgraduate: boolean
  rules: TaxYearRules
}): { undergraduatePence: Pence; postgraduatePence: Pence; totalPence: Pence } {
  const rounding = getTaxRoundingPolicy()
  let undergraduatePence = 0
  let postgraduatePence = 0

  if (input.undergraduatePlan) {
    const plan = input.rules.studentLoan[input.undergraduatePlan]
    const excess = Math.max(0, input.incomePence - plan.thresholdPence)
    undergraduatePence = rounding.applyRate(excess, plan.rate)
  }

  if (input.postgraduate) {
    const plan = input.rules.studentLoan.postgraduate
    const excess = Math.max(0, input.incomePence - plan.thresholdPence)
    postgraduatePence = rounding.applyRate(excess, plan.rate)
  }

  return {
    undergraduatePence,
    postgraduatePence,
    totalPence: undergraduatePence + postgraduatePence,
  }
}
