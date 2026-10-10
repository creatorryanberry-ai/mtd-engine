import { router } from 'one'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isWeb, ScrollView, SizableText, XStack, YStack } from 'tamagui'

import { useMtdBankAccounts } from '~/features/bankAccounts/client/useMtdBankAccounts'
import { useVisibleBankAccounts } from '~/features/bankAccounts/client/useVisibleBankAccounts'
import { isSystemBankAccount } from '~/features/bankAccounts/defaultBankAccounts'
import { formatSubmissionAmount } from '~/features/mtd/utils/formatAmount'
import { BankIcon } from '~/interface/icons/phosphor/BankIcon'
import { CaretRightIcon } from '~/interface/icons/phosphor/CaretRightIcon'

import { BankAccountsSectionDivider } from '../components/BankAccountsSectionDivider'
import { MTD_ROUTES, MTD_TAB_BAR_HEIGHT } from '../constants'
import { MTD_TOKENS } from '../mtdTokens'

import type { BankAccountDto } from '~/features/bankAccounts/client/useMtdBankAccounts'

function formatAccountDetails(account: BankAccountDto) {
  const parts: string[] = []
  if (account.sortCode) parts.push(account.sortCode)
  if (account.accountNumber) parts.push(account.accountNumber)
  return parts.join(' · ')
}

function BankAccountManageRow({
  account,
  isLast,
  onPress,
}: {
  account: BankAccountDto
  isLast: boolean
  onPress?: () => void
}) {
  const details = formatAccountDetails(account)

  return (
    <XStack
      cursor={onPress ? 'pointer' : 'default'}
      px="$3.5"
      py="$3.5"
      gap="$3"
      items="center"
      borderBottomWidth={isLast ? 0 : 1}
      borderBottomColor={MTD_TOKENS.cardBorder}
      pressStyle={onPress ? { opacity: 0.9 } : undefined}
      hoverStyle={onPress ? { bg: MTD_TOKENS.cardInset } : undefined}
      onPress={onPress}
    >
      <YStack
        width={36}
        height={36}
        rounded="$10"
        bg={MTD_TOKENS.cardInset}
        items="center"
        justify="center"
        shrink={0}
      >
        <BankIcon size={18} color={MTD_TOKENS.textSubtle} />
      </YStack>
      <YStack flex={1} gap="$0.5" minW={0}>
        <SizableText
          fontSize={15}
          fontWeight="500"
          color={MTD_TOKENS.text}
          numberOfLines={1}
        >
          {account.institutionName || 'Bank account'}
        </SizableText>
        {account.accountName ? (
          <SizableText fontSize={13} color={MTD_TOKENS.textMuted} numberOfLines={1}>
            {account.accountName}
          </SizableText>
        ) : null}
        {details ? (
          <SizableText fontSize={12} color={MTD_TOKENS.textSubtle} numberOfLines={1}>
            {details}
          </SizableText>
        ) : null}
      </YStack>
      <YStack items="flex-end" gap="$0.5" shrink={0}>
        {account.balance != null ? (
          <SizableText fontSize={14} fontWeight="600" color={MTD_TOKENS.text}>
            {formatSubmissionAmount(account.balance)}
          </SizableText>
        ) : null}
        <SizableText fontSize={12} color={MTD_TOKENS.textSubtle}>
          {account.transactionCount} transaction
          {account.transactionCount === 1 ? '' : 's'}
        </SizableText>
      </YStack>
      <CaretRightIcon size={18} color={MTD_TOKENS.textSubtle} opacity={onPress ? 1 : 0} />
    </XStack>
  )
}

function BankAccountManageSection({
  accounts,
  onAccountPress,
}: {
  accounts: BankAccountDto[]
  onAccountPress?: (account: BankAccountDto) => void
}) {
  if (accounts.length === 0) return null

  return (
    <YStack
      bg={MTD_TOKENS.card}
      borderWidth={1}
      borderColor={MTD_TOKENS.cardBorder}
      rounded="$4"
      overflow="hidden"
    >
      {accounts.map((account, index) => (
        <BankAccountManageRow
          key={account.id}
          account={account}
          isLast={index === accounts.length - 1}
          onPress={
            onAccountPress && !isSystemBankAccount(account.externalAccountId)
              ? () => onAccountPress(account)
              : undefined
          }
        />
      ))}
    </YStack>
  )
}

export function BankAccountsManageScreen() {
  const insets = useSafeAreaInsets()
  const { accounts, isLoading, error } = useMtdBankAccounts()
  const { systemAccounts, connectedAccounts } = useVisibleBankAccounts(accounts)

  const content = (
    <YStack
      gap="$5"
      px="$4"
      pt="$4"
      pb={isWeb ? '$8' : insets.bottom + MTD_TAB_BAR_HEIGHT + 24}
      maxW={720}
      width="100%"
      mx="auto"
      $lg={{ px: '$6', pt: '$6' }}
    >
      <YStack gap="$1">
        <SizableText fontSize={14} color={MTD_TOKENS.textMuted} lineHeight={20}>
          Edit or remove the bank accounts linked to your MTD records.
        </SizableText>
      </YStack>

      {error ? (
        <SizableText fontSize={13} color="#EF4444">
          {error}
        </SizableText>
      ) : null}

      {isLoading ? (
        <SizableText fontSize={14} color={MTD_TOKENS.textMuted}>
          Loading bank accounts…
        </SizableText>
      ) : accounts.length === 0 ? (
        <YStack
          bg={MTD_TOKENS.card}
          borderWidth={1}
          borderColor={MTD_TOKENS.cardBorder}
          rounded="$4"
          p="$5"
          gap="$2"
          items="center"
        >
          <BankIcon size={28} color={MTD_TOKENS.textMuted} />
          <SizableText
            fontSize={15}
            fontWeight="600"
            color={MTD_TOKENS.text}
            text="center"
          >
            No bank accounts yet
          </SizableText>
          <SizableText
            fontSize={13}
            color={MTD_TOKENS.textMuted}
            text="center"
            lineHeight={18}
          >
            Add a manual transaction to create your first bank account.
          </SizableText>
        </YStack>
      ) : (
        <YStack gap="$4">
          <BankAccountManageSection accounts={systemAccounts} />
          {systemAccounts.length > 0 && connectedAccounts.length > 0 ? (
            <BankAccountsSectionDivider />
          ) : null}
          <BankAccountManageSection
            accounts={connectedAccounts}
            onAccountPress={(account) =>
              router.push(`${MTD_ROUTES.settingsBankAccounts}/${account.id}` as any)
            }
          />
        </YStack>
      )}
    </YStack>
  )

  if (isWeb) {
    return (
      <YStack flex={1} minH={0} overflow="scroll">
        {content}
      </YStack>
    )
  }

  return (
    <ScrollView flex={1} showsVerticalScrollIndicator={false}>
      {content}
    </ScrollView>
  )
}
