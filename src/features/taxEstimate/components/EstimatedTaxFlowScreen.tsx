import { useEffect, useMemo, useState } from 'react'
import { router, useParams } from 'one'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isWeb, ScrollView, SizableText, Spinner, XStack, YStack } from 'tamagui'

import { MtdActionButton } from '~/features/mtd/components/MtdActionButton'
import { MtdDetailHeader } from '~/features/mtd/components/MtdDetailHeader'
import { YearEndOptionRow } from '~/features/mtd/components/year-end-review/YearEndOptionRow'
import { MTD_ROUTES, MTD_TAB_BAR_HEIGHT } from '~/features/mtd/constants'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { ESTIMATE_CATEGORIES } from '~/features/taxEstimate/categories'
import { createEmploymentRecord } from '~/features/taxEstimate/answers'
import { useTaxEstimate } from '~/features/taxEstimate/client/useTaxEstimate'
import {
  EstimateHelper,
  EstimateNotSureButton,
  EstimateYesNo,
} from '~/features/taxEstimate/components/EstimateChoices'
import {
  EstimateMoneyInput,
  parsePoundsInput,
  poundsToInput,
} from '~/features/taxEstimate/components/EstimateMoneyInput'
import type { EstimateCategoryId, TaxEstimateAnswers } from '~/features/taxEstimate/types'
import { CheckIcon } from '~/interface/icons/phosphor/CheckIcon'
import { Input } from '~/interface/forms/Input'
import { showToast } from '~/interface/toast/helpers'

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <YStack gap="$2" width="100%">
      <SizableText fontSize={12} color={MTD_TOKENS.textMuted}>
        {step + 1} of {total}
      </SizableText>
      <XStack gap="$1.5" width="100%">
        {Array.from({ length: total }, (_, index) => (
          <YStack
            key={index}
            flex={1}
            height={4}
            rounded="$10"
            bg={index <= step ? MTD_TOKENS.orange : MTD_TOKENS.cardInset}
          />
        ))}
      </XStack>
    </YStack>
  )
}

function isCategoryId(value: string | undefined): value is EstimateCategoryId {
  return ESTIMATE_CATEGORIES.some((category) => category.id === value)
}

export function EstimatedTaxFlowScreen() {
  const insets = useSafeAreaInsets()
  const params = useParams<{ category?: string }>()
  const categoryId = isCategoryId(params.category) ? params.category : 'employment'
  const meta = ESTIMATE_CATEGORIES.find((category) => category.id === categoryId)!
  const { data, isLoading, error, refetch, save, isSaving } = useTaxEstimate()
  const [draft, setDraft] = useState<TaxEstimateAnswers | null>(null)
  const [step, setStep] = useState(0)
  const answers = draft ?? data?.answers ?? null

  useEffect(() => {
    if (data?.answers) {
      setDraft(data.answers)
      setStep(0)
    }
  }, [data?.answers, categoryId])

  const steps = useMemo(() => {
    if (!answers) return [meta.question]
    return getStepQuestions(
      categoryId,
      answers,
      Boolean(data?.business.propertyFromRecords),
    )
  }, [answers, categoryId, data?.business.propertyFromRecords, meta.question])

  function goToEstimateHome() {
    router.replace(MTD_ROUTES.estimatedTax)
  }

  async function finish(next: TaxEstimateAnswers) {
    try {
      await save({ answers: { [categoryId]: next[categoryId] } })
      showToast(`${meta.title} added. You can update this anytime.`, { type: 'success' })
      goToEstimateHome()
    } catch (saveError) {
      showToast(
        saveError instanceof Error ? saveError.message : 'Could not save that answer',
        { type: 'error' },
      )
    }
  }

  if (error && !data) {
    return (
      <YStack
        flex={1}
        bg={MTD_TOKENS.background}
        items="center"
        justify="center"
        gap="$3"
        px="$4"
      >
        <SizableText fontSize={16} fontWeight="600" color={MTD_TOKENS.text}>
          Could not load this estimate
        </SizableText>
        <SizableText fontSize={14} color={MTD_TOKENS.textMuted} text="center">
          {error instanceof Error ? error.message : 'Please try again.'}
        </SizableText>
        <MtdActionButton onPress={() => void refetch()}>Try again</MtdActionButton>
      </YStack>
    )
  }

  if ((isLoading && !data) || !answers) {
    return (
      <YStack flex={1} bg={MTD_TOKENS.background} items="center" justify="center">
        <Spinner size="large" color={MTD_TOKENS.orange} />
      </YStack>
    )
  }

  const body = renderStep({
    categoryId,
    step,
    answers,
    setAnswers: setDraft,
    propertyFromRecords: Boolean(data?.business.propertyFromRecords),
    propertyProfit: data?.business.propertyProfitPounds ?? 0,
    onDone: () => void finish(answers),
  })

  const content = (
    <YStack
      gap="$5"
      px="$4"
      pt="$4"
      pb={isWeb ? '$6' : insets.bottom + MTD_TAB_BAR_HEIGHT + 24}
      maxW={560}
      width="100%"
      mx="auto"
    >
      <ProgressBar step={Math.min(step, steps.length - 1)} total={steps.length} />
      <SizableText fontSize={24} fontWeight="700" color={MTD_TOKENS.text} lineHeight={30}>
        {steps[Math.min(step, steps.length - 1)]}
      </SizableText>
      {body}
      <XStack gap="$3" width="100%" mt="$2">
        <MtdActionButton
          flex={1}
          size="large"
          variant="secondary"
          onPress={() => {
            if (step === 0) {
              goToEstimateHome()
              return
            }
            setStep((current) => Math.max(0, current - 1))
          }}
        >
          Back
        </MtdActionButton>
        <MtdActionButton
          flex={1}
          size="large"
          loading={isSaving}
          onPress={() => {
            if (step >= steps.length - 1) {
              void finish(answers)
              return
            }
            setStep((current) => current + 1)
          }}
        >
          {step >= steps.length - 1 ? 'Done' : 'Next'}
        </MtdActionButton>
      </XStack>
    </YStack>
  )

  const header = (
    <MtdDetailHeader
      backHref={MTD_ROUTES.estimatedTax}
      title={meta.title}
      skipSlideClose
      onBack={goToEstimateHome}
    />
  )

  if (isWeb) {
    return (
      <YStack flex={1} minH={0} bg={MTD_TOKENS.background}>
        {header}
        <YStack flex={1} minH={0} overflow="scroll">
          {content}
        </YStack>
      </YStack>
    )
  }

  return (
    <YStack flex={1} bg={MTD_TOKENS.background}>
      <YStack pt={insets.top}>{header}</YStack>
      <ScrollView flex={1} showsVerticalScrollIndicator={false}>
        {content}
      </ScrollView>
    </YStack>
  )
}

function getStepQuestions(
  categoryId: EstimateCategoryId,
  answers: TaxEstimateAnswers,
  propertyFromRecords: boolean,
) {
  switch (categoryId) {
    case 'employment':
      if (answers.employment.hadJob === 'no')
        return ['Did you have a job as well as your business?']
      return [
        'Did you have a job as well as your business?',
        'How much were you paid before tax?',
        'How much tax was taken from your pay?',
        'Did you receive any taxable benefits from your employer?',
      ]
    case 'savings':
      if (answers.savings.hadInterest === 'no')
        return ['Did you earn interest on savings?']
      return [
        'Did you earn interest on savings?',
        'How much interest did you earn in total?',
      ]
    case 'investments':
      if (answers.investments.hadDividends === 'no') {
        return ['Did you receive any dividends?', 'Did you sell any investments?']
      }
      return [
        'Did you receive any dividends?',
        'How much did you receive in total?',
        'Did you sell any investments?',
      ]
    case 'property':
      if (answers.property.hadRental === 'no') return ['Did you receive rental income?']
      if (propertyFromRecords) return ['Did you receive rental income?']
      return [
        'Did you receive rental income?',
        'How much rental income did you receive?',
        'How much did it cost you to run the property?',
      ]
    case 'pensions':
      if (answers.pensions.hadPension === 'no') return ['Did you receive a pension?']
      return [
        'Did you receive a pension?',
        'What type of pension did you receive?',
        'How much pension income did you receive?',
      ]
    case 'family':
      if (answers.family.received === 'no') {
        return ['Did you or your partner receive Child Benefit?']
      }
      return [
        'Did you or your partner receive Child Benefit?',
        'Who received it, and for how many children?',
      ]
    case 'studentLoan':
      if (answers.studentLoan.repaying === 'no') {
        return ['Are you repaying a student or postgraduate loan?']
      }
      return [
        'Are you repaying a student or postgraduate loan?',
        'Which loan type are you repaying?',
      ]
    case 'reliefs':
      if (answers.reliefs.hadReliefs === 'no') {
        return ['Did you pay into a pension or donate through Gift Aid?']
      }
      return [
        'Did you pay into a pension or donate through Gift Aid?',
        'How much did you pay in?',
      ]
    case 'capitalGains':
      if (answers.capitalGains.soldAssets === 'no') {
        return ['Did you sell any property, shares, crypto or another valuable asset?']
      }
      return [
        'Did you sell any property, shares, crypto or another valuable asset?',
        'What did you sell?',
        'What was the sale and what did it cost you?',
      ]
    case 'foreignIncome':
      if (answers.foreignIncome.hadForeignIncome === 'no') {
        return ['Did you receive any income from outside the UK?']
      }
      return [
        'Did you receive any income from outside the UK?',
        'What kind of income was it, and how much?',
      ]
    case 'otherIncome':
      if (answers.otherIncome.hadOtherIncome === 'no') {
        return ['Did you receive any other taxable income?']
      }
      return ['Did you receive any other taxable income?', 'Tell us a little more']
  }
}

function OptionCheck({ selected }: { selected: boolean }) {
  return (
    <CheckIcon size={18} color={selected ? MTD_TOKENS.orange : MTD_TOKENS.textMuted} />
  )
}

function renderStep({
  categoryId,
  step,
  answers,
  setAnswers,
  propertyFromRecords,
  propertyProfit,
  onDone,
}: {
  categoryId: EstimateCategoryId
  step: number
  answers: TaxEstimateAnswers
  setAnswers: (next: TaxEstimateAnswers) => void
  propertyFromRecords: boolean
  propertyProfit: number
  onDone: () => void
}) {
  const patch = (partial: Partial<TaxEstimateAnswers>) =>
    setAnswers({ ...answers, ...partial })

  if (categoryId === 'employment') {
    const jobs =
      answers.employment.jobs.length > 0
        ? answers.employment.jobs
        : [createEmploymentRecord({ id: 'job-1' })]
    const updateJobs = (
      nextJobs: typeof jobs,
      extra?: Partial<typeof answers.employment>,
    ) =>
      patch({
        employment: {
          ...answers.employment,
          ...extra,
          jobs: nextJobs,
        },
      })
    const updateJob = (
      jobId: string,
      fields: Partial<(typeof jobs)[number]>,
      extra?: Partial<typeof answers.employment>,
    ) =>
      updateJobs(
        jobs.map((job) => (job.id === jobId ? { ...job, ...fields } : job)),
        extra,
      )

    if (step === 0) {
      return (
        <YStack gap="$3">
          <EstimateYesNo
            value={answers.employment.hadJob}
            onChange={(hadJob) =>
              patch({
                employment: {
                  ...answers.employment,
                  hadJob,
                  status: hadJob === 'no' ? 'no' : 'incomplete',
                },
              })
            }
          />
        </YStack>
      )
    }
    if (step === 1) {
      return (
        <YStack gap="$4">
          {jobs.map((job, index) => (
            <YStack key={job.id} gap="$2">
              <SizableText fontSize={13} fontWeight="600" color={MTD_TOKENS.textMuted}>
                {jobs.length > 1 ? `Job ${index + 1}` : 'Pay before tax'}
              </SizableText>
              <Input
                value={job.employerName}
                onChangeText={(employerName) => updateJob(job.id, { employerName })}
                placeholder="Employer name (optional)"
              />
              <EstimateMoneyInput
                value={poundsToInput(job.grossPayPounds)}
                onChangeText={(value) =>
                  updateJob(job.id, { grossPayPounds: parsePoundsInput(value) })
                }
              />
              {jobs.length > 1 ? (
                <SizableText
                  fontSize={13}
                  fontWeight="600"
                  color={MTD_TOKENS.orange}
                  onPress={() => updateJobs(jobs.filter((item) => item.id !== job.id))}
                >
                  Remove this job
                </SizableText>
              ) : null}
            </YStack>
          ))}
          <EstimateHelper>Add each job's pay before tax.</EstimateHelper>
          <MtdActionButton
            variant="secondary"
            onPress={() => updateJobs([...jobs, createEmploymentRecord()])}
          >
            Add another job
          </MtdActionButton>
        </YStack>
      )
    }
    if (step === 2) {
      return (
        <YStack gap="$4">
          {jobs.map((job, index) => (
            <YStack key={job.id} gap="$2">
              <SizableText fontSize={13} fontWeight="600" color={MTD_TOKENS.textMuted}>
                {jobs.length > 1
                  ? `Tax taken from ${job.employerName || `job ${index + 1}`}`
                  : 'How much tax was taken from your pay?'}
              </SizableText>
              <EstimateMoneyInput
                value={poundsToInput(job.payeTaxDeductedPounds)}
                onChangeText={(value) =>
                  updateJob(job.id, { payeTaxDeductedPounds: parsePoundsInput(value) })
                }
              />
            </YStack>
          ))}
          <EstimateHelper>You'll usually find this on your P60.</EstimateHelper>
          <EstimateNotSureButton
            onPress={() =>
              updateJobs(
                jobs.map((job) => ({ ...job, payeTaxDeductedPounds: null })),
                { status: 'needs_review' },
              )
            }
          />
        </YStack>
      )
    }
    return (
      <YStack gap="$3">
        <EstimateHelper>
          Company car, fuel benefit, private medical insurance or other taxable benefits.
        </EstimateHelper>
        <EstimateYesNo
          value={answers.employment.taxableBenefits}
          onChange={(taxableBenefits) =>
            patch({
              employment: {
                ...answers.employment,
                taxableBenefits,
                status: 'complete',
              },
            })
          }
        />
        {answers.employment.taxableBenefits === 'yes'
          ? jobs.map((job, index) => (
              <YStack key={job.id} gap="$2">
                <SizableText fontSize={13} fontWeight="600" color={MTD_TOKENS.textMuted}>
                  {jobs.length > 1
                    ? `Benefits from ${job.employerName || `job ${index + 1}`}`
                    : 'Estimated taxable value'}
                </SizableText>
                <EstimateMoneyInput
                  value={poundsToInput(job.taxableBenefitsPounds)}
                  onChangeText={(value) =>
                    updateJob(job.id, { taxableBenefitsPounds: parsePoundsInput(value) })
                  }
                />
              </YStack>
            ))
          : null}
      </YStack>
    )
  }

  if (categoryId === 'savings') {
    if (step === 0) {
      return (
        <EstimateYesNo
          value={answers.savings.hadInterest}
          onChange={(hadInterest) =>
            patch({
              savings: {
                ...answers.savings,
                hadInterest,
                status: hadInterest === 'no' ? 'no' : 'incomplete',
              },
            })
          }
        />
      )
    }
    return (
      <YStack gap="$3">
        <EstimateMoneyInput
          value={poundsToInput(answers.savings.ukInterestPounds)}
          onChangeText={(value) =>
            patch({
              savings: {
                ...answers.savings,
                ukInterestPounds: parsePoundsInput(value),
                status: 'complete',
              },
            })
          }
        />
        <EstimateHelper>
          UK interest before tax. Foreign interest can be added below.
        </EstimateHelper>
        <EstimateMoneyInput
          value={poundsToInput(answers.savings.foreignInterestPounds)}
          onChangeText={(value) =>
            patch({
              savings: {
                ...answers.savings,
                foreignInterestPounds: parsePoundsInput(value),
                status: 'complete',
              },
            })
          }
        />
      </YStack>
    )
  }

  if (categoryId === 'investments') {
    if (step === 0) {
      return (
        <EstimateYesNo
          value={answers.investments.hadDividends}
          onChange={(hadDividends) =>
            patch({
              investments: {
                ...answers.investments,
                hadDividends,
                status: hadDividends === 'no' ? 'incomplete' : 'incomplete',
              },
            })
          }
        />
      )
    }
    if (step === 1 && answers.investments.hadDividends !== 'no') {
      return (
        <YStack gap="$3">
          <EstimateMoneyInput
            value={poundsToInput(answers.investments.ukDividendsPounds)}
            onChangeText={(value) =>
              patch({
                investments: {
                  ...answers.investments,
                  ukDividendsPounds: parsePoundsInput(value),
                },
              })
            }
          />
          <EstimateHelper>
            UK dividends. Add foreign dividends separately if you have them.
          </EstimateHelper>
          <EstimateMoneyInput
            value={poundsToInput(answers.investments.foreignDividendsPounds)}
            onChangeText={(value) =>
              patch({
                investments: {
                  ...answers.investments,
                  foreignDividendsPounds: parsePoundsInput(value),
                },
              })
            }
          />
        </YStack>
      )
    }
    return (
      <YStack gap="$3">
        <EstimateYesNo
          value={answers.investments.soldInvestments}
          onChange={(soldInvestments) =>
            patch({
              investments: {
                ...answers.investments,
                soldInvestments,
                status: 'complete',
              },
            })
          }
        />
        {answers.investments.soldInvestments === 'yes' ? (
          <MtdActionButton
            variant="secondary"
            onPress={() =>
              router.push(`${MTD_ROUTES.estimatedTax}/capitalGains` as never)
            }
          >
            Add what you sold
          </MtdActionButton>
        ) : null}
      </YStack>
    )
  }

  if (categoryId === 'property') {
    if (step === 0) {
      return (
        <YStack gap="$3">
          <EstimateYesNo
            value={answers.property.hadRental}
            onChange={(hadRental) =>
              patch({
                property: {
                  ...answers.property,
                  hadRental,
                  useExistingRecords: hadRental === 'yes' && propertyFromRecords,
                  status:
                    hadRental === 'no'
                      ? 'no'
                      : propertyFromRecords
                        ? 'complete'
                        : 'incomplete',
                },
              })
            }
          />
          {propertyFromRecords ? (
            <EstimateHelper>
              We already know about this ✓ Your rental records show about £
              {propertyProfit.toLocaleString('en-GB')}.
            </EstimateHelper>
          ) : null}
        </YStack>
      )
    }
    if (step === 1) {
      return (
        <EstimateMoneyInput
          value={poundsToInput(answers.property.grossRentalPounds)}
          onChangeText={(value) =>
            patch({
              property: {
                ...answers.property,
                grossRentalPounds: parsePoundsInput(value),
                useExistingRecords: false,
              },
            })
          }
        />
      )
    }
    return (
      <EstimateMoneyInput
        value={poundsToInput(answers.property.allowableExpensesPounds)}
        onChangeText={(value) =>
          patch({
            property: {
              ...answers.property,
              allowableExpensesPounds: parsePoundsInput(value),
              status: 'complete',
              useExistingRecords: false,
            },
          })
        }
      />
    )
  }

  if (categoryId === 'pensions') {
    if (step === 0) {
      return (
        <EstimateYesNo
          value={answers.pensions.hadPension}
          onChange={(hadPension) =>
            patch({
              pensions: {
                ...answers.pensions,
                hadPension,
                status: hadPension === 'no' ? 'no' : 'incomplete',
              },
            })
          }
        />
      )
    }
    if (step === 1) {
      const kinds = [
        { id: 'state' as const, label: 'State Pension' },
        { id: 'private' as const, label: 'Private pension' },
        { id: 'workplace' as const, label: 'Workplace pension' },
        { id: 'annuity' as const, label: 'Annuity or other pension' },
      ]
      return (
        <YStack gap="$2">
          {kinds.map((kind) => (
            <YearEndOptionRow
              key={kind.id}
              label={kind.label}
              selected={answers.pensions.kinds.includes(kind.id)}
              icon={<OptionCheck selected={answers.pensions.kinds.includes(kind.id)} />}
              onPress={() => {
                const selected = answers.pensions.kinds.includes(kind.id)
                patch({
                  pensions: {
                    ...answers.pensions,
                    kinds: selected
                      ? answers.pensions.kinds.filter((id) => id !== kind.id)
                      : [...answers.pensions.kinds, kind.id],
                  },
                })
              }}
            />
          ))}
        </YStack>
      )
    }
    return (
      <YStack gap="$3">
        <EstimateHelper>Before any tax was taken off.</EstimateHelper>
        <EstimateMoneyInput
          value={poundsToInput(answers.pensions.totalPounds)}
          onChangeText={(value) =>
            patch({
              pensions: {
                ...answers.pensions,
                totalPounds: parsePoundsInput(value),
                status: 'complete',
              },
            })
          }
        />
        <EstimateHelper>Tax already deducted, if you know it.</EstimateHelper>
        <EstimateMoneyInput
          value={poundsToInput(answers.pensions.taxDeductedPounds)}
          onChangeText={(value) =>
            patch({
              pensions: {
                ...answers.pensions,
                taxDeductedPounds: parsePoundsInput(value),
              },
            })
          }
        />
      </YStack>
    )
  }

  if (categoryId === 'family') {
    if (step === 0) {
      return (
        <EstimateYesNo
          value={answers.family.received}
          onChange={(received) =>
            patch({
              family: {
                ...answers.family,
                received,
                status: received === 'no' ? 'no' : 'incomplete',
              },
            })
          }
        />
      )
    }
    return (
      <YStack gap="$3">
        {(['you', 'partner', 'both'] as const).map((who) => (
          <YearEndOptionRow
            key={who}
            label={who === 'you' ? 'You' : who === 'partner' ? 'Your partner' : 'Both'}
            selected={answers.family.who === who}
            icon={<OptionCheck selected={answers.family.who === who} />}
            onPress={() => patch({ family: { ...answers.family, who } })}
          />
        ))}
        <EstimateHelper>Number of children</EstimateHelper>
        <EstimateMoneyInput
          prefix=""
          placeholder="0"
          value={
            answers.family.numberOfChildren ? String(answers.family.numberOfChildren) : ''
          }
          onChangeText={(value) =>
            patch({
              family: {
                ...answers.family,
                numberOfChildren: Number.parseInt(value, 10) || null,
                status: 'complete',
              },
            })
          }
        />
        <EstimateHelper>Optional: total Child Benefit received</EstimateHelper>
        <EstimateMoneyInput
          value={poundsToInput(answers.family.amountReceivedPounds)}
          onChangeText={(value) =>
            patch({
              family: {
                ...answers.family,
                amountReceivedPounds: parsePoundsInput(value),
                amountOverridden: parsePoundsInput(value) != null,
              },
            })
          }
        />
      </YStack>
    )
  }

  if (categoryId === 'studentLoan') {
    if (step === 0) {
      return (
        <EstimateYesNo
          value={answers.studentLoan.repaying}
          onChange={(repaying) =>
            patch({
              studentLoan: {
                ...answers.studentLoan,
                repaying,
                status: repaying === 'no' ? 'no' : 'incomplete',
              },
            })
          }
        />
      )
    }
    const plans = [
      { id: 'plan1' as const, label: 'Plan 1' },
      { id: 'plan2' as const, label: 'Plan 2' },
      { id: 'plan4' as const, label: 'Plan 4' },
      { id: 'plan5' as const, label: 'Plan 5' },
    ]
    return (
      <YStack gap="$2">
        {plans.map((plan) => (
          <YearEndOptionRow
            key={plan.id}
            label={plan.label}
            selected={answers.studentLoan.undergraduatePlan === plan.id}
            icon={
              <OptionCheck selected={answers.studentLoan.undergraduatePlan === plan.id} />
            }
            onPress={() =>
              patch({
                studentLoan: {
                  ...answers.studentLoan,
                  undergraduatePlan: plan.id,
                  status: 'complete',
                },
              })
            }
          />
        ))}
        <YearEndOptionRow
          label="Postgraduate loan"
          selected={answers.studentLoan.postgraduate}
          icon={<OptionCheck selected={answers.studentLoan.postgraduate} />}
          onPress={() =>
            patch({
              studentLoan: {
                ...answers.studentLoan,
                postgraduate: !answers.studentLoan.postgraduate,
                status: 'complete',
              },
            })
          }
        />
      </YStack>
    )
  }

  if (categoryId === 'reliefs') {
    if (step === 0) {
      return (
        <EstimateYesNo
          value={answers.reliefs.hadReliefs}
          onChange={(hadReliefs) =>
            patch({
              reliefs: {
                ...answers.reliefs,
                hadReliefs,
                status: hadReliefs === 'no' ? 'no' : 'incomplete',
              },
            })
          }
        />
      )
    }
    return (
      <YStack gap="$3">
        <EstimateHelper>Personal pension contributions (what you paid in)</EstimateHelper>
        <EstimateMoneyInput
          value={poundsToInput(answers.reliefs.pensionContributionPounds)}
          onChangeText={(value) =>
            patch({
              reliefs: {
                ...answers.reliefs,
                pensionContributions: parsePoundsInput(value) ? 'yes' : 'no',
                pensionContributionPounds: parsePoundsInput(value),
                pensionContributionIsNet: true,
                status: 'complete',
              },
            })
          }
        />
        <EstimateHelper>Gift Aid donations — the amount you actually gave</EstimateHelper>
        <EstimateMoneyInput
          value={poundsToInput(answers.reliefs.giftAidPounds)}
          onChangeText={(value) =>
            patch({
              reliefs: {
                ...answers.reliefs,
                giftAid: parsePoundsInput(value) ? 'yes' : 'no',
                giftAidPounds: parsePoundsInput(value),
                status: 'complete',
              },
            })
          }
        />
      </YStack>
    )
  }

  if (categoryId === 'capitalGains') {
    if (step === 0) {
      return (
        <EstimateYesNo
          value={answers.capitalGains.soldAssets}
          onChange={(soldAssets) =>
            patch({
              capitalGains: {
                ...answers.capitalGains,
                soldAssets,
                status: soldAssets === 'no' ? 'no' : 'incomplete',
              },
            })
          }
        />
      )
    }
    if (step === 1) {
      const types = [
        { id: 'property' as const, label: 'Property (not main home)' },
        { id: 'shares' as const, label: 'Shares or securities' },
        { id: 'crypto' as const, label: 'Cryptoassets' },
        { id: 'business' as const, label: 'Business assets' },
        { id: 'other' as const, label: 'Other assets' },
      ]
      return (
        <YStack gap="$2">
          {types.map((type) => (
            <YearEndOptionRow
              key={type.id}
              label={type.label}
              selected={answers.capitalGains.types.includes(type.id)}
              icon={
                <OptionCheck selected={answers.capitalGains.types.includes(type.id)} />
              }
              onPress={() => {
                const selected = answers.capitalGains.types.includes(type.id)
                patch({
                  capitalGains: {
                    ...answers.capitalGains,
                    types: selected
                      ? answers.capitalGains.types.filter((id) => id !== type.id)
                      : [...answers.capitalGains.types, type.id],
                  },
                })
              }}
            />
          ))}
        </YStack>
      )
    }
    return (
      <YStack gap="$3">
        <EstimateHelper>Sale proceeds</EstimateHelper>
        <EstimateMoneyInput
          value={poundsToInput(answers.capitalGains.proceedsPounds)}
          onChangeText={(value) =>
            patch({
              capitalGains: {
                ...answers.capitalGains,
                proceedsPounds: parsePoundsInput(value),
              },
            })
          }
        />
        <EstimateHelper>What you originally paid</EstimateHelper>
        <EstimateMoneyInput
          value={poundsToInput(answers.capitalGains.costPounds)}
          onChangeText={(value) =>
            patch({
              capitalGains: {
                ...answers.capitalGains,
                costPounds: parsePoundsInput(value),
                status: 'complete',
              },
            })
          }
        />
        <EstimateHelper>Buying and selling costs, if you know them</EstimateHelper>
        <EstimateMoneyInput
          value={poundsToInput(answers.capitalGains.incidentalCostsPounds)}
          onChangeText={(value) =>
            patch({
              capitalGains: {
                ...answers.capitalGains,
                incidentalCostsPounds: parsePoundsInput(value),
              },
            })
          }
        />
      </YStack>
    )
  }

  if (categoryId === 'foreignIncome') {
    if (step === 0) {
      return (
        <EstimateYesNo
          value={answers.foreignIncome.hadForeignIncome}
          onChange={(hadForeignIncome) =>
            patch({
              foreignIncome: {
                ...answers.foreignIncome,
                hadForeignIncome,
                status: hadForeignIncome === 'no' ? 'no' : 'incomplete',
              },
            })
          }
        />
      )
    }
    const categories = [
      { id: 'employment' as const, label: 'Employment' },
      { id: 'property' as const, label: 'Property' },
      { id: 'savings' as const, label: 'Savings interest' },
      { id: 'dividends' as const, label: 'Dividends' },
      { id: 'pension' as const, label: 'Pension' },
      { id: 'other' as const, label: 'Other' },
    ]
    return (
      <YStack gap="$3">
        {categories.map((item) => (
          <YearEndOptionRow
            key={item.id}
            label={item.label}
            selected={answers.foreignIncome.category === item.id}
            icon={<OptionCheck selected={answers.foreignIncome.category === item.id} />}
            onPress={() =>
              patch({ foreignIncome: { ...answers.foreignIncome, category: item.id } })
            }
          />
        ))}
        <EstimateMoneyInput
          value={poundsToInput(answers.foreignIncome.amountPounds)}
          onChangeText={(value) =>
            patch({
              foreignIncome: {
                ...answers.foreignIncome,
                amountPounds: parsePoundsInput(value),
                status: 'complete',
              },
            })
          }
        />
        <EstimateHelper>Foreign tax already paid, if you know it</EstimateHelper>
        <EstimateMoneyInput
          value={poundsToInput(answers.foreignIncome.foreignTaxPaidPounds)}
          onChangeText={(value) =>
            patch({
              foreignIncome: {
                ...answers.foreignIncome,
                foreignTaxPaidPounds: parsePoundsInput(value),
                status: parsePoundsInput(value) ? 'needs_review' : 'complete',
              },
            })
          }
        />
      </YStack>
    )
  }

  if (step === 0) {
    return (
      <YStack gap="$3">
        <EstimateHelper>
          Partnership income, casual income, trust income or anything else taxable.
        </EstimateHelper>
        <EstimateYesNo
          value={answers.otherIncome.hadOtherIncome}
          onChange={(hadOtherIncome) =>
            patch({
              otherIncome: {
                ...answers.otherIncome,
                hadOtherIncome,
                status: hadOtherIncome === 'no' ? 'no' : 'incomplete',
              },
            })
          }
        />
      </YStack>
    )
  }

  void onDone
  return (
    <YStack gap="$3">
      <EstimateHelper>Please describe the income or provide an estimate.</EstimateHelper>
      <Input
        value={answers.otherIncome.description}
        onChangeText={(description) =>
          patch({
            otherIncome: {
              ...answers.otherIncome,
              description,
            },
          })
        }
        placeholder="e.g. Partnership profit"
      />
      <EstimateMoneyInput
        value={poundsToInput(answers.otherIncome.amountPounds)}
        onChangeText={(value) =>
          patch({
            otherIncome: {
              ...answers.otherIncome,
              amountPounds: parsePoundsInput(value),
              status: 'complete',
            },
          })
        }
      />
    </YStack>
  )
}
