import type { ReactNode } from 'react'
import { SizableText, XStack, YStack } from 'tamagui'

import { formatMtdAmount } from '../utils/formatAmount'
import {
  formatPrivateUseLabel,
  getBusinessExpenseAmount,
  getEffectivePrivateUsePercent,
} from '../categories/transactionEditCategories'
import { getContrastingTextColor } from '../utils/contrastTextColor'
import { getTransactionDisplayLines } from '../utils/formatTransactionDisplay'
import { MTD_TOKENS } from '../mtdTokens'
import { useBrandTheme } from '~/features/theme/BrandThemeProvider'
import { CameraIcon } from '~/interface/icons/phosphor/CameraIcon'
import { MtdMerchantAvatar } from './MtdMerchantAvatar'

import type { MtdTransactionDto } from '~/features/bankAccounts/types'

const STACKED_CARD_LEFT_INDENT = 13
const STACKED_CARD_PEEK = 10

function StackedCardBack({ layer, stackDepth }: { layer: number; stackDepth: number }) {
  const { brand } = useBrandTheme()

  return (
    <YStack
      position="absolute"
      t={layer * STACKED_CARD_PEEK}
      l={layer * STACKED_CARD_LEFT_INDENT}
      r={0}
      b={(stackDepth - layer) * STACKED_CARD_PEEK}
      bg={MTD_TOKENS.card}
      borderWidth={1}
      borderColor={brand.colors.stackedCardBorder}
      rounded="$4"
      z={stackDepth - layer + 1}
    />
  )
}

function StackedCardShell({ count, children }: { count: number; children: ReactNode }) {
  if (count <= 1) {
    return <>{children}</>
  }

  const stackDepth = count - 1

  return (
    <YStack position="relative" pb={stackDepth * STACKED_CARD_PEEK}>
      {Array.from({ length: stackDepth }, (_, index) => {
        const layer = stackDepth - index

        return <StackedCardBack key={layer} layer={layer} stackDepth={stackDepth} />
      })}
      <YStack position="relative" z={stackDepth + 1} width="100%">
        {children}
      </YStack>
    </YStack>
  )
}

type MtdTransactionRowDetailsProps = {
  transaction: MtdTransactionDto
  matchCount?: number
  amount?: number
  privateUsePercent?: number | null
  preferOriginalMerchantName?: boolean
}

function resolveTransactionDisplayAmount(
  transaction: MtdTransactionDto,
  amount?: number,
  privateUsePercent?: number | null,
) {
  if (amount != null) return amount

  const effectivePrivateUsePercent = getEffectivePrivateUsePercent(
    transaction,
    privateUsePercent,
  )
  if (effectivePrivateUsePercent != null) {
    return getBusinessExpenseAmount(transaction.amount, effectivePrivateUsePercent)
  }

  return transaction.amount
}

function PrivateUseLabel({ privateUsePercent }: { privateUsePercent: number }) {
  return (
    <SizableText fontSize={11} fontWeight="400" color={MTD_TOKENS.textMuted}>
      {formatPrivateUseLabel(privateUsePercent)}
    </SizableText>
  )
}

function CategoryPill({
  label,
  backgroundColor,
}: {
  label: string
  backgroundColor: string
}) {
  const textColor = getContrastingTextColor(backgroundColor)

  return (
    <XStack
      self="flex-start"
      rounded="$2"
      shrink={0}
      style={{ backgroundColor, paddingHorizontal: 9, paddingVertical: 0 }}
    >
      <SizableText fontSize={11} fontWeight="600" style={{ color: textColor }}>
        {label}
      </SizableText>
    </XStack>
  )
}

function MatchCountPill({ count }: { count: number }) {
  const label = count === 1 ? '1 match' : `${count} matches`

  return (
    <XStack
      bg={MTD_TOKENS.cardInset}
      borderWidth={1}
      borderColor={MTD_TOKENS.cardBorder}
      rounded="$10"
      px="$2"
      py="$0.5"
      shrink={0}
    >
      <SizableText fontSize={11} fontWeight="500" color={MTD_TOKENS.textSubtle}>
        {label}
      </SizableText>
    </XStack>
  )
}

export function MtdTransactionRowDetails({
  transaction,
  matchCount = 1,
  amount,
  privateUsePercent,
  preferOriginalMerchantName = false,
}: MtdTransactionRowDetailsProps) {
  const displayAmount = resolveTransactionDisplayAmount(
    transaction,
    amount,
    privateUsePercent,
  )
  const effectivePrivateUsePercent = getEffectivePrivateUsePercent(
    transaction,
    privateUsePercent,
  )
  const isCredit = displayAmount > 0
  const { name, memo, date, category } = getTransactionDisplayLines(
    preferOriginalMerchantName ? { ...transaction, displayName: undefined } : transaction,
  )

  return (
    <YStack flex={1} minW={0} gap="$0.5">
      <XStack justify="space-between" items="flex-start" gap="$3">
        <SizableText flex={1} fontSize={15} fontWeight="600" color={MTD_TOKENS.text}>
          {name}
        </SizableText>
        <SizableText
          fontSize={14}
          fontWeight="700"
          color={isCredit ? MTD_TOKENS.green : MTD_TOKENS.orange}
          shrink={0}
        >
          {formatMtdAmount(displayAmount)}
        </SizableText>
      </XStack>

      {memo ? (
        <SizableText fontSize={12} fontWeight="300" color={MTD_TOKENS.textMuted}>
          {memo}
        </SizableText>
      ) : null}

      <XStack justify="space-between" items="flex-start" gap="$2">
        <YStack gap="$0.5" flex={1}>
          <SizableText fontSize={12} fontWeight="300" color={MTD_TOKENS.textMuted}>
            {date}
            {transaction.pending ? ' · Pending' : ''}
          </SizableText>
          {category ? (
            <YStack gap="$0.5" self="flex-start">
              <CategoryPill label={category} backgroundColor={transaction.color} />
              {effectivePrivateUsePercent != null ? (
                <PrivateUseLabel privateUsePercent={effectivePrivateUsePercent} />
              ) : null}
            </YStack>
          ) : null}
        </YStack>
        {matchCount > 1 ? <MatchCountPill count={matchCount} /> : null}
      </XStack>
    </YStack>
  )
}

type MtdGroupedTransactionRowProps = {
  transactions: MtdTransactionDto[]
  leading?: ReactNode
  trailing?: ReactNode
  avatarSize?: number
  avatarFontSize?: number
  contentInsetX?: string | number
  onPress?: () => void
  showStack?: boolean
  showGroupTotal?: boolean
  preferOriginalMerchantName?: boolean
  privateUsePercent?: number | null
  cardWrapper?: (card: ReactNode) => ReactNode
}

export function MtdGroupedTransactionRow({
  transactions,
  leading,
  trailing,
  avatarSize = 40,
  avatarFontSize = 12,
  contentInsetX = '$3.5',
  onPress,
  showStack = true,
  showGroupTotal = true,
  preferOriginalMerchantName = false,
  privateUsePercent = null,
  cardWrapper,
}: MtdGroupedTransactionRowProps) {
  const { brand } = useBrandTheme()
  const lead = transactions[0]
  if (!lead) return null

  const isGroup = transactions.length > 1
  const getDisplayAmount = (transaction: MtdTransactionDto) =>
    resolveTransactionDisplayAmount(transaction, undefined, privateUsePercent)

  const groupAmount =
    isGroup && showGroupTotal
      ? transactions.reduce((sum, transaction) => sum + getDisplayAmount(transaction), 0)
      : undefined

  const displayAmount = groupAmount ?? getDisplayAmount(lead)

  const bodyPressProps = onPress
    ? {
        onPress,
        cursor: 'pointer' as const,
        pressStyle: { opacity: 0.92 },
      }
    : {}

  const cardBody = (
    <XStack py="$3" gap="$3" items="flex-start" px={contentInsetX as never}>
      {leading}

      <XStack flex={1} gap="$3" items="flex-start" minW={0} {...bodyPressProps}>
        <MtdMerchantAvatar
          initials={lead.initials}
          color={lead.color}
          size={avatarSize}
          fontSize={avatarFontSize}
        />

        <MtdTransactionRowDetails
          transaction={lead}
          matchCount={transactions.length}
          amount={displayAmount}
          privateUsePercent={privateUsePercent}
          preferOriginalMerchantName={preferOriginalMerchantName}
        />
      </XStack>

      {trailing}
    </XStack>
  )

  const frontCard = (
    <YStack
      position="relative"
      width="100%"
      bg={MTD_TOKENS.card}
      borderWidth={1}
      borderColor={brand.colors.transactionCardBorder}
      rounded="$4"
      overflow="hidden"
    >
      {cardWrapper ? cardWrapper(cardBody) : cardBody}
      {lead.attachmentUrl ? (
        <YStack position="absolute" b="$2.5" r="$3" z={2} pointerEvents="none">
          <CameraIcon size={31} color={MTD_TOKENS.textMuted} />
        </YStack>
      ) : null}
    </YStack>
  )

  return (
    <StackedCardShell count={showStack ? transactions.length : 1}>
      {frontCard}
    </StackedCardShell>
  )
}
