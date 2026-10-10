import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { router, useFocusEffect, type Href } from 'one'
import { Spinner, SizableText, XStack, YStack } from 'tamagui'

import { useAuth } from '~/features/auth/client/authClient'
import { useBusinessSettings } from '~/features/business/useBusinessSettings'
import { useHmrcConnection } from '~/features/hmrc/client/useHmrcConnection'
import { useHmrcTaxEstimate } from '~/features/hmrc/client/useHmrcTaxEstimate'
import { MileageEditScreen } from '~/features/mileage/components/MileageEditScreen'
import {
  useMileageEntries,
  type MileageEntryDto,
} from '~/features/mileage/client/useMileageEntries'
import { MTD_ROUTES } from '~/features/mtd/constants'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { useSubmissionPeriod } from '~/features/mtd/context/TaxYearProvider'
import { formatDisplayTaxYear } from '~/features/mtd/utils/quarterPeriods'
import { useMtdAccountTransactions } from '~/features/bankAccounts/client/useMtdAccountTransactions'
import { useMtdBankAccounts } from '~/features/bankAccounts/client/useMtdBankAccounts'
import { SYSTEM_ACCOUNT_IDS } from '~/features/bankAccounts/defaultBankAccounts'
import { authFetch } from '~/features/auth/client/authFetch'
import { useReviewFinancialSummary } from '~/features/submission/client/useReviewFinancialSummary'
import { useMtdSubmissionStatus } from '~/features/submission/client/useMtdSubmissionStatus'
import { showToast } from '~/interface/toast/helpers'
import { CheckIcon } from '~/interface/icons/phosphor/CheckIcon'

import type { TransactionEditCategoryId } from '~/features/mtd/categories/transactionEditCategories'
import type { MtdTransactionDto } from '~/features/bankAccounts/types'
import type { BankTransactionsResponse } from '~/features/bankAccounts/server/transactionsService'
import type { ReviewManualEntrySummary } from '~/features/submission/reviewFinancialEstimates'

import { CisVoucherEditScreen } from '../CisVoucherEditScreen'
import { ManualTransactionEditScreen } from '../ManualTransactionEditScreen'
import { ReviewWizardNav } from './ReviewWizardNav'
import { ReviewWizardStepBody } from './ReviewWizardStepBody'
import {
  addReviewWizardCis,
  addReviewWizardExpense,
  addReviewWizardIncome,
  addReviewWizardMileage,
  loadReviewWizardEntries,
  removeReviewWizardExpense,
  removeReviewWizardIncome,
  removeReviewWizardMileage,
  type ReviewWizardMileageEntry,
  type ReviewWizardStoredEntries,
} from './reviewWizardEntriesStorage'
import {
  loadReviewWizardProgress,
  markAllReviewWizardStepsAnswered,
  markReviewWizardStepAnswered,
  type ReviewWizardChoiceAnswer,
} from './reviewWizardProgressStorage'
import {
  getFirstUnansweredReviewStepIndex,
  getReviewWizardQuestion,
  getReviewWizardSteps,
  type ReviewWizardStepId,
} from './reviewWizardSteps'

type EditorState =
  | null
  | {
      type: 'manual'
      category: TransactionEditCategoryId
      transaction?: MtdTransactionDto | null
    }
  | { type: 'cis' }
  | { type: 'mileage'; entry?: MileageEntryDto | null }

function findSystemAccountId(
  accounts: { id: string; externalAccountId: string }[],
  externalAccountId: string,
) {
  return (
    accounts.find((account) => account.externalAccountId === externalAccountId)?.id ??
    null
  )
}

export function ReviewWizard() {
  const auth = useAuth()
  const userId = auth?.user?.id
  const { taxYearStart, quarterId } = useSubmissionPeriod()
  const { summary, isLoading, error, refresh } = useReviewFinancialSummary()
  const { summary: quarterSummary } = useMtdSubmissionStatus()
  const isSubmitted = Boolean(quarterSummary?.existingSubmission)
  const { settings } = useBusinessSettings()
  const { accounts } = useMtdBankAccounts()
  const { status: hmrcStatus } = useHmrcConnection()
  const { estimate: hmrcEstimate } = useHmrcTaxEstimate(
    hmrcStatus.configured && hmrcStatus.connected,
  )
  const { entries: mileageEntries, refresh: refreshMileage } = useMileageEntries()

  const [stepIndex, setStepIndex] = useState(0)
  const [editor, setEditor] = useState<EditorState>(null)
  const [wizardEntries, setWizardEntries] = useState<ReviewWizardStoredEntries>({
    income: [],
    expenses: [],
    cis: [],
    mileage: [],
  })
  const [answeredStepIds, setAnsweredStepIds] = useState<ReviewWizardStepId[]>(() =>
    userId
      ? loadReviewWizardProgress(userId, taxYearStart, quarterId).answeredStepIds
      : [],
  )
  const [stepAnswers, setStepAnswers] = useState<
    Partial<Record<ReviewWizardStepId, ReviewWizardChoiceAnswer>>
  >(() =>
    userId ? loadReviewWizardProgress(userId, taxYearStart, quarterId).stepAnswers : {},
  )

  const manualAccountId = useMemo(
    () => findSystemAccountId(accounts, SYSTEM_ACCOUNT_IDS.manualEntry),
    [accounts],
  )
  const cisAccountId = useMemo(
    () => findSystemAccountId(accounts, SYSTEM_ACCOUNT_IDS.cis),
    [accounts],
  )

  const { transactions: cisTransactions } = useMtdAccountTransactions(
    cisAccountId ?? '',
    {
      mode: 'single',
      limit: 100,
      enabled: Boolean(cisAccountId && editor?.type === 'cis'),
    },
  )

  const { transactions: manualTransactions, refresh: refreshManualTransactions } =
    useMtdAccountTransactions(manualAccountId ?? '', {
      mode: 'single',
      limit: 10000,
      enabled: Boolean(manualAccountId),
    })

  useEffect(() => {
    if (!userId) {
      setAnsweredStepIds([])
      setStepAnswers({})
      return
    }
    setWizardEntries(loadReviewWizardEntries(userId, taxYearStart, quarterId))

    const stepIds = getReviewWizardSteps({
      showCisStep: settings?.cisRegistered === true,
      showMileageStep: settings?.vehicleClaimMethod === 'mileage',
    }).map((step) => step.id)

    const progress = isSubmitted
      ? markAllReviewWizardStepsAnswered(userId, taxYearStart, quarterId, stepIds)
      : loadReviewWizardProgress(userId, taxYearStart, quarterId)

    setAnsweredStepIds(progress.answeredStepIds)
    setStepAnswers(progress.stepAnswers)
  }, [
    isSubmitted,
    quarterId,
    settings?.cisRegistered,
    settings?.vehicleClaimMethod,
    taxYearStart,
    userId,
  ])

  const closeEditor = useCallback(() => {
    setEditor(null)
    void refresh({ silent: true })
    void refreshManualTransactions()
  }, [refresh, refreshManualTransactions])

  const closeEditorRef = useRef(closeEditor)
  closeEditorRef.current = closeEditor
  const handleEditorClose = useCallback(() => {
    closeEditorRef.current()
  }, [])

  const findManualTransaction = useCallback(
    (entryId: string) =>
      manualTransactions.find((transaction) => transaction.id === entryId) ?? null,
    [manualTransactions],
  )

  const fetchManualTransactionById = useCallback(
    async (entryId: string, accountId: string) => {
      const scoped = await authFetch<BankTransactionsResponse>(
        `/api/transactions/search?limit=10000&bankAccountId=${encodeURIComponent(accountId)}`,
      )
      const scopedMatch =
        scoped.data?.transactions.find((row) => row.id === entryId) ?? null
      if (scopedMatch) return scopedMatch

      // fallback: id may exist on another account or outside the scoped page
      const all = await authFetch<BankTransactionsResponse>(
        `/api/transactions/search?limit=10000`,
      )
      return all.data?.transactions.find((row) => row.id === entryId) ?? null
    },
    [],
  )

  const openManualEdit = useCallback(
    async (category: TransactionEditCategoryId, entry: ReviewManualEntrySummary) => {
      if (!manualAccountId) {
        router.push(MTD_ROUTES.bankAccounts as Href)
        return
      }

      if (!entry.id?.trim()) {
        if (userId) {
          setWizardEntries(
            category === 'income'
              ? removeReviewWizardIncome(userId, taxYearStart, quarterId, entry.id)
              : removeReviewWizardExpense(userId, taxYearStart, quarterId, entry.id),
          )
        }
        showToast('Removed invalid entry', {
          type: 'warn',
          message: 'That review item had no transaction id.',
        })
        return
      }

      let transaction = findManualTransaction(entry.id)
      if (!transaction) {
        try {
          transaction = await fetchManualTransactionById(entry.id, manualAccountId)
        } catch (fetchError) {
          console.info('[review-wizard] failed to load transaction', fetchError)
          showToast('Could not open entry', {
            type: 'error',
            message: 'Failed to load the transaction. Try again.',
          })
          return
        }
      }

      if (!transaction) {
        if (userId) {
          setWizardEntries(
            category === 'income'
              ? removeReviewWizardIncome(userId, taxYearStart, quarterId, entry.id)
              : removeReviewWizardExpense(userId, taxYearStart, quarterId, entry.id),
          )
        }
        showToast('Removed missing entry', {
          type: 'warn',
          message: `"${entry.label}" is no longer in your transactions.`,
        })
        return
      }

      // defer past the opening click so mouseup can't hit Cancel
      setTimeout(() => {
        setEditor({
          type: 'manual',
          category,
          transaction,
        })
      }, 0)
    },
    [
      fetchManualTransactionById,
      findManualTransaction,
      manualAccountId,
      quarterId,
      taxYearStart,
      userId,
    ],
  )

  const showCisStep = summary?.showCisStep ?? settings?.cisRegistered === true
  const showMileageStep =
    summary?.showMileageStep ?? settings?.vehicleClaimMethod === 'mileage'

  const steps = useMemo(
    () =>
      getReviewWizardSteps({
        showCisStep,
        showMileageStep,
      }),
    [showCisStep, showMileageStep],
  )

  const jumpToFirstUnanswered = useCallback(() => {
    if (!userId) {
      setAnsweredStepIds([])
      setStepAnswers({})
      setStepIndex(0)
      return
    }

    const stepIds = getReviewWizardSteps({
      showCisStep,
      showMileageStep,
    }).map((step) => step.id)

    const progress = isSubmitted
      ? markAllReviewWizardStepsAnswered(userId, taxYearStart, quarterId, stepIds)
      : loadReviewWizardProgress(userId, taxYearStart, quarterId)

    setAnsweredStepIds(progress.answeredStepIds)
    setStepAnswers(progress.stepAnswers)
    setStepIndex(
      getFirstUnansweredReviewStepIndex({
        showCisStep,
        showMileageStep,
        answeredStepIds: progress.answeredStepIds,
      }),
    )
  }, [isSubmitted, quarterId, showCisStep, showMileageStep, taxYearStart, userId])

  useFocusEffect(() => {
    jumpToFirstUnanswered()
  }, [jumpToFirstUnanswered])

  useEffect(() => {
    if (isSubmitted) {
      jumpToFirstUnanswered()
    }
  }, [isSubmitted, jumpToFirstUnanswered])

  useEffect(() => {
    if (stepIndex >= steps.length) {
      setStepIndex(Math.max(0, steps.length - 1))
    }
  }, [stepIndex, steps.length])

  const currentStep = steps[stepIndex] ?? steps[0]
  const isLastStep = stepIndex >= steps.length - 1
  const question = currentStep
    ? getReviewWizardQuestion(currentStep, {
        hasManualIncome: wizardEntries.income.length > 0,
        hasManualExpenses: wizardEntries.expenses.length > 0,
        hasWizardMileage: wizardEntries.mileage.length > 0,
      })
    : ''

  const hmrcIncomeTax = hmrcEstimate?.incomeTaxAmount
  const hmrcTotal = hmrcEstimate?.totalIncomeTaxAndNicsDue
  const estimatedTax =
    hmrcIncomeTax != null
      ? hmrcIncomeTax
      : hmrcTotal != null
        ? hmrcTotal
        : summary && summary.profit > 0
          ? summary.estimatedTax
          : null

  const currentStepId = currentStep?.id
  const currentStepAnswered = Boolean(
    currentStepId && answeredStepIds.includes(currentStepId),
  )
  const selectedAnswer = useMemo((): ReviewWizardChoiceAnswer | null => {
    if (!currentStepId) return null
    const stored = stepAnswers[currentStepId]
    if (stored) return stored
    if (!currentStepAnswered) return null

    // older progress only stored answered ids — infer from wizard entries
    switch (currentStepId) {
      case 'income':
        return wizardEntries.income.length > 0 ? 'yes' : 'no'
      case 'expenses':
        return wizardEntries.expenses.length > 0 ? 'yes' : 'no'
      case 'cis':
        return wizardEntries.cis.length > 0 ? 'yes' : 'no'
      case 'mileage':
        return wizardEntries.mileage.length > 0 ? 'yes' : 'no'
      case 'private-use':
        return 'no'
      default:
        return null
    }
  }, [currentStepAnswered, currentStepId, stepAnswers, wizardEntries])
  const canGoNext = currentStepId === 'ready' || currentStepAnswered

  const markCurrentStepAnswered = useCallback(
    (answer?: ReviewWizardChoiceAnswer) => {
      if (!userId || !currentStepId) return
      const next = markReviewWizardStepAnswered(
        userId,
        taxYearStart,
        quarterId,
        currentStepId,
        answer,
      )
      setAnsweredStepIds(next.answeredStepIds)
      setStepAnswers(next.stepAnswers)
    },
    [currentStepId, quarterId, taxYearStart, userId],
  )

  const goNext = useCallback(() => {
    if (!canGoNext) return
    if (isLastStep) {
      router.push(MTD_ROUTES.submitToHmrc as Href)
      return
    }
    setStepIndex((prev) => Math.min(prev + 1, steps.length - 1))
  }, [canGoNext, isLastStep, steps.length])

  const goPrev = useCallback(() => {
    setStepIndex((prev) => Math.max(prev - 1, 0))
  }, [])

  const answerNo = useCallback(() => {
    markCurrentStepAnswered('no')
  }, [markCurrentStepAnswered])

  const answerYesAnd = useCallback(
    (action: () => void) => {
      markCurrentStepAnswered('yes')
      action()
    },
    [markCurrentStepAnswered],
  )

  if (isLoading && !summary) {
    return (
      <YStack py="$8" items="center" gap="$2">
        <Spinner size="large" color={MTD_TOKENS.orange} />
        <SizableText fontSize={13} color={MTD_TOKENS.textMuted}>
          Loading review…
        </SizableText>
      </YStack>
    )
  }

  if (error && !summary) {
    return (
      <SizableText fontSize={14} color={MTD_TOKENS.textMuted}>
        {error}
      </SizableText>
    )
  }

  if (!summary || !currentStep) {
    return null
  }

  return (
    <>
      <YStack flex={1}>
        <YStack gap="$5">
          <YStack gap="$2">
            <XStack items="center" justify="space-between" gap="$3">
              <SizableText
                flex={1}
                fontSize={15}
                fontWeight="600"
                color={MTD_TOKENS.orange}
                letterSpacing={1}
              >
                REVIEW · {quarterId} · {formatDisplayTaxYear(taxYearStart)} ·{' '}
                {stepIndex + 1} OF {steps.length}
              </SizableText>
              <YStack
                width={24}
                height={24}
                rounded="$10"
                borderWidth={2}
                borderColor={MTD_TOKENS.orange}
                bg={currentStepAnswered ? MTD_TOKENS.orange : 'transparent'}
                items="center"
                justify="center"
                shrink={0}
                accessibilityLabel={
                  currentStepAnswered ? 'Question answered' : 'Question not answered'
                }
              >
                {currentStepAnswered ? (
                  <CheckIcon size={14} color={MTD_TOKENS.onOrange} />
                ) : null}
              </YStack>
            </XStack>
            <SizableText
              fontSize={24}
              fontWeight="700"
              color={MTD_TOKENS.text}
              letterSpacing={-0.4}
              lineHeight={32}
              $lg={{ fontSize: 28, lineHeight: 36 }}
            >
              {question}
            </SizableText>
          </YStack>

          <ReviewWizardStepBody
            stepId={currentStep.id}
            summary={summary}
            wizardEntries={wizardEntries}
            estimatedTax={estimatedTax}
            selectedAnswer={selectedAnswer}
            onNo={answerNo}
            onAddIncome={() => {
              answerYesAnd(() => {
                if (!manualAccountId) {
                  router.push(MTD_ROUTES.bankAccounts as Href)
                  return
                }
                setEditor({ type: 'manual', category: 'income', transaction: null })
              })
            }}
            onAddExpense={() => {
              answerYesAnd(() => {
                if (!manualAccountId) {
                  router.push(MTD_ROUTES.bankAccounts as Href)
                  return
                }
                setEditor({
                  type: 'manual',
                  category: 'business_expense',
                  transaction: null,
                })
              })
            }}
            onEditIncome={(entry) => {
              void openManualEdit('income', entry)
            }}
            onEditExpense={(entry) => {
              void openManualEdit('business_expense', entry)
            }}
            onAddCis={() => {
              answerYesAnd(() => {
                if (!cisAccountId) {
                  router.push(MTD_ROUTES.bankAccounts as Href)
                  return
                }
                setEditor({ type: 'cis' })
              })
            }}
            onAddMileage={() =>
              answerYesAnd(() => setEditor({ type: 'mileage', entry: null }))
            }
            onEditMileage={(entry: ReviewWizardMileageEntry) => {
              const full = mileageEntries.find((row) => row.id === entry.id) ?? null
              if (!full) {
                if (userId) {
                  setWizardEntries(
                    removeReviewWizardMileage(userId, taxYearStart, quarterId, entry.id),
                  )
                }
                showToast('Removed missing entry', {
                  type: 'warn',
                  message: `"${entry.label}" is no longer in your mileage recorder.`,
                })
                return
              }
              setTimeout(() => {
                setEditor({ type: 'mileage', entry: full })
              }, 0)
            }}
            onChangePrivateUse={() => {
              answerYesAnd(() => {
                router.push(MTD_ROUTES.bankAccounts as Href)
              })
            }}
          />
        </YStack>

        <ReviewWizardNav
          canGoPrev={stepIndex > 0}
          canGoNext={canGoNext}
          isLastStep={isLastStep}
          onPrev={goPrev}
          onNext={goNext}
        />
      </YStack>

      {editor?.type === 'manual' && manualAccountId ? (
        <ManualTransactionEditScreen
          key={
            editor.transaction
              ? `manual-edit-${editor.transaction.id}`
              : `manual-create-${editor.category}`
          }
          bankAccountId={manualAccountId}
          transaction={editor.transaction ?? null}
          initialCategory={editor.transaction ? null : editor.category}
          allowedCategoryIds={
            editor.category === 'income'
              ? ['income']
              : editor.category === 'business_expense'
                ? ['business_expense']
                : undefined
          }
          onClose={handleEditorClose}
          onSaved={(entry) => {
            if (!userId) return
            if (editor.category === 'income') {
              setWizardEntries(
                addReviewWizardIncome(userId, taxYearStart, quarterId, entry),
              )
            } else if (editor.category === 'business_expense') {
              setWizardEntries(
                addReviewWizardExpense(userId, taxYearStart, quarterId, entry),
              )
            }
          }}
          onDeleted={(transactionId) => {
            if (!userId) return
            if (editor.category === 'income') {
              setWizardEntries(
                removeReviewWizardIncome(userId, taxYearStart, quarterId, transactionId),
              )
            } else if (editor.category === 'business_expense') {
              setWizardEntries(
                removeReviewWizardExpense(userId, taxYearStart, quarterId, transactionId),
              )
            }
          }}
        />
      ) : null}

      {editor?.type === 'cis' && cisAccountId ? (
        <CisVoucherEditScreen
          key="cis-create"
          bankAccountId={cisAccountId}
          transaction={null}
          accountTransactions={cisTransactions}
          onClose={handleEditorClose}
          onSaved={(entry) => {
            if (!userId) return
            setWizardEntries(addReviewWizardCis(userId, taxYearStart, quarterId, entry))
          }}
        />
      ) : null}

      {editor?.type === 'mileage' ? (
        <MileageEditScreen
          key={editor.entry ? `mileage-edit-${editor.entry.id}` : 'mileage-create'}
          entry={editor.entry ?? null}
          existingEntries={mileageEntries}
          onClose={handleEditorClose}
          onSaved={(entry) => {
            void refreshMileage()
            if (!userId || !entry) return
            setWizardEntries(
              addReviewWizardMileage(userId, taxYearStart, quarterId, {
                id: entry.id,
                label: entry.journeyDetails,
                miles: entry.miles,
                claimPounds: entry.claimPounds,
              }),
            )
          }}
          onDeleted={() => {
            if (!userId || !editor.entry) return
            setWizardEntries(
              removeReviewWizardMileage(userId, taxYearStart, quarterId, editor.entry.id),
            )
          }}
        />
      ) : null}
    </>
  )
}
