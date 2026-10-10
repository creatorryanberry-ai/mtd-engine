import { router } from 'one'

import type { Href } from 'one'
import { Pressable } from 'react-native'
import { SizableText, XStack, YStack } from 'tamagui'

import { formatSubmissionAmount } from '~/features/mtd/utils/formatAmount'
import { formatLastUpdated } from '~/features/mtd/utils/formatLastUpdated'
import { isSystemBankAccount } from '~/features/bankAccounts/defaultBankAccounts'
import { CaretRightIcon } from '~/interface/icons/phosphor/CaretRightIcon'
import { DotsThreeIcon } from '~/interface/icons/phosphor/DotsThreeIcon'
import { WarningCircleIcon } from '~/interface/icons/phosphor/WarningCircleIcon'

import { MTD_ROUTES } from '../constants'
import { MTD_TOKENS } from '../mtdTokens'

import type { BankAccountDto } from '~/features/bankAccounts/client/useMtdBankAccounts'

type BankAccountCardProps = {
  account: BankAccountDto
}

function formatAccountDetails(account: BankAccountDto) {
  const parts: string[] = []
  if (account.sortCode) parts.push(account.sortCode)
  if (account.accountNumber) parts.push(account.accountNumber)
  return parts.join(' · ')
}

export function BankAccountCard({ account }: BankAccountCardProps) {
  const categoriseHref = `${MTD_ROUTES.bankAccounts}/${account.id}/categorise` as Href
  const details = formatAccountDetails(account)
  const isSystemAccount = isSystemBankAccount(account.externalAccountId)
  const hasUnreviewed = account.unreviewedCount > 0
  const showFooter = !isSystemAccount || hasUnreviewed
  const footerLabel = hasUnreviewed
    ? `Categorise ${account.unreviewedCount} transaction${account.unreviewedCount === 1 ? '' : 's'}`
    : 'No new transactions'

  return (
    <Pressable onPress={() => router.navigate(categoriseHref)}>
      {({ pressed }) => (
        <YStack
          bg={MTD_TOKENS.card}
          borderWidth={1}
          borderColor={MTD_TOKENS.cardBorder}
          rounded="$5"
          overflow="hidden"
          opacity={pressed ? 0.92 : 1}
        >
          <YStack px="$4" pt="$4" pb={8} gap={isSystemAccount ? 0 : 8}>
            <XStack items="flex-start" justify="space-between" gap="$3">
              <YStack flex={1} gap="$1" minW={0}>
                <XStack items="center" gap="$1.5">
                  <SizableText fontSize={18} fontWeight="700" color={MTD_TOKENS.text}>
                    {account.institutionName || 'Bank account'}
                  </SizableText>
                  {account.syncError ? (
                    <WarningCircleIcon size={16} color="#EF4444" />
                  ) : null}
                </XStack>
                {account.accountName && !isSystemAccount ? (
                  <SizableText fontSize={13} color={MTD_TOKENS.textMuted}>
                    {account.accountName}
                  </SizableText>
                ) : null}
                {details ? (
                  <SizableText fontSize={12} color={MTD_TOKENS.textSubtle}>
                    {details}
                  </SizableText>
                ) : null}
              </YStack>

              <YStack
                width={32}
                height={32}
                items="center"
                justify="center"
                opacity={0.6}
              >
                <DotsThreeIcon size={20} color={MTD_TOKENS.textMuted} />
              </YStack>
            </XStack>

            <YStack gap="$1" minH={44}>
              <SizableText fontSize={12} fontWeight="500" color={MTD_TOKENS.textSubtle}>
                Account balance
              </SizableText>
              <SizableText
                fontSize={32}
                fontWeight="700"
                color={MTD_TOKENS.text}
                letterSpacing={-0.5}
                lineHeight={40}
                numberOfLines={1}
              >
                {account.balance != null ? formatSubmissionAmount(account.balance) : '—'}
              </SizableText>
              {isSystemAccount ? (
                <SizableText fontSize={12} color={MTD_TOKENS.textSubtle}>
                  {account.transactionCount > 0
                    ? `From ${account.transactionCount} transaction${account.transactionCount === 1 ? '' : 's'}`
                    : 'No transactions yet'}
                </SizableText>
              ) : (
                <SizableText fontSize={12} color={MTD_TOKENS.textSubtle}>
                  {account.balance != null
                    ? `From your bank statement · ${formatLastUpdated(account.lastSyncedAt)}`
                    : formatLastUpdated(account.lastSyncedAt)}
                </SizableText>
              )}
            </YStack>
          </YStack>

          {showFooter ? (
            <XStack
              px="$4"
              py="$3"
              borderTopWidth={1}
              borderColor={MTD_TOKENS.cardBorder}
              items="center"
              justify="space-between"
            >
              <SizableText
                fontSize={14}
                fontWeight="600"
                color={hasUnreviewed ? MTD_TOKENS.orange : MTD_TOKENS.textMuted}
              >
                {footerLabel}
              </SizableText>
              <CaretRightIcon
                size={16}
                color={hasUnreviewed ? MTD_TOKENS.orange : MTD_TOKENS.textSubtle}
              />
            </XStack>
          ) : null}
        </YStack>
      )}
    </Pressable>
  )
}
