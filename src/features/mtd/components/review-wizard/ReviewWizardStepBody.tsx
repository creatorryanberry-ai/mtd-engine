import type { ReactNode } from 'react'
import { SizableText, XStack, YStack } from 'tamagui'

import { formatSubmissionAmount } from '~/features/mtd/utils/formatAmount'
import { formatMileageClaimPounds } from '~/features/mileage/utils/mileageClaim'
import { CheckIcon } from '~/interface/icons/phosphor/CheckIcon'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'

import type {
  ReviewCisVoucherSummary,
  ReviewFinancialSummary,
  ReviewManualEntrySummary,
  ReviewPrivateUseItem,
} from '~/features/submission/reviewFinancialEstimates'
import type { ReviewWizardMileageEntry } from './reviewWizardEntriesStorage'
import type { ReviewWizardChoiceAnswer } from './reviewWizardProgressStorage'
import type { ReviewWizardStepId } from './reviewWizardSteps'

import { ReviewWizardChoice } from './ReviewWizardChoice'
import { RecordedTransactionsDropdown } from './IncomeTransactionsDropdown'

export type ReviewWizardSessionEntries = {
  income: ReviewManualEntrySummary[]
  expenses: ReviewManualEntrySummary[]
  cis: ReviewCisVoucherSummary[]
  mileage: ReviewWizardMileageEntry[]
}

type AnswerListProps = {
  children: ReactNode
}

function AnswerList({ children }: AnswerListProps) {
  return (
    <YStack
      bg={MTD_TOKENS.card}
      borderWidth={1}
      borderColor={MTD_TOKENS.cardBorder}
      rounded="$4"
      overflow="hidden"
    >
      {children}
    </YStack>
  )
}

function AnswerRow({
  label,
  value,
  checked = false,
  isLast = false,
  showDivider = true,
  dense = false,
  onPress,
}: {
  label: string
  value?: string
  checked?: boolean
  isLast?: boolean
  showDivider?: boolean
  dense?: boolean
  onPress?: () => void
}) {
  return (
    <XStack
      px="$4"
      py={dense ? '$1.5' : '$3'}
      items="center"
      justify="space-between"
      gap="$3"
      borderBottomWidth={showDivider && !isLast ? 1 : 0}
      borderColor={MTD_TOKENS.cardBorder}
      cursor={onPress ? 'pointer' : undefined}
      pressStyle={onPress ? { opacity: 0.85 } : undefined}
      onPress={onPress}
    >
      <SizableText flex={1} fontSize={14} fontWeight="500" color={MTD_TOKENS.text}>
        {label}
      </SizableText>
      <XStack gap="$2" items="center" shrink={0}>
        {value ? (
          <SizableText fontSize={14} fontWeight="600" color={MTD_TOKENS.text}>
            {value}
          </SizableText>
        ) : null}
        {checked ? <CheckIcon size={16} color={MTD_TOKENS.green} /> : null}
      </XStack>
    </XStack>
  )
}

function ManualEntryList({
  items,
  onEdit,
  plain = false,
}: {
  items: ReviewManualEntrySummary[]
  onEdit?: (entry: ReviewManualEntrySummary) => void
  plain?: boolean
}) {
  const rows = items.map((item, index) => (
    <AnswerRow
      key={item.id}
      label={item.label}
      value={formatSubmissionAmount(item.amount)}
      checked
      isLast={index === items.length - 1}
      showDivider={!plain}
      dense={plain}
      onPress={onEdit ? () => onEdit(item) : undefined}
    />
  ))

  if (plain) {
    return <YStack gap={6}>{rows}</YStack>
  }

  return <AnswerList>{rows}</AnswerList>
}

function TotalRow({ label, total }: { label: string; total: number }) {
  return (
    <XStack
      px="$4"
      pt="$3"
      items="center"
      justify="space-between"
      gap="$3"
      borderTopWidth={1}
      borderColor={MTD_TOKENS.cardBorder}
    >
      <SizableText flex={1} fontSize={14} fontWeight="600" color={MTD_TOKENS.text}>
        {label}
      </SizableText>
      <XStack gap="$2" items="center" shrink={0}>
        <SizableText fontSize={14} fontWeight="700" color={MTD_TOKENS.text}>
          {formatSubmissionAmount(total)}
        </SizableText>
        <YStack width={16} />
      </XStack>
    </XStack>
  )
}

function MileageEntryList({
  items,
  onEdit,
  plain = false,
}: {
  items: ReviewWizardMileageEntry[]
  onEdit?: (entry: ReviewWizardMileageEntry) => void
  plain?: boolean
}) {
  const rows = items.map((entry, index) => (
    <AnswerRow
      key={entry.id}
      label={entry.label}
      value={`${entry.miles.toLocaleString('en-GB')} mi · ${formatMileageClaimPounds(entry.claimPounds)}`}
      checked
      isLast={index === items.length - 1}
      showDivider={!plain}
      dense={plain}
      onPress={onEdit ? () => onEdit(entry) : undefined}
    />
  ))

  if (plain) {
    return <YStack gap={6}>{rows}</YStack>
  }

  return <AnswerList>{rows}</AnswerList>
}

function CisAnswerList({
  vouchers,
  plain = false,
}: {
  vouchers: ReviewCisVoucherSummary[]
  plain?: boolean
}) {
  const rows = vouchers.map((voucher, index) => (
    <AnswerRow
      key={voucher.id}
      label={voucher.customer}
      value={formatSubmissionAmount(voucher.gross)}
      checked
      isLast={index === vouchers.length - 1}
      showDivider={!plain}
      dense={plain}
    />
  ))

  if (plain) {
    return <YStack gap={6}>{rows}</YStack>
  }

  return <AnswerList>{rows}</AnswerList>
}

function PrivateUseAnswer({ items }: { items: ReviewPrivateUseItem[] }) {
  if (items.length === 0) {
    return (
      <SizableText fontSize={13} color={MTD_TOKENS.textMuted} lineHeight={18}>
        No private use percentages set yet. Add them when you categorise shared expenses.
      </SizableText>
    )
  }

  return (
    <AnswerList>
      {items.map((item, index) => (
        <AnswerRow
          key={`${item.label}-${item.percent}`}
          label={item.label}
          value={`${item.percent}% private`}
          isLast={index === items.length - 1}
        />
      ))}
    </AnswerList>
  )
}

function ReadySummary({
  summary,
  estimatedTax,
}: {
  summary: ReviewFinancialSummary
  estimatedTax: number | null
}) {
  const rows = [
    { key: 'income', label: 'Income', value: summary.income },
    { key: 'expenses', label: 'Expenses', value: summary.expenses },
    { key: 'profit', label: 'Estimated profit', value: summary.profit },
    ...(estimatedTax != null
      ? [{ key: 'tax', label: 'Estimated tax', value: estimatedTax }]
      : []),
  ]

  return (
    <AnswerList>
      {rows.map((row, index) => (
        <AnswerRow
          key={row.key}
          label={row.label}
          value={formatSubmissionAmount(row.value)}
          isLast={index === rows.length - 1}
        />
      ))}
    </AnswerList>
  )
}

type ReviewWizardStepBodyProps = {
  stepId: ReviewWizardStepId
  summary: ReviewFinancialSummary
  wizardEntries: ReviewWizardSessionEntries
  estimatedTax: number | null
  selectedAnswer: ReviewWizardChoiceAnswer | null
  onNo: () => void
  onAddIncome: () => void
  onAddExpense: () => void
  onEditIncome: (entry: ReviewManualEntrySummary) => void
  onEditExpense: (entry: ReviewManualEntrySummary) => void
  onAddCis: () => void
  onAddMileage: () => void
  onEditMileage: (entry: ReviewWizardMileageEntry) => void
  onChangePrivateUse: () => void
}

export function ReviewWizardStepBody({
  stepId,
  summary,
  wizardEntries,
  estimatedTax,
  selectedAnswer,
  onNo,
  onAddIncome,
  onAddExpense,
  onEditIncome,
  onEditExpense,
  onAddCis,
  onAddMileage,
  onEditMileage,
  onChangePrivateUse,
}: ReviewWizardStepBodyProps) {
  switch (stepId) {
    case 'income': {
      const hasEntries = wizardEntries.income.length > 0
      const wizardIncomeIds = new Set(wizardEntries.income.map((entry) => entry.id))
      const cisIds = new Set(summary.cisVouchers.map((voucher) => voucher.id))
      const accountIncomeTransactions = summary.incomeTransactions.filter(
        (transaction) =>
          !wizardIncomeIds.has(transaction.id) && !cisIds.has(transaction.id),
      )
      return (
        <YStack gap="$4">
          <YStack>
            <RecordedTransactionsDropdown
              transactions={accountIncomeTransactions}
              emptyMessage="No income transactions recorded for this period yet."
            />
            {hasEntries ? (
              <YStack>
                <YStack my={10}>
                  <ManualEntryList
                    plain
                    items={wizardEntries.income}
                    onEdit={onEditIncome}
                  />
                </YStack>
                <TotalRow
                  label="Total income"
                  total={
                    accountIncomeTransactions.reduce(
                      (sum, entry) => sum + entry.amount,
                      0,
                    ) + wizardEntries.income.reduce((sum, entry) => sum + entry.amount, 0)
                  }
                />
              </YStack>
            ) : null}
          </YStack>
          <XStack gap="$3">
            <YStack flex={1}>
              <ReviewWizardChoice
                label="No"
                selected={selectedAnswer === 'no'}
                onPress={onNo}
              />
            </YStack>
            <YStack flex={2.5}>
              <ReviewWizardChoice
                label={hasEntries ? 'Yes, add more income' : 'Yes, add income'}
                selected={selectedAnswer === 'yes'}
                onPress={onAddIncome}
              />
            </YStack>
          </XStack>
        </YStack>
      )
    }
    case 'expenses': {
      const hasEntries = wizardEntries.expenses.length > 0
      const wizardExpenseIds = new Set(wizardEntries.expenses.map((entry) => entry.id))
      const accountExpenseTransactions = (summary.expenseTransactions ?? []).filter(
        (transaction) => !wizardExpenseIds.has(transaction.id),
      )
      return (
        <YStack gap="$4">
          <YStack>
            <RecordedTransactionsDropdown
              transactions={accountExpenseTransactions}
              emptyMessage="No expense transactions recorded for this period yet."
            />
            {hasEntries ? (
              <YStack>
                <YStack my={10}>
                  <ManualEntryList
                    plain
                    items={wizardEntries.expenses}
                    onEdit={onEditExpense}
                  />
                </YStack>
                <TotalRow
                  label="Total expenses"
                  total={
                    accountExpenseTransactions.reduce(
                      (sum, entry) => sum + entry.amount,
                      0,
                    ) +
                    wizardEntries.expenses.reduce((sum, entry) => sum + entry.amount, 0)
                  }
                />
              </YStack>
            ) : null}
          </YStack>
          <XStack gap="$3">
            <YStack flex={1}>
              <ReviewWizardChoice
                label="No"
                selected={selectedAnswer === 'no'}
                onPress={onNo}
              />
            </YStack>
            <YStack flex={2.5}>
              <ReviewWizardChoice
                label={hasEntries ? 'Yes, add more expense' : 'Yes, add expense'}
                selected={selectedAnswer === 'yes'}
                onPress={onAddExpense}
              />
            </YStack>
          </XStack>
        </YStack>
      )
    }
    case 'cis': {
      const hasEntries = wizardEntries.cis.length > 0
      const wizardCisIds = new Set(wizardEntries.cis.map((entry) => entry.id))
      const recordedVouchers = summary.cisVouchers.filter(
        (voucher) => !wizardCisIds.has(voucher.id),
      )
      const recordedTransactions = recordedVouchers.map((voucher) => ({
        id: voucher.id,
        label: voucher.customer,
        accountLabel: `Tax deducted ${formatSubmissionAmount(voucher.tax)}`,
        amount: voucher.gross,
      }))
      return (
        <YStack gap="$4">
          <YStack>
            <RecordedTransactionsDropdown
              transactions={recordedTransactions}
              emptyMessage="No CIS vouchers recorded for this period yet."
            />
            {hasEntries ? (
              <YStack>
                <YStack my={10}>
                  <CisAnswerList plain vouchers={wizardEntries.cis} />
                </YStack>
                <TotalRow
                  label="Total CIS"
                  total={
                    recordedVouchers.reduce((sum, entry) => sum + entry.gross, 0) +
                    wizardEntries.cis.reduce((sum, entry) => sum + entry.gross, 0)
                  }
                />
              </YStack>
            ) : null}
          </YStack>
          <XStack gap="$3">
            <YStack flex={1}>
              <ReviewWizardChoice
                label="No"
                selected={selectedAnswer === 'no'}
                onPress={onNo}
              />
            </YStack>
            <YStack flex={2.5}>
              <ReviewWizardChoice
                label={hasEntries ? 'Add another CIS voucher' : 'Add CIS voucher'}
                selected={selectedAnswer === 'yes'}
                onPress={onAddCis}
              />
            </YStack>
          </XStack>
        </YStack>
      )
    }
    case 'mileage': {
      const hasEntries = wizardEntries.mileage.length > 0
      const wizardMileageIds = new Set(wizardEntries.mileage.map((entry) => entry.id))
      const recordedMileage = (summary.mileageTransactions ?? []).filter(
        (transaction) => !wizardMileageIds.has(transaction.id),
      )
      return (
        <YStack gap="$4">
          <YStack>
            <RecordedTransactionsDropdown
              transactions={recordedMileage}
              emptyMessage="No mileage recorded for this period yet."
            />
            {hasEntries ? (
              <YStack>
                <YStack my={10}>
                  <MileageEntryList
                    plain
                    items={wizardEntries.mileage}
                    onEdit={onEditMileage}
                  />
                </YStack>
                <TotalRow
                  label="Total mileage"
                  total={
                    recordedMileage.reduce((sum, entry) => sum + entry.amount, 0) +
                    wizardEntries.mileage.reduce(
                      (sum, entry) => sum + entry.claimPounds,
                      0,
                    )
                  }
                />
              </YStack>
            ) : null}
          </YStack>
          <XStack gap="$3">
            <YStack flex={1}>
              <ReviewWizardChoice
                label="No"
                selected={selectedAnswer === 'no'}
                onPress={onNo}
              />
            </YStack>
            <YStack flex={2.5}>
              <ReviewWizardChoice
                label={hasEntries ? 'Yes, add more mileage' : 'Yes, add mileage'}
                selected={selectedAnswer === 'yes'}
                onPress={onAddMileage}
              />
            </YStack>
          </XStack>
        </YStack>
      )
    }
    case 'private-use':
      return (
        <YStack gap="$4">
          <PrivateUseAnswer items={summary.privateUseItems} />
          <XStack gap="$3">
            <YStack flex={2.5}>
              <ReviewWizardChoice
                label="Everything looks right"
                selected={selectedAnswer === 'no'}
                onPress={onNo}
              />
            </YStack>
            <YStack flex={1}>
              <ReviewWizardChoice
                label="Change"
                selected={selectedAnswer === 'yes'}
                onPress={onChangePrivateUse}
              />
            </YStack>
          </XStack>
        </YStack>
      )
    case 'ready':
      return (
        <YStack gap="$4">
          <ReadySummary summary={summary} estimatedTax={estimatedTax} />
        </YStack>
      )
  }
}
