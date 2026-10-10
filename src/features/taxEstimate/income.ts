import { poundsToPence, type Pence } from './money'
import type { TaxYearRules } from './taxYearRules'
import type { BandTaxSlice, TaxEstimateAnswers, TaxableBusinessProfit } from './types'
import { occupyFrom, remainingBasicRateRoom, taxOccupied } from './incomeTaxBands'

export function sumEmployment(answers: TaxEstimateAnswers) {
  if (answers.employment.hadJob === 'no') {
    return { gross: 0, paye: 0, benefits: 0 }
  }
  let gross = 0
  let paye = 0
  let benefits = 0
  for (const job of answers.employment.jobs) {
    gross += poundsToPence(job.grossPayPounds ?? 0)
    paye += poundsToPence(job.payeTaxDeductedPounds ?? 0)
    benefits += poundsToPence(job.taxableBenefitsPounds ?? 0)
  }
  return { gross, paye, benefits }
}

export function collectIncome(input: {
  answers: TaxEstimateAnswers
  business: TaxableBusinessProfit
}) {
  const employment = sumEmployment(input.answers)
  const selfEmployment = poundsToPence(input.business.profitUsedPounds)

  const propertyFromAnswers =
    input.answers.property.hadRental === 'yes' &&
    !input.answers.property.useExistingRecords
      ? Math.max(
          0,
          poundsToPence(input.answers.property.grossRentalPounds ?? 0) -
            poundsToPence(input.answers.property.allowableExpensesPounds ?? 0),
        )
      : 0
  const propertyFromRecords = input.answers.property.useExistingRecords
    ? poundsToPence(input.business.propertyProfitPounds)
    : input.answers.property.hadRental === 'no'
      ? 0
      : poundsToPence(input.business.propertyProfitPounds)
  const propertyProfit =
    input.answers.property.hadRental === 'no'
      ? 0
      : propertyFromAnswers || propertyFromRecords

  const pension =
    input.answers.pensions.hadPension === 'no'
      ? 0
      : poundsToPence(input.answers.pensions.totalPounds ?? 0)

  const other =
    input.answers.otherIncome.hadOtherIncome === 'no'
      ? 0
      : poundsToPence(input.answers.otherIncome.amountPounds ?? 0)

  const ukInterest =
    input.answers.savings.hadInterest === 'no'
      ? 0
      : poundsToPence(input.answers.savings.ukInterestPounds ?? 0)
  const foreignInterest =
    input.answers.savings.hadInterest === 'no'
      ? 0
      : poundsToPence(input.answers.savings.foreignInterestPounds ?? 0)

  const ukDividends =
    input.answers.investments.hadDividends === 'no'
      ? 0
      : poundsToPence(input.answers.investments.ukDividendsPounds ?? 0)
  const foreignDividends =
    input.answers.investments.hadDividends === 'no'
      ? 0
      : poundsToPence(input.answers.investments.foreignDividendsPounds ?? 0)

  let foreignNonSavings = 0
  let foreignSavings = 0
  let foreignDivs = 0
  if (input.answers.foreignIncome.hadForeignIncome === 'yes') {
    const amount = poundsToPence(input.answers.foreignIncome.amountPounds ?? 0)
    switch (input.answers.foreignIncome.category) {
      case 'savings':
        foreignSavings += amount
        break
      case 'dividends':
        foreignDivs += amount
        break
      default:
        foreignNonSavings += amount
    }
  }

  const nonSavings =
    selfEmployment +
    employment.gross +
    employment.benefits +
    propertyProfit +
    pension +
    other +
    foreignNonSavings
  const savings = ukInterest + foreignInterest + foreignSavings
  const dividends = ukDividends + foreignDividends + foreignDivs

  return {
    selfEmployment,
    employment: employment.gross,
    benefits: employment.benefits,
    paye: employment.paye,
    propertyProfit,
    pension,
    other,
    nonSavings,
    savings,
    dividends,
    total: nonSavings + savings + dividends,
    pensionTaxDeducted:
      input.answers.pensions.hadPension === 'no'
        ? 0
        : poundsToPence(input.answers.pensions.taxDeductedPounds ?? 0),
    otherTaxDeducted:
      input.answers.otherIncome.hadOtherIncome === 'no'
        ? 0
        : poundsToPence(input.answers.otherIncome.taxDeductedPounds ?? 0),
    cisDeducted: poundsToPence(input.business.cisDeductedPounds),
    foreignTaxPaid: poundsToPence(input.answers.foreignIncome.foreignTaxPaidPounds ?? 0),
  }
}

function allocateAllowance(income: Pence, allowance: Pence) {
  const used = Math.min(income, allowance)
  return { taxable: income - used, remainingAllowance: allowance - used, used }
}

export function calculateIncomeTaxStack(input: {
  nonSavingsPence: Pence
  savingsPence: Pence
  dividendsPence: Pence
  personalAllowancePence: Pence
  bandExtensionPence: Pence
  rules: TaxYearRules
}): {
  nonSavingsSlices: BandTaxSlice[]
  savingsSlices: BandTaxSlice[]
  dividendSlices: BandTaxSlice[]
  nonSavingsTaxPence: Pence
  savingsTaxPence: Pence
  dividendTaxPence: Pence
  incomeTaxPence: Pence
  taxableNonSavingsPence: Pence
  taxableSavingsPence: Pence
  taxableDividendsPence: Pence
  taxableIncomePence: Pence
  remainingBasicRateRoomPence: Pence
  personalSavingsAllowancePence: Pence
  startingRateUsedPence: Pence
  cursorAfterIncomePence: Pence
} {
  const ns = allocateAllowance(input.nonSavingsPence, input.personalAllowancePence)
  const sav = allocateAllowance(input.savingsPence, ns.remainingAllowance)
  const div = allocateAllowance(input.dividendsPence, sav.remainingAllowance)

  const nsOccupiedFixed = occupyFrom({
    fromPence: input.personalAllowancePence,
    amountPence: ns.taxable,
    bands: input.rules.nonSavingsBands,
    personalAllowancePence: input.personalAllowancePence,
    bandExtensionPence: input.bandExtensionPence,
  })

  const nsTax = taxOccupied(nsOccupiedFixed)

  const ukCursorAfterNs = input.personalAllowancePence + ns.taxable

  const startingRateRoom = Math.max(
    0,
    input.rules.startingRateForSavingsPence - ns.taxable,
  )

  const ukBasicTo =
    (input.rules.ukSavingsDividendBands.find((band) => band.id === 'basic')?.toPence ??
      0) + input.bandExtensionPence
  const ukHigherTo =
    (input.rules.ukSavingsDividendBands.find((band) => band.id === 'higher')?.toPence ??
      0) + input.bandExtensionPence
  const totalIncomeAfterPa = ukCursorAfterNs + sav.taxable + div.taxable

  let psa = input.rules.personalSavingsAllowanceAdditionalPence
  if (totalIncomeAfterPa <= ukBasicTo) {
    psa = input.rules.personalSavingsAllowanceBasicPence
  } else if (totalIncomeAfterPa <= ukHigherTo) {
    psa = input.rules.personalSavingsAllowanceHigherPence
  }

  const srsUsed = Math.min(sav.taxable, startingRateRoom)
  const afterSrs = sav.taxable - srsUsed
  const psaUsed = Math.min(afterSrs, psa)
  const savingsChargeable = afterSrs - psaUsed

  const savingsZeroOccupied = occupyFrom({
    fromPence: ukCursorAfterNs,
    amountPence: srsUsed + psaUsed,
    bands: input.rules.ukSavingsDividendBands,
    personalAllowancePence: input.personalAllowancePence,
    bandExtensionPence: input.bandExtensionPence,
  })
  const savingsTaxedOccupied = occupyFrom({
    fromPence: ukCursorAfterNs + srsUsed + psaUsed,
    amountPence: savingsChargeable,
    bands: input.rules.ukSavingsDividendBands,
    personalAllowancePence: input.personalAllowancePence,
    bandExtensionPence: input.bandExtensionPence,
  })

  const zeroSavingsSlices = taxOccupied(savingsZeroOccupied, () => 0)
  const chargedSavings = taxOccupied(savingsTaxedOccupied)
  const savingsSlices = [...zeroSavingsSlices.slices, ...chargedSavings.slices]

  const ukCursorAfterSavings = ukCursorAfterNs + sav.taxable

  const dividendAllowanceUsed = Math.min(div.taxable, input.rules.dividendAllowancePence)
  const dividendsChargeable = div.taxable - dividendAllowanceUsed

  const divZeroOccupied = occupyFrom({
    fromPence: ukCursorAfterSavings,
    amountPence: dividendAllowanceUsed,
    bands: input.rules.ukSavingsDividendBands,
    personalAllowancePence: input.personalAllowancePence,
    bandExtensionPence: input.bandExtensionPence,
  })
  const divTaxedOccupied = occupyFrom({
    fromPence: ukCursorAfterSavings + dividendAllowanceUsed,
    amountPence: dividendsChargeable,
    bands: input.rules.ukSavingsDividendBands,
    personalAllowancePence: input.personalAllowancePence,
    bandExtensionPence: input.bandExtensionPence,
  })

  const divZero = taxOccupied(divZeroOccupied, () => 0)
  const divCharged = taxOccupied(divTaxedOccupied, (band) => {
    if (band.bandId === 'additional') return input.rules.dividendAdditionalRate
    if (band.bandId === 'higher') return input.rules.dividendHigherRate
    return input.rules.dividendBasicRate
  })

  const cursorAfterIncome = ukCursorAfterSavings + div.taxable
  const basicRoom = remainingBasicRateRoom({
    fromPence: cursorAfterIncome,
    bands: input.rules.ukSavingsDividendBands,
    bandExtensionPence: input.bandExtensionPence,
  })

  return {
    nonSavingsSlices: nsTax.slices,
    savingsSlices,
    dividendSlices: [...divZero.slices, ...divCharged.slices],
    nonSavingsTaxPence: nsTax.taxPence,
    savingsTaxPence: chargedSavings.taxPence,
    dividendTaxPence: divCharged.taxPence,
    incomeTaxPence: nsTax.taxPence + chargedSavings.taxPence + divCharged.taxPence,
    taxableNonSavingsPence: ns.taxable,
    taxableSavingsPence: sav.taxable,
    taxableDividendsPence: div.taxable,
    taxableIncomePence: ns.taxable + sav.taxable + div.taxable,
    remainingBasicRateRoomPence: basicRoom,
    personalSavingsAllowancePence: psa,
    startingRateUsedPence: srsUsed,
    cursorAfterIncomePence: cursorAfterIncome,
  }
}
