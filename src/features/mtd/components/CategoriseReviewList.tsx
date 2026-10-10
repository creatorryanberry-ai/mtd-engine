import { useState } from 'react'
import { SizableText, Spinner, XStack, YStack } from 'tamagui'

import { MTD_TOKENS } from '../mtdTokens'
import {
  formatPrivateUseLabel,
  getEffectivePrivateUsePercent,
} from '../categories/transactionEditCategories'
import { persistTransactionRuleDrafts } from '../utils/persistTransactionRuleDrafts'
import { CheckCircleIcon } from '~/interface/icons/phosphor/CheckCircleIcon'
import { CaretDownIcon } from '~/interface/icons/phosphor/CaretDownIcon'
import { DotsThreeVerticalIcon } from '~/interface/icons/phosphor/DotsThreeVerticalIcon'
import { SquareIcon } from '~/interface/icons/phosphor/SquareIcon'
import { MtdGroupedTransactionRow } from './MtdTransactionRowDetails'
import { TransactionEditScreen } from './TransactionEditScreen'
import type { TransactionEditAcceptInput } from '~/features/mtd/utils/persistTransactionRuleDrafts'
import { usePersistTransactionRuleDrafts } from './TransactionEditTitlePanel'
import { groupTransactionsByDisplayName } from '../utils/formatTransactionDisplay'

import type { MtdTransactionDto } from '~/features/bankAccounts/types'
import type { MtdTransactionGroup } from '../utils/formatTransactionDisplay'
import type { TransactionSort } from '~/features/categorisation/client/useMtdCategorise'

function CategoryPill({
  category,
  isIncome,
  onPress,
}: {
  category: string
  isIncome: boolean
  onPress: () => void
}) {
  const color = isIncome ? MTD_TOKENS.green : MTD_TOKENS.orange
  return (
    <XStack
      bg={MTD_TOKENS.cardInset}
      borderWidth={1}
      borderColor={MTD_TOKENS.cardBorder}
      rounded="$10"
      px="$2.5"
      py="$1.5"
      gap="$1"
      items="center"
      shrink={0}
      cursor="pointer"
      pressStyle={{ opacity: 0.85 }}
      onPress={onPress}
    >
      <SizableText fontSize={11} fontWeight="500" color={color}>
        {category}
      </SizableText>
      <CaretDownIcon size={12} color={MTD_TOKENS.textSubtle} />
    </XStack>
  )
}

function ReviewTransactionGroupRow({
  group,
  isSelected,
  onToggleSelected,
  onEditGroup,
}: {
  group: MtdTransactionGroup
  isSelected: boolean
  onToggleSelected: (transactionId: string) => void
  onEditGroup: (group: MtdTransactionGroup) => void
}) {
  const { transactions } = group
  const lead = transactions[0]
  if (!lead) return null

  const isCredit = lead.amount > 0
  const privateUsePercent = getEffectivePrivateUsePercent(lead)

  return (
    <MtdGroupedTransactionRow
      transactions={transactions}
      avatarSize={36}
      avatarFontSize={11}
      contentInsetX="$3"
      onPress={() => onEditGroup(group)}
      leading={
        <YStack
          cursor="pointer"
          pressStyle={{ opacity: 0.8 }}
          onPress={() => onToggleSelected(lead.id)}
        >
          {isSelected ? (
            <CheckCircleIcon size={20} color={MTD_TOKENS.orange} />
          ) : (
            <SquareIcon size={20} color={MTD_TOKENS.textSubtle} />
          )}
        </YStack>
      }
      trailing={
        <XStack gap="$2" items="flex-start" shrink={0}>
          <YStack gap="$1" items="flex-end" pt="$0.5">
            <CategoryPill
              category={lead.category}
              isIncome={isCredit}
              onPress={() => onEditGroup(group)}
            />
            {privateUsePercent != null ? (
              <SizableText fontSize={11} fontWeight="400" color={MTD_TOKENS.textMuted}>
                {formatPrivateUseLabel(privateUsePercent)}
              </SizableText>
            ) : null}
          </YStack>

          <YStack pt="$0.5">
            <DotsThreeVerticalIcon size={18} color={MTD_TOKENS.textSubtle} />
          </YStack>
        </XStack>
      }
    />
  )
}

type CategoriseReviewListProps = {
  transactions: MtdTransactionDto[]
  total: number
  page: number
  totalPages: number
  pageSize: number
  sort: TransactionSort
  isLoading: boolean
  toReview: number
  selectedIds: Set<string>
  allVisibleSelected: boolean
  onSortChange: (sort: TransactionSort) => void
  onPageChange: (page: number) => void
  onToggleRowSelected: (transactionId: string) => void
  onToggleAllVisibleSelected: () => void
  onAcceptEditedTransactions: (input: {
    hmrcCategory: string
    transactionIds: string[]
  }) => Promise<void>
}

export function CategoriseReviewList({
  transactions,
  total,
  page,
  totalPages,
  pageSize,
  sort,
  isLoading,
  toReview,
  selectedIds,
  allVisibleSelected,
  onSortChange,
  onPageChange,
  onToggleRowSelected,
  onToggleAllVisibleSelected,
  onAcceptEditedTransactions,
}: CategoriseReviewListProps) {
  const [editingGroup, setEditingGroup] = useState<MtdTransactionGroup | null>(null)
  const persistRuleDrafts = usePersistTransactionRuleDrafts()

  const sortLabel = sort === 'newest' ? 'Newest' : 'Oldest'
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  return (
    <YStack gap="$3">
      <XStack items="center" justify="space-between" gap="$2" flexWrap="wrap">
        <XStack items="center" gap="$2">
          <YStack
            cursor="pointer"
            pressStyle={{ opacity: 0.8 }}
            onPress={onToggleAllVisibleSelected}
          >
            {allVisibleSelected ? (
              <CheckCircleIcon size={20} color={MTD_TOKENS.orange} />
            ) : (
              <SquareIcon size={20} color={MTD_TOKENS.textSubtle} />
            )}
          </YStack>
          <SizableText fontSize={13} color={MTD_TOKENS.textMuted}>
            {toReview} transactions to review
          </SizableText>
        </XStack>
        <XStack
          items="center"
          gap="$1"
          cursor="pointer"
          pressStyle={{ opacity: 0.8 }}
          onPress={() => onSortChange(sort === 'newest' ? 'oldest' : 'newest')}
        >
          <SizableText fontSize={13} color={MTD_TOKENS.textMuted}>
            Sort: {sortLabel}
          </SizableText>
          <CaretDownIcon size={14} color={MTD_TOKENS.textSubtle} />
        </XStack>
      </XStack>

      {isLoading ? (
        <YStack
          py="$8"
          px="$3"
          items="center"
          justify="center"
          bg={MTD_TOKENS.card}
          borderWidth={1}
          borderColor={MTD_TOKENS.cardBorder}
          rounded="$4"
          minH={120}
        >
          <Spinner size="small" color={MTD_TOKENS.orange} />
        </YStack>
      ) : transactions.length === 0 ? (
        <YStack
          py="$8"
          px="$3"
          items="center"
          justify="center"
          bg={MTD_TOKENS.card}
          borderWidth={1}
          borderColor={MTD_TOKENS.cardBorder}
          rounded="$4"
          minH={120}
        >
          <SizableText fontSize={13} color={MTD_TOKENS.textMuted}>
            No transactions in this view
          </SizableText>
        </YStack>
      ) : (
        <YStack gap={12}>
          {groupTransactionsByDisplayName(transactions).map((group) => (
            <ReviewTransactionGroupRow
              key={group.key}
              group={group}
              isSelected={group.transactions.every((transaction) =>
                selectedIds.has(transaction.id),
              )}
              onToggleSelected={onToggleRowSelected}
              onEditGroup={setEditingGroup}
            />
          ))}
        </YStack>
      )}

      {total > 0 && (
        <YStack items="center" gap="$2">
          <SizableText fontSize={12} color={MTD_TOKENS.textMuted}>
            Showing {start}–{end} of {total} transactions
          </SizableText>
          <XStack gap="$2" items="center" flexWrap="wrap" justify="center">
            {Array.from({ length: totalPages }, (_, index) => index + 1).map(
              (pageNumber) => (
                <YStack
                  key={pageNumber}
                  width={28}
                  height={28}
                  rounded="$2"
                  bg={pageNumber === page ? MTD_TOKENS.orange : 'transparent'}
                  items="center"
                  justify="center"
                  cursor="pointer"
                  onPress={() => onPageChange(pageNumber)}
                >
                  <SizableText
                    fontSize={12}
                    fontWeight={pageNumber === page ? '600' : '400'}
                    color={
                      pageNumber === page ? MTD_TOKENS.onOrange : MTD_TOKENS.textMuted
                    }
                  >
                    {pageNumber}
                  </SizableText>
                </YStack>
              ),
            )}
          </XStack>
        </YStack>
      )}
      {editingGroup ? (
        <TransactionEditScreen
          key={editingGroup.key}
          transactions={editingGroup.transactions}
          onClose={() => setEditingGroup(null)}
          onAccept={async ({
            hmrcCategory,
            transactionIds,
            rememberForFuture,
            friendlyName,
            ruleDrafts,
            privateUsePercent,
          }: TransactionEditAcceptInput) => {
            // private use is stored on rules — save before accept so the card label appears
            if (rememberForFuture || privateUsePercent != null) {
              try {
                await persistTransactionRuleDrafts(persistRuleDrafts, {
                  ruleDrafts,
                  friendlyName,
                  hmrcCategory,
                  privateUsePercent,
                })
              } catch (error) {
                console.error('[categorise] persist rules failed', error)
              }
            }

            try {
              await onAcceptEditedTransactions({ hmrcCategory, transactionIds })
            } catch (error) {
              console.error('[categorise] accept edited transactions failed', error)
            }
          }}
        />
      ) : null}
    </YStack>
  )
}
