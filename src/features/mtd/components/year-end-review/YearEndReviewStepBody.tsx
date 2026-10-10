import type { ReactNode } from 'react'
import { SizableText, XStack, YStack } from 'tamagui'

import { ReviewWizardChoice } from '~/features/mtd/components/review-wizard/ReviewWizardChoice'
import { mtdInputProps } from '~/features/mtd/mtdFormStyles'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { Input } from '~/interface/forms/Input'
import { formatSubmissionAmount } from '~/features/mtd/utils/formatAmount'
import { CheckIcon } from '~/interface/icons/phosphor/CheckIcon'

import type { YearEndReviewAnswers } from './yearEndReviewAnswersStorage'
import { YearEndOptionRow } from './YearEndOptionRow'
import {
  YEAR_END_ASSET_SALE_OPTIONS,
  YEAR_END_CHILD_BENEFIT_WHO_OPTIONS,
  YEAR_END_MARRIAGE_DIRECTION_OPTIONS,
  YEAR_END_STUDENT_LOAN_OPTIONS,
  type YearEndAssetSaleType,
  type YearEndChildBenefitWho,
  type YearEndMarriageDirection,
  type YearEndReviewStepId,
  type YearEndStudentLoan,
  type YearEndYn,
} from './yearEndReviewSteps'

type YearEndReviewStepBodyProps = {
  stepId: YearEndReviewStepId
  answers: YearEndReviewAnswers
  estimatedTax: number | null
  income: number
  expenses: number
  profit: number
  quarterlyComplete: boolean
  quarterlySubmittedLabel: string
  onChange: (next: YearEndReviewAnswers) => void
}

function FieldLabel({ children }: { children: string }) {
  return (
    <SizableText fontSize={13} fontWeight="500" color={MTD_TOKENS.textMuted}>
      {children}
    </SizableText>
  )
}

function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
}: {
  label: string
  value: string
  onChangeText: (value: string) => void
  placeholder?: string
  keyboardType?: 'default' | 'numeric' | 'decimal-pad'
}) {
  return (
    <YStack gap="$1.5" width="100%">
      <FieldLabel>{label}</FieldLabel>
      <Input
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        {...mtdInputProps}
      />
    </YStack>
  )
}

function YnChoices({
  answer,
  onAnswer,
}: {
  answer: YearEndYn | null
  onAnswer: (answer: YearEndYn) => void
}) {
  return (
    <XStack gap="$3" width="100%">
      <YStack flex={1}>
        <ReviewWizardChoice
          label="No"
          selected={answer === 'no'}
          onPress={() => onAnswer('no')}
        />
      </YStack>
      <YStack flex={1}>
        <ReviewWizardChoice
          label="Yes"
          selected={answer === 'yes'}
          onPress={() => onAnswer('yes')}
        />
      </YStack>
    </XStack>
  )
}

function OptionIcon({ selected }: { selected: boolean }): ReactNode {
  return (
    <CheckIcon size={18} color={selected ? MTD_TOKENS.orange : MTD_TOKENS.textMuted} />
  )
}

function FollowUps({ children }: { children: ReactNode }) {
  return (
    <YStack gap="$3" width="100%" pt="$1">
      {children}
    </YStack>
  )
}

export function YearEndReviewStepBody({
  stepId,
  answers,
  estimatedTax,
  income,
  expenses,
  profit,
  quarterlyComplete,
  quarterlySubmittedLabel,
  onChange,
}: YearEndReviewStepBodyProps) {
  switch (stepId) {
    case 'childBenefit':
      return (
        <YStack gap="$4">
          <YnChoices
            answer={answers.childBenefit.answer}
            onAnswer={(answer) =>
              onChange({
                ...answers,
                childBenefit: {
                  ...answers.childBenefit,
                  answer,
                  ...(answer === 'no' ? { numberOfChildren: '', whoReceives: null } : {}),
                },
              })
            }
          />
          {answers.childBenefit.answer === 'yes' ? (
            <FollowUps>
              <TextField
                label="Number of children"
                value={answers.childBenefit.numberOfChildren}
                onChangeText={(numberOfChildren) =>
                  onChange({
                    ...answers,
                    childBenefit: { ...answers.childBenefit, numberOfChildren },
                  })
                }
                keyboardType="numeric"
              />
              <YStack gap="$2">
                <FieldLabel>Who receives the Child Benefit?</FieldLabel>
                {YEAR_END_CHILD_BENEFIT_WHO_OPTIONS.map((option) => {
                  const selected = answers.childBenefit.whoReceives === option.id
                  return (
                    <YearEndOptionRow
                      key={option.id}
                      label={option.label}
                      selected={selected}
                      icon={<OptionIcon selected={selected} />}
                      onPress={() =>
                        onChange({
                          ...answers,
                          childBenefit: {
                            ...answers.childBenefit,
                            whoReceives: option.id as YearEndChildBenefitWho,
                          },
                        })
                      }
                    />
                  )
                })}
              </YStack>
            </FollowUps>
          ) : null}
        </YStack>
      )

    case 'employment':
      return (
        <YStack gap="$4">
          <YnChoices
            answer={answers.employment.answer}
            onAnswer={(answer) =>
              onChange({
                ...answers,
                employment: {
                  ...answers.employment,
                  answer,
                  ...(answer === 'no'
                    ? {
                        employerName: '',
                        expectedAnnualSalary: '',
                        expectedBonus: '',
                        companyCarValue: '',
                        companyFuelBenefit: '',
                        medicalInsuranceValue: '',
                        otherBenefits: '',
                        taxCode: '',
                      }
                    : {}),
                },
              })
            }
          />
          {answers.employment.answer === 'yes' ? (
            <FollowUps>
              <TextField
                label="Employer name"
                value={answers.employment.employerName}
                onChangeText={(employerName) =>
                  onChange({
                    ...answers,
                    employment: { ...answers.employment, employerName },
                  })
                }
              />
              <TextField
                label="Expected annual salary"
                value={answers.employment.expectedAnnualSalary}
                onChangeText={(expectedAnnualSalary) =>
                  onChange({
                    ...answers,
                    employment: { ...answers.employment, expectedAnnualSalary },
                  })
                }
                keyboardType="decimal-pad"
              />
              <TextField
                label="Expected bonus"
                value={answers.employment.expectedBonus}
                onChangeText={(expectedBonus) =>
                  onChange({
                    ...answers,
                    employment: { ...answers.employment, expectedBonus },
                  })
                }
                keyboardType="decimal-pad"
              />
              <YStack gap="$2">
                <FieldLabel>Company benefits:</FieldLabel>
                <TextField
                  label="Company Car Value"
                  value={answers.employment.companyCarValue}
                  onChangeText={(companyCarValue) =>
                    onChange({
                      ...answers,
                      employment: { ...answers.employment, companyCarValue },
                    })
                  }
                  keyboardType="decimal-pad"
                />
                <TextField
                  label="Company Fuel Benefit"
                  value={answers.employment.companyFuelBenefit}
                  onChangeText={(companyFuelBenefit) =>
                    onChange({
                      ...answers,
                      employment: { ...answers.employment, companyFuelBenefit },
                    })
                  }
                  keyboardType="decimal-pad"
                />
                <TextField
                  label="Medical Insurance Value"
                  value={answers.employment.medicalInsuranceValue}
                  onChangeText={(medicalInsuranceValue) =>
                    onChange({
                      ...answers,
                      employment: {
                        ...answers.employment,
                        medicalInsuranceValue,
                      },
                    })
                  }
                  keyboardType="decimal-pad"
                />
                <TextField
                  label="Other"
                  value={answers.employment.otherBenefits}
                  onChangeText={(otherBenefits) =>
                    onChange({
                      ...answers,
                      employment: { ...answers.employment, otherBenefits },
                    })
                  }
                />
              </YStack>
              <TextField
                label="Tax code (if known)"
                value={answers.employment.taxCode}
                onChangeText={(taxCode) =>
                  onChange({
                    ...answers,
                    employment: { ...answers.employment, taxCode },
                  })
                }
              />
            </FollowUps>
          ) : null}
        </YStack>
      )

    case 'overseasRental':
      return (
        <YStack gap="$4">
          <YnChoices
            answer={answers.overseasRental.answer}
            onAnswer={(answer) =>
              onChange({
                ...answers,
                overseasRental: {
                  ...answers.overseasRental,
                  answer,
                  ...(answer === 'no'
                    ? {
                        country: '',
                        estimatedAnnualIncome: '',
                        estimatedAnnualExpenses: '',
                        foreignTaxPaid: '',
                      }
                    : {}),
                },
              })
            }
          />
          {answers.overseasRental.answer === 'yes' ? (
            <FollowUps>
              <TextField
                label="Country"
                value={answers.overseasRental.country}
                onChangeText={(country) =>
                  onChange({
                    ...answers,
                    overseasRental: { ...answers.overseasRental, country },
                  })
                }
              />
              <TextField
                label="Estimated annual income"
                value={answers.overseasRental.estimatedAnnualIncome}
                onChangeText={(estimatedAnnualIncome) =>
                  onChange({
                    ...answers,
                    overseasRental: {
                      ...answers.overseasRental,
                      estimatedAnnualIncome,
                    },
                  })
                }
                keyboardType="decimal-pad"
              />
              <TextField
                label="Estimated annual expenses"
                value={answers.overseasRental.estimatedAnnualExpenses}
                onChangeText={(estimatedAnnualExpenses) =>
                  onChange({
                    ...answers,
                    overseasRental: {
                      ...answers.overseasRental,
                      estimatedAnnualExpenses,
                    },
                  })
                }
                keyboardType="decimal-pad"
              />
              <TextField
                label="Foreign tax paid"
                value={answers.overseasRental.foreignTaxPaid}
                onChangeText={(foreignTaxPaid) =>
                  onChange({
                    ...answers,
                    overseasRental: {
                      ...answers.overseasRental,
                      foreignTaxPaid,
                    },
                  })
                }
                keyboardType="decimal-pad"
              />
            </FollowUps>
          ) : null}
        </YStack>
      )

    case 'bankInterest':
      return (
        <YStack gap="$4">
          <YnChoices
            answer={answers.bankInterest.answer}
            onAnswer={(answer) =>
              onChange({
                ...answers,
                bankInterest: {
                  ...answers.bankInterest,
                  answer,
                  ...(answer === 'no' ? { estimatedAnnualInterest: '' } : {}),
                },
              })
            }
          />
          {answers.bankInterest.answer === 'yes' ? (
            <FollowUps>
              <TextField
                label="Estimated annual interest"
                value={answers.bankInterest.estimatedAnnualInterest}
                onChangeText={(estimatedAnnualInterest) =>
                  onChange({
                    ...answers,
                    bankInterest: {
                      ...answers.bankInterest,
                      estimatedAnnualInterest,
                    },
                  })
                }
                keyboardType="decimal-pad"
              />
            </FollowUps>
          ) : null}
        </YStack>
      )

    case 'dividends':
      return (
        <YStack gap="$4">
          <YnChoices
            answer={answers.dividends.answer}
            onAnswer={(answer) =>
              onChange({
                ...answers,
                dividends: {
                  ...answers.dividends,
                  answer,
                  ...(answer === 'no'
                    ? {
                        estimatedUkDividends: '',
                        estimatedForeignDividends: '',
                      }
                    : {}),
                },
              })
            }
          />
          {answers.dividends.answer === 'yes' ? (
            <FollowUps>
              <TextField
                label="Estimated UK dividends"
                value={answers.dividends.estimatedUkDividends}
                onChangeText={(estimatedUkDividends) =>
                  onChange({
                    ...answers,
                    dividends: { ...answers.dividends, estimatedUkDividends },
                  })
                }
                keyboardType="decimal-pad"
              />
              <TextField
                label="Estimated foreign dividends"
                value={answers.dividends.estimatedForeignDividends}
                onChangeText={(estimatedForeignDividends) =>
                  onChange({
                    ...answers,
                    dividends: {
                      ...answers.dividends,
                      estimatedForeignDividends,
                    },
                  })
                }
                keyboardType="decimal-pad"
              />
            </FollowUps>
          ) : null}
        </YStack>
      )

    case 'statePension':
      return (
        <YStack gap="$4">
          <YnChoices
            answer={answers.statePension.answer}
            onAnswer={(answer) =>
              onChange({
                ...answers,
                statePension: {
                  ...answers.statePension,
                  answer,
                  ...(answer === 'no' ? { estimatedAnnualAmount: '' } : {}),
                },
              })
            }
          />
          {answers.statePension.answer === 'yes' ? (
            <FollowUps>
              <TextField
                label="Estimated annual amount"
                value={answers.statePension.estimatedAnnualAmount}
                onChangeText={(estimatedAnnualAmount) =>
                  onChange({
                    ...answers,
                    statePension: {
                      ...answers.statePension,
                      estimatedAnnualAmount,
                    },
                  })
                }
                keyboardType="decimal-pad"
              />
            </FollowUps>
          ) : null}
        </YStack>
      )

    case 'privatePension':
      return (
        <YStack gap="$4">
          <YnChoices
            answer={answers.privatePension.answer}
            onAnswer={(answer) =>
              onChange({
                ...answers,
                privatePension: {
                  ...answers.privatePension,
                  answer,
                  ...(answer === 'no'
                    ? {
                        estimatedAnnualPensionIncome: '',
                        estimatedTaxDeducted: '',
                      }
                    : {}),
                },
              })
            }
          />
          {answers.privatePension.answer === 'yes' ? (
            <FollowUps>
              <TextField
                label="Estimated annual pension income"
                value={answers.privatePension.estimatedAnnualPensionIncome}
                onChangeText={(estimatedAnnualPensionIncome) =>
                  onChange({
                    ...answers,
                    privatePension: {
                      ...answers.privatePension,
                      estimatedAnnualPensionIncome,
                    },
                  })
                }
                keyboardType="decimal-pad"
              />
              <TextField
                label="Estimated tax deducted"
                value={answers.privatePension.estimatedTaxDeducted}
                onChangeText={(estimatedTaxDeducted) =>
                  onChange({
                    ...answers,
                    privatePension: {
                      ...answers.privatePension,
                      estimatedTaxDeducted,
                    },
                  })
                }
                keyboardType="decimal-pad"
              />
            </FollowUps>
          ) : null}
        </YStack>
      )

    case 'otherTaxableIncome':
      return (
        <YStack gap="$4">
          <YnChoices
            answer={answers.otherTaxableIncome.answer}
            onAnswer={(answer) =>
              onChange({
                ...answers,
                otherTaxableIncome: {
                  ...answers.otherTaxableIncome,
                  answer,
                  ...(answer === 'no'
                    ? { description: '', estimatedAnnualAmount: '' }
                    : {}),
                },
              })
            }
          />
          {answers.otherTaxableIncome.answer === 'yes' ? (
            <FollowUps>
              <TextField
                label="Description"
                value={answers.otherTaxableIncome.description}
                onChangeText={(description) =>
                  onChange({
                    ...answers,
                    otherTaxableIncome: {
                      ...answers.otherTaxableIncome,
                      description,
                    },
                  })
                }
              />
              <TextField
                label="Estimated annual amount"
                value={answers.otherTaxableIncome.estimatedAnnualAmount}
                onChangeText={(estimatedAnnualAmount) =>
                  onChange({
                    ...answers,
                    otherTaxableIncome: {
                      ...answers.otherTaxableIncome,
                      estimatedAnnualAmount,
                    },
                  })
                }
                keyboardType="decimal-pad"
              />
            </FollowUps>
          ) : null}
        </YStack>
      )

    case 'assetSales':
      return (
        <YStack gap="$4">
          <YnChoices
            answer={answers.assetSales.answer}
            onAnswer={(answer) =>
              onChange({
                ...answers,
                assetSales: {
                  ...answers.assetSales,
                  answer,
                  ...(answer === 'no' ? { types: [], estimatedGain: '' } : {}),
                },
              })
            }
          />
          {answers.assetSales.answer === 'yes' ? (
            <FollowUps>
              <YStack gap="$2">
                {YEAR_END_ASSET_SALE_OPTIONS.map((option) => {
                  const selected = answers.assetSales.types.includes(option.id)
                  return (
                    <YearEndOptionRow
                      key={option.id}
                      label={option.label}
                      selected={selected}
                      icon={<OptionIcon selected={selected} />}
                      onPress={() => {
                        const types = selected
                          ? answers.assetSales.types.filter((id) => id !== option.id)
                          : [
                              ...answers.assetSales.types,
                              option.id as YearEndAssetSaleType,
                            ]
                        onChange({
                          ...answers,
                          assetSales: { ...answers.assetSales, types },
                        })
                      }}
                    />
                  )
                })}
              </YStack>
              <TextField
                label="Estimated gain"
                value={answers.assetSales.estimatedGain}
                onChangeText={(estimatedGain) =>
                  onChange({
                    ...answers,
                    assetSales: { ...answers.assetSales, estimatedGain },
                  })
                }
                keyboardType="decimal-pad"
              />
            </FollowUps>
          ) : null}
        </YStack>
      )

    case 'pensionContributions':
      return (
        <YStack gap="$4">
          <YnChoices
            answer={answers.pensionContributions.answer}
            onAnswer={(answer) =>
              onChange({
                ...answers,
                pensionContributions: {
                  ...answers.pensionContributions,
                  answer,
                  ...(answer === 'no' ? { estimatedAnnualGrossContribution: '' } : {}),
                },
              })
            }
          />
          {answers.pensionContributions.answer === 'yes' ? (
            <FollowUps>
              <TextField
                label="Estimated annual gross contribution"
                value={answers.pensionContributions.estimatedAnnualGrossContribution}
                onChangeText={(estimatedAnnualGrossContribution) =>
                  onChange({
                    ...answers,
                    pensionContributions: {
                      ...answers.pensionContributions,
                      estimatedAnnualGrossContribution,
                    },
                  })
                }
                keyboardType="decimal-pad"
              />
            </FollowUps>
          ) : null}
        </YStack>
      )

    case 'giftAid':
      return (
        <YStack gap="$4">
          <YnChoices
            answer={answers.giftAid.answer}
            onAnswer={(answer) =>
              onChange({
                ...answers,
                giftAid: {
                  ...answers.giftAid,
                  answer,
                  ...(answer === 'no' ? { estimatedAnnualDonations: '' } : {}),
                },
              })
            }
          />
          {answers.giftAid.answer === 'yes' ? (
            <FollowUps>
              <TextField
                label="Estimated annual donations"
                value={answers.giftAid.estimatedAnnualDonations}
                onChangeText={(estimatedAnnualDonations) =>
                  onChange({
                    ...answers,
                    giftAid: {
                      ...answers.giftAid,
                      estimatedAnnualDonations,
                    },
                  })
                }
                keyboardType="decimal-pad"
              />
            </FollowUps>
          ) : null}
        </YStack>
      )

    case 'studentLoan':
      return (
        <YStack gap="$2.5">
          {YEAR_END_STUDENT_LOAN_OPTIONS.map((option) => {
            const selected = answers.studentLoan === option.id
            return (
              <YearEndOptionRow
                key={option.id}
                label={option.label}
                selected={selected}
                icon={<OptionIcon selected={selected} />}
                onPress={() =>
                  onChange({
                    ...answers,
                    studentLoan: option.id as YearEndStudentLoan,
                  })
                }
              />
            )
          })}
        </YStack>
      )

    case 'marriageAllowance':
      return (
        <YStack gap="$4">
          <YnChoices
            answer={answers.marriageAllowance.answer}
            onAnswer={(answer) =>
              onChange({
                ...answers,
                marriageAllowance: {
                  answer,
                  direction: answer === 'no' ? null : answers.marriageAllowance.direction,
                },
              })
            }
          />
          {answers.marriageAllowance.answer === 'yes' ? (
            <FollowUps>
              {YEAR_END_MARRIAGE_DIRECTION_OPTIONS.map((option) => {
                const selected = answers.marriageAllowance.direction === option.id
                return (
                  <YearEndOptionRow
                    key={option.id}
                    label={option.label}
                    selected={selected}
                    icon={<OptionIcon selected={selected} />}
                    onPress={() =>
                      onChange({
                        ...answers,
                        marriageAllowance: {
                          ...answers.marriageAllowance,
                          direction: option.id as YearEndMarriageDirection,
                        },
                      })
                    }
                  />
                )
              })}
            </FollowUps>
          ) : null}
        </YStack>
      )

    case 'blindPersonsAllowance':
      return (
        <YnChoices
          answer={answers.blindPersonsAllowance}
          onAnswer={(answer) =>
            onChange({
              ...answers,
              blindPersonsAllowance: answer,
            })
          }
        />
      )

    case 'ukResidence':
      return (
        <YStack gap="$4">
          <YnChoices
            answer={answers.ukResidence.answer}
            onAnswer={(answer) =>
              onChange({
                ...answers,
                ukResidence: {
                  answer,
                  anyOverseasIncome:
                    answer === 'yes' ? null : answers.ukResidence.anyOverseasIncome,
                  anyPeriodsWorkingAbroad:
                    answer === 'yes' ? null : answers.ukResidence.anyPeriodsWorkingAbroad,
                },
              })
            }
          />
          {answers.ukResidence.answer === 'no' ? (
            <FollowUps>
              <YStack gap="$2">
                <FieldLabel>Any overseas income?</FieldLabel>
                <YnChoices
                  answer={answers.ukResidence.anyOverseasIncome}
                  onAnswer={(anyOverseasIncome) =>
                    onChange({
                      ...answers,
                      ukResidence: {
                        ...answers.ukResidence,
                        anyOverseasIncome,
                      },
                    })
                  }
                />
              </YStack>
              <YStack gap="$2">
                <FieldLabel>Any periods working abroad?</FieldLabel>
                <YnChoices
                  answer={answers.ukResidence.anyPeriodsWorkingAbroad}
                  onAnswer={(anyPeriodsWorkingAbroad) =>
                    onChange({
                      ...answers,
                      ukResidence: {
                        ...answers.ukResidence,
                        anyPeriodsWorkingAbroad,
                      },
                    })
                  }
                />
              </YStack>
            </FollowUps>
          ) : null}
        </YStack>
      )

    case 'lossesBroughtForward':
      return (
        <YStack gap="$4">
          <YnChoices
            answer={answers.lossesBroughtForward.answer}
            onAnswer={(answer) =>
              onChange({
                ...answers,
                lossesBroughtForward: {
                  ...answers.lossesBroughtForward,
                  answer,
                  ...(answer === 'no'
                    ? {
                        tradingLosses: '',
                        propertyLosses: '',
                        capitalLosses: '',
                      }
                    : {}),
                },
              })
            }
          />
          {answers.lossesBroughtForward.answer === 'yes' ? (
            <FollowUps>
              <TextField
                label="Trading losses"
                value={answers.lossesBroughtForward.tradingLosses}
                onChangeText={(tradingLosses) =>
                  onChange({
                    ...answers,
                    lossesBroughtForward: {
                      ...answers.lossesBroughtForward,
                      tradingLosses,
                    },
                  })
                }
                keyboardType="decimal-pad"
              />
              <TextField
                label="Property losses"
                value={answers.lossesBroughtForward.propertyLosses}
                onChangeText={(propertyLosses) =>
                  onChange({
                    ...answers,
                    lossesBroughtForward: {
                      ...answers.lossesBroughtForward,
                      propertyLosses,
                    },
                  })
                }
                keyboardType="decimal-pad"
              />
              <TextField
                label="Capital losses"
                value={answers.lossesBroughtForward.capitalLosses}
                onChangeText={(capitalLosses) =>
                  onChange({
                    ...answers,
                    lossesBroughtForward: {
                      ...answers.lossesBroughtForward,
                      capitalLosses,
                    },
                  })
                }
                keyboardType="decimal-pad"
              />
            </FollowUps>
          ) : null}
        </YStack>
      )

    case 'complete': {
      const rows = [
        { key: 'income', label: 'Income', value: income, color: MTD_TOKENS.text },
        {
          key: 'expenses',
          label: 'Expenses',
          value: expenses,
          color: MTD_TOKENS.green,
        },
        { key: 'profit', label: 'Profit', value: profit, color: MTD_TOKENS.green },
        ...(estimatedTax != null
          ? [
              {
                key: 'tax',
                label: 'Estimated tax',
                value: estimatedTax,
                color: MTD_TOKENS.orange,
              },
            ]
          : []),
      ]

      return (
        <YStack gap="$5" items="center" width="100%">
          <YStack
            width={88}
            height={88}
            rounded="$10"
            bg={MTD_TOKENS.green}
            items="center"
            justify="center"
          >
            <CheckIcon size={44} color={MTD_TOKENS.onOrange} />
          </YStack>

          <YStack
            width="100%"
            rounded="$4"
            bg={MTD_TOKENS.card}
            borderWidth={1}
            borderColor={MTD_TOKENS.cardBorder}
            overflow="hidden"
          >
            {rows.map((row, index) => (
              <XStack
                key={row.key}
                px="$4"
                py="$3.5"
                items="center"
                justify="space-between"
                borderBottomWidth={index < rows.length - 1 ? 1 : 0}
                borderBottomColor={MTD_TOKENS.cardBorder}
              >
                <SizableText fontSize={14} color={MTD_TOKENS.textMuted}>
                  {row.label}
                </SizableText>
                <SizableText fontSize={15} fontWeight="600" color={row.color}>
                  {formatSubmissionAmount(row.value)}
                </SizableText>
              </XStack>
            ))}
          </YStack>

          <YStack width="100%" gap="$2.5">
            <XStack items="center" gap="$2">
              <CheckIcon size={18} color={MTD_TOKENS.green} />
              <SizableText fontSize={14} color={MTD_TOKENS.text}>
                {quarterlySubmittedLabel}
              </SizableText>
            </XStack>
            <XStack items="center" gap="$2">
              <CheckIcon size={18} color={MTD_TOKENS.green} />
              <SizableText fontSize={14} color={MTD_TOKENS.text}>
                Year-End Information Complete
              </SizableText>
            </XStack>
            {!quarterlyComplete ? (
              <SizableText fontSize={13} color={MTD_TOKENS.textMuted}>
                Finish any outstanding quarterly updates before sending to HMRC.
              </SizableText>
            ) : null}
          </YStack>
        </YStack>
      )
    }
  }
}
