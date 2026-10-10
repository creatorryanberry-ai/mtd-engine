import type { Pence } from './money'
import { getTaxRoundingPolicy } from './rounding'
import type { TaxYearRules } from './taxYearRules'
import type { PaymentsOnAccountEstimate } from './types'

export function calculatePaymentsOnAccount(input: {
  incomeTaxPence: Pence
  class4Pence: Pence
  childBenefitChargePence: Pence
  alreadyPaidForPoaPence: Pence
  stillToPayPence: Pence
  rules: TaxYearRules
  estimated: boolean
}): PaymentsOnAccountEstimate {
  const rounding = getTaxRoundingPolicy()
  const poaBase = Math.max(
    0,
    input.incomeTaxPence + input.class4Pence - input.alreadyPaidForPoaPence,
  )
  const incomeTaxAndClass4 = input.incomeTaxPence + input.class4Pence
  const collectedAtSource = Math.min(input.alreadyPaidForPoaPence, incomeTaxAndClass4)

  const required =
    poaBase >= input.rules.paymentsOnAccountMinimumPence &&
    (incomeTaxAndClass4 <= 0 ||
      collectedAtSource <
        incomeTaxAndClass4 * input.rules.paymentsOnAccountCollectedAtSourceRatio)

  if (!required) {
    return {
      required: false,
      estimated: input.estimated,
      relevantAmountPence: poaBase,
      firstPaymentPence: 0,
      secondPaymentPence: 0,
      januaryTotalPence: input.stillToPayPence,
      julyPaymentPence: 0,
    }
  }

  const firstPaymentPence = rounding.roundComponent(poaBase / 2)
  const secondPaymentPence = poaBase - firstPaymentPence

  return {
    required: true,
    estimated: input.estimated,
    relevantAmountPence: poaBase,
    firstPaymentPence,
    secondPaymentPence,
    januaryTotalPence: input.stillToPayPence + firstPaymentPence,
    julyPaymentPence: secondPaymentPence,
  }
}
