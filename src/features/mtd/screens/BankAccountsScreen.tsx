import { memo } from 'react'
import { ScrollView as RNScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isWeb, SizableText, YStack } from 'tamagui'

import { useMtdBankAccounts } from '~/features/bankAccounts/client/useMtdBankAccounts'
import { useVisibleBankAccounts } from '~/features/bankAccounts/client/useVisibleBankAccounts'
import { BankIcon } from '~/interface/icons/phosphor/BankIcon'

import { BankAccountCard } from '../components/BankAccountCard'
import { MtdDetailHeader } from '../components/MtdDetailHeader'
import { useBankAccountsScrollRestoration } from '../hooks/useBankAccountsScrollRestoration'
import { MTD_ROUTES, MTD_TAB_BAR_HEIGHT } from '../constants'
import { MTD_TOKENS } from '../mtdTokens'

export const BankAccountsScreen = memo(() => {
  const insets = useSafeAreaInsets()
  const { accounts, isLoading, error } = useMtdBankAccounts()
  const { connectedAccounts } = useVisibleBankAccounts(accounts)

  const scrollReady = !isLoading && accounts.length > 0
  const { scrollRef, handleScroll, handleContentSizeChange, initialContentOffset } =
    useBankAccountsScrollRestoration({ ready: scrollReady })

  const content = (
    <RNScrollView
      ref={scrollRef}
      style={{ flex: 1 }}
      showsVerticalScrollIndicator={false}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      onContentSizeChange={handleContentSizeChange}
      contentOffset={initialContentOffset}
    >
      <YStack
        gap="$6"
        px="$4"
        pt="$5"
        pb={isWeb ? '$6' : insets.bottom + MTD_TAB_BAR_HEIGHT + 24}
        maxW={720}
        width="100%"
        mx="auto"
      >
        <YStack gap="$2.5">
          <SizableText fontSize={14} color={MTD_TOKENS.textMuted} lineHeight={21}>
            Add transactions to each account, then categorise them for your records.
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
        ) : connectedAccounts.length === 0 ? (
          <YStack
            bg={MTD_TOKENS.card}
            borderWidth={1}
            borderColor={MTD_TOKENS.cardBorder}
            rounded="$5"
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
              Add a manual transaction to create your first account card.
            </SizableText>
          </YStack>
        ) : (
          <YStack gap="$4">
            {connectedAccounts.map((account) => (
              <BankAccountCard key={account.id} account={account} />
            ))}
          </YStack>
        )}
      </YStack>
    </RNScrollView>
  )

  if (isWeb) {
    return (
      <YStack flex={1} bg={MTD_TOKENS.background}>
        <MtdDetailHeader backHref={MTD_ROUTES.records} title="Bank Accounts" />
        <YStack flex={1} py="$2">
          {content}
        </YStack>
      </YStack>
    )
  }

  return (
    <YStack flex={1} bg={MTD_TOKENS.background}>
      <YStack pt={insets.top}>
        <MtdDetailHeader
          backHref={MTD_ROUTES.records}
          title="Bank Accounts"
          rightActions={<YStack width={36} height={36} />}
        />
      </YStack>
      {content}
    </YStack>
  )
})
