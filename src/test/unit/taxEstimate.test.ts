import { describe, expect, it } from 'vitest'

import {
  businessProfitOnly,
  calculateClass4Ni,
  calculatePersonalAllowance,
  emptyTaxEstimateAnswers,
  estimateForAnswers,
  getTaxYearRules,
  grossUpReliefAtSource,
  poundsToPence,
} from '~/features/taxEstimate'
import { createEmploymentRecord } from '~/features/taxEstimate/answers'
import { estimateTax } from '~/features/taxEstimate/taxEstimator'
import { emptyBusinessProfit } from '~/features/taxEstimate/taxEstimator'

const TY = '2026-04-06'

function answersWith(
  patch: (answers: ReturnType<typeof emptyTaxEstimateAnswers>) => void,
) {
  const answers = emptyTaxEstimateAnswers()
  patch(answers)
  return answers
}

describe('2026/27 tax year rules', () => {
  it('loads England dividend rates from TaxYearRules rather than UI constants', () => {
    const rules = getTaxYearRules(TY, 'england')
    expect(rules.personalAllowancePence).toBe(1_257_000)
    expect(rules.dividendBasicRate).toBe(0.1075)
    expect(rules.dividendHigherRate).toBe(0.3575)
    expect(rules.dividendAdditionalRate).toBe(0.3935)
    expect(rules.studentLoan.plan2.thresholdPence).toBe(2_938_500)
    expect(rules.class4MainRate).toBe(0.06)
  })

  it('differs from 2025/26 dividend rates', () => {
    const current = getTaxYearRules(TY, 'england')
    const previous = getTaxYearRules('2025-04-06', 'england')
    expect(previous.dividendBasicRate).toBe(0.0875)
    expect(current.dividendBasicRate).not.toBe(previous.dividendBasicRate)
  })

  it('loads Scottish bands independently', () => {
    const rules = getTaxYearRules(TY, 'scotland')
    expect(rules.nonSavingsBands[0]?.rate).toBe(0.19)
    expect(rules.nonSavingsBands.at(-1)?.rate).toBe(0.48)
  })
})

describe('rounding and invalid input', () => {
  it('treats negative and non-numeric pounds as zero', () => {
    const result = estimateForAnswers({
      taxYearStart: TY,
      answers: emptyTaxEstimateAnswers(),
      business: businessProfitOnly(-5000),
    })
    expect(result.totalLiability).toBe(0)
    expect(result.stillToPay).toBe(0)
  })

  it('grosses up relief-at-source pension contributions', () => {
    expect(grossUpReliefAtSource(poundsToPence(800))).toBe(poundsToPence(1000))
  })
})

describe('personal allowance', () => {
  const rules = getTaxYearRules(TY, 'england')

  it('is £12,570 at and below the taper threshold', () => {
    expect(calculatePersonalAllowance(poundsToPence(12_570), rules)).toBe(1_257_000)
    expect(calculatePersonalAllowance(poundsToPence(100_000), rules)).toBe(1_257_000)
  })

  it('tapers by £1 for every £2 above £100,000', () => {
    expect(calculatePersonalAllowance(poundsToPence(110_000), rules)).toBe(757_000)
  })

  it('is fully removed at £125,140', () => {
    expect(calculatePersonalAllowance(poundsToPence(125_140), rules)).toBe(0)
    expect(calculatePersonalAllowance(poundsToPence(130_000), rules)).toBe(0)
  })
})

describe('SelfEmployedBasicRate_NoOtherIncome', () => {
  it('taxes profit after the personal allowance at 20%', () => {
    const result = estimateForAnswers({
      taxYearStart: TY,
      answers: emptyTaxEstimateAnswers(),
      business: businessProfitOnly(38_000),
    })
    expect(result.breakdown.personalAllowance).toBe(12_570)
    expect(result.breakdown.taxableIncome).toBe(25_430)
    expect(result.incomeTax).toBe(5_086)
    expect(result.class4Ni).toBe(1_525.8)
    expect(result.totalLiability).toBe(6_611.8)
    expect(result.stillToPay).toBe(6_611.8)
  })
})

describe('income below, at, and above personal allowance', () => {
  it('is zero below the personal allowance', () => {
    const result = estimateForAnswers({
      taxYearStart: TY,
      business: businessProfitOnly(10_000),
      answers: emptyTaxEstimateAnswers(),
    })
    expect(result.incomeTax).toBe(0)
    expect(result.class4Ni).toBe(0)
  })

  it('is zero at the personal allowance', () => {
    const result = estimateForAnswers({
      taxYearStart: TY,
      business: businessProfitOnly(12_570),
      answers: emptyTaxEstimateAnswers(),
    })
    expect(result.incomeTax).toBe(0)
    expect(result.class4Ni).toBe(0)
  })
})

describe('SelfEmployedHigherRate_WithPAYEIncome', () => {
  it('stacks employment on self-employment and credits PAYE', () => {
    const answers = answersWith((next) => {
      next.employment.hadJob = 'yes'
      next.employment.jobs = [
        createEmploymentRecord({
          id: 'job-1',
          employerName: 'Acme',
          grossPayPounds: 25_000,
          payeTaxDeductedPounds: 3_200,
        }),
      ]
    })
    const result = estimateForAnswers({
      taxYearStart: TY,
      answers,
      business: businessProfitOnly(38_000),
    })
    expect(result.breakdown.employmentIncome).toBe(25_000)
    expect(result.alreadyPaidBreakdown.paye).toBe(3_200)
    expect(result.incomeTax).toBe(12_632)
    expect(result.class4Ni).toBe(1_525.8)
    expect(result.stillToPay).toBe(result.totalLiability - 3_200)
  })
})

describe('additional rate taxpayer', () => {
  it('applies 45% above the additional rate threshold', () => {
    const result = estimateForAnswers({
      taxYearStart: TY,
      answers: emptyTaxEstimateAnswers(),
      business: businessProfitOnly(150_000),
    })
    expect(result.breakdown.personalAllowance).toBe(0)
    expect(result.incomeTax).toBeGreaterThan(50_000)
    const additional = result.breakdown.nonSavingsSlices.find((slice) =>
      slice.label.toLowerCase().includes('additional'),
    )
    expect(additional?.rate).toBe(0.45)
  })
})

describe('PersonalAllowanceTapersAbove100k', () => {
  it('reduces the allowance and increases tax', () => {
    const below = estimateForAnswers({
      taxYearStart: TY,
      business: businessProfitOnly(100_000),
      answers: emptyTaxEstimateAnswers(),
    })
    const above = estimateForAnswers({
      taxYearStart: TY,
      business: businessProfitOnly(110_000),
      answers: emptyTaxEstimateAnswers(),
    })
    expect(below.breakdown.personalAllowance).toBe(12_570)
    expect(above.breakdown.personalAllowance).toBe(7_570)
    expect(above.incomeTax).toBeGreaterThan(below.incomeTax)
  })
})

describe('Class4CrossesUpperProfitsLimit', () => {
  const rules = getTaxYearRules(TY, 'england')

  it('is zero below the lower profits limit', () => {
    expect(calculateClass4Ni(poundsToPence(12_000), rules).totalClass4Pence).toBe(0)
  })

  it('charges 6% between the limits', () => {
    const result = calculateClass4Ni(poundsToPence(30_000), rules)
    expect(result.profitWithinMainBandPence).toBe(poundsToPence(17_430))
    expect(result.mainClass4Pence).toBe(104_580)
    expect(result.additionalClass4Pence).toBe(0)
  })

  it('charges 2% above the upper profits limit', () => {
    const result = calculateClass4Ni(poundsToPence(60_000), rules)
    expect(result.profitWithinMainBandPence).toBe(poundsToPence(37_700))
    expect(result.profitAboveUpperLimitPence).toBe(poundsToPence(9_730))
    expect(result.totalClass4Pence).toBe(245_660)
  })

  it('does not use employment, dividends or interest', () => {
    const answers = answersWith((next) => {
      next.employment.hadJob = 'yes'
      next.employment.jobs = [
        createEmploymentRecord({ grossPayPounds: 80_000, payeTaxDeductedPounds: 20_000 }),
      ]
      next.investments.hadDividends = 'yes'
      next.investments.ukDividendsPounds = 10_000
      next.investments.soldInvestments = 'no'
      next.savings.hadInterest = 'yes'
      next.savings.ukInterestPounds = 5_000
    })
    const result = estimateForAnswers({
      taxYearStart: TY,
      answers,
      business: businessProfitOnly(10_000),
    })
    expect(result.class4Ni).toBe(0)
  })
})

describe('SelfEmployed_WithCISDeductions', () => {
  it('reduces still-to-pay without treating CIS as an expense', () => {
    const result = estimateForAnswers({
      taxYearStart: TY,
      answers: emptyTaxEstimateAnswers(),
      business: {
        ...businessProfitOnly(38_000),
        cisDeductedPounds: 486,
      },
    })
    expect(result.breakdown.businessProfit).toBe(38_000)
    expect(result.alreadyPaidBreakdown.cis).toBe(486)
    expect(result.stillToPay).toBe(6_125.8)
  })
})

describe('savings tax', () => {
  it('uses the starting rate for savings when non-savings income is low', () => {
    const answers = answersWith((next) => {
      next.savings.hadInterest = 'yes'
      next.savings.ukInterestPounds = 4_000
    })
    const result = estimateForAnswers({
      taxYearStart: TY,
      answers,
      business: businessProfitOnly(12_570),
    })
    expect(result.breakdown.savingsInterest).toBe(4_000)
    expect(result.incomeTax).toBe(0)
  })

  it('applies the personal savings allowance for a basic-rate taxpayer', () => {
    const answers = answersWith((next) => {
      next.savings.hadInterest = 'yes'
      next.savings.ukInterestPounds = 800
    })
    const result = estimateForAnswers({
      taxYearStart: TY,
      answers,
      business: businessProfitOnly(30_000),
    })
    expect(result.breakdown.savingsSlices.every((slice) => slice.tax === 0)).toBe(true)
  })
})

describe('DividendIncomeCrossesHigherRateBand', () => {
  it('taxes 2026/27 dividends at 10.75% then 35.75% across bands', () => {
    const answers = answersWith((next) => {
      next.investments.hadDividends = 'yes'
      next.investments.ukDividendsPounds = 20_000
      next.investments.soldInvestments = 'no'
    })
    const result = estimateForAnswers({
      taxYearStart: TY,
      answers,
      business: businessProfitOnly(40_000),
    })
    expect(result.breakdown.dividends).toBe(20_000)
    const charged = result.breakdown.dividendSlices.filter((slice) => slice.tax > 0)
    expect(charged.some((slice) => slice.rate === 0.1075)).toBe(true)
    expect(charged.some((slice) => slice.rate === 0.3575)).toBe(true)
  })
})

describe('student loans', () => {
  it('StudentLoanPlan2_WithSelfEmployment charges 9% above the 2026/27 threshold', () => {
    const answers = answersWith((next) => {
      next.studentLoan.repaying = 'yes'
      next.studentLoan.undergraduatePlan = 'plan2'
    })
    const result = estimateForAnswers({
      taxYearStart: TY,
      answers,
      business: businessProfitOnly(40_000),
    })
    expect(result.studentLoan).toBe(955.35)
  })

  it('is zero under the plan 1 threshold', () => {
    const answers = answersWith((next) => {
      next.studentLoan.repaying = 'yes'
      next.studentLoan.undergraduatePlan = 'plan1'
    })
    const result = estimateForAnswers({
      taxYearStart: TY,
      answers,
      business: businessProfitOnly(20_000),
    })
    expect(result.studentLoan).toBe(0)
  })

  it('charges plan 4, plan 5 and postgraduate from rules', () => {
    const base = (plan: 'plan4' | 'plan5', postgraduate: boolean) =>
      estimateForAnswers({
        taxYearStart: TY,
        answers: answersWith((next) => {
          next.studentLoan.repaying = 'yes'
          next.studentLoan.undergraduatePlan = plan
          next.studentLoan.postgraduate = postgraduate
        }),
        business: businessProfitOnly(50_000),
      })

    expect(base('plan4', false).studentLoan).toBeGreaterThan(0)
    expect(base('plan5', false).studentLoan).toBeGreaterThan(
      base('plan4', false).studentLoan,
    )
    expect(base('plan5', true).studentLoan).toBeGreaterThan(
      base('plan5', false).studentLoan,
    )
  })
})

describe('child benefit charge', () => {
  it('starts above £60,000 of adjusted net income', () => {
    const answers = answersWith((next) => {
      next.family.received = 'yes'
      next.family.who = 'you'
      next.family.numberOfChildren = 1
    })
    const below = estimateForAnswers({
      taxYearStart: TY,
      answers,
      business: businessProfitOnly(59_000),
    })
    const above = estimateForAnswers({
      taxYearStart: TY,
      answers,
      business: businessProfitOnly(70_000),
    })
    expect(below.childBenefitCharge).toBe(0)
    expect(above.childBenefitCharge).toBeGreaterThan(0)
  })
})

describe('pension and gift aid ANI', () => {
  it('grosses up pension contributions before reducing ANI', () => {
    const without = estimateForAnswers({
      taxYearStart: TY,
      answers: emptyTaxEstimateAnswers(),
      business: businessProfitOnly(110_000),
    })
    const withPension = estimateForAnswers({
      taxYearStart: TY,
      answers: answersWith((next) => {
        next.reliefs.hadReliefs = 'yes'
        next.reliefs.pensionContributions = 'yes'
        next.reliefs.pensionContributionIsNet = true
        next.reliefs.pensionContributionPounds = 8_000
        next.reliefs.giftAid = 'no'
      }),
      business: businessProfitOnly(110_000),
    })
    expect(withPension.breakdown.adjustedNetIncome).toBe(100_000)
    expect(withPension.breakdown.personalAllowance).toBeGreaterThan(
      without.breakdown.personalAllowance,
    )
  })

  it('grosses up Gift Aid and extends the basic rate band', () => {
    const result = estimateForAnswers({
      taxYearStart: TY,
      answers: answersWith((next) => {
        next.reliefs.hadReliefs = 'yes'
        next.reliefs.giftAid = 'yes'
        next.reliefs.giftAidPounds = 800
        next.reliefs.pensionContributions = 'no'
      }),
      business: businessProfitOnly(50_000),
    })
    expect(result.breakdown.adjustedNetIncome).toBe(49_000)
  })
})

describe('capital gains', () => {
  it('estimates a simple gain after the annual exempt amount', () => {
    const result = estimateForAnswers({
      taxYearStart: TY,
      answers: answersWith((next) => {
        next.capitalGains.soldAssets = 'yes'
        next.capitalGains.types = ['shares']
        next.capitalGains.proceedsPounds = 20_000
        next.capitalGains.costPounds = 10_000
      }),
      business: businessProfitOnly(20_000),
    })
    expect(result.cgtStatus).toBe('exact_enough_for_estimate')
    expect(result.capitalGainsTax).toBeGreaterThan(0)
  })

  it('does not invent a figure when information is missing', () => {
    const result = estimateForAnswers({
      taxYearStart: TY,
      answers: answersWith((next) => {
        next.capitalGains.soldAssets = 'yes'
        next.capitalGains.types = ['property']
      }),
      business: businessProfitOnly(20_000),
    })
    expect(result.cgtStatus).toBe('needs_more_information')
    expect(result.capitalGainsTax).toBe(0)
    expect(result.cgtNote).toBe('Capital Gains may affect this estimate.')
  })
})

describe('foreign income', () => {
  it('marks foreign tax as needs review', () => {
    const result = estimateForAnswers({
      taxYearStart: TY,
      answers: answersWith((next) => {
        next.foreignIncome.hadForeignIncome = 'yes'
        next.foreignIncome.category = 'employment'
        next.foreignIncome.amountPounds = 5_000
        next.foreignIncome.foreignTaxPaidPounds = 500
      }),
      business: businessProfitOnly(20_000),
    })
    expect(result.foreignIncomeNeedsReview).toBe(true)
    expect(result.categoryStatuses.foreignIncome).toBe('needs_review')
  })
})

describe('payments on account', () => {
  it('splits the relevant amount across January and July', () => {
    const result = estimateForAnswers({
      taxYearStart: TY,
      answers: emptyTaxEstimateAnswers(),
      business: businessProfitOnly(38_000),
    })
    expect(result.paymentsOnAccount.required).toBe(true)
    expect(result.paymentsOnAccount.firstPayment).toBe(3_305.9)
    expect(result.paymentsOnAccount.secondPayment).toBe(3_305.9)
    expect(result.paymentsOnAccount.januaryTotal).toBe(9_917.7)
  })
})

describe('multiple employments', () => {
  it('sums gross pay and PAYE across jobs', () => {
    const answers = answersWith((next) => {
      next.employment.hadJob = 'yes'
      next.employment.jobs = [
        createEmploymentRecord({
          id: 'a',
          grossPayPounds: 10_000,
          payeTaxDeductedPounds: 800,
        }),
        createEmploymentRecord({
          id: 'b',
          grossPayPounds: 8_000,
          payeTaxDeductedPounds: 400,
        }),
      ]
    })
    const result = estimateForAnswers({
      taxYearStart: TY,
      answers,
      business: businessProfitOnly(12_570),
    })
    expect(result.breakdown.employmentIncome).toBe(18_000)
    expect(result.alreadyPaidBreakdown.paye).toBe(1_200)
  })
})

describe('Scottish income tax', () => {
  it('uses Scottish non-savings rates rather than England rates', () => {
    const england = estimateForAnswers({
      taxYearStart: TY,
      jurisdiction: 'england',
      answers: emptyTaxEstimateAnswers(),
      business: businessProfitOnly(30_000),
    })
    const scotland = estimateForAnswers({
      taxYearStart: TY,
      jurisdiction: 'scotland',
      answers: emptyTaxEstimateAnswers(),
      business: businessProfitOnly(30_000),
    })
    expect(scotland.incomeTax).not.toBe(england.incomeTax)
    expect(scotland.breakdown.nonSavingsSlices[0]?.rate).toBe(0.19)
  })
})

describe('zero values', () => {
  it('returns a zero estimate with no income', () => {
    const result = estimateTax({
      taxYearStart: TY,
      jurisdiction: 'england',
      answers: emptyTaxEstimateAnswers(),
      business: emptyBusinessProfit(),
      useProjection: false,
    })
    expect(result.totalLiabilityPence).toBe(0)
    expect(result.stillToPayPence).toBe(0)
  })
})
