import { setClipboardText } from '@mtd/helpers'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isWeb, SizableText, YStack } from 'tamagui'

import { useInboundEmailAddress } from '~/features/inbox/client/useInboundEmailAddress'
import { MtdActionButton } from '~/features/mtd/components/MtdActionButton'
import { MTD_TAB_BAR_HEIGHT } from '~/features/mtd/constants'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { dialogConfirm } from '~/interface/dialogs/actions'
import { showToast } from '~/interface/toast/helpers'

export function MtdEmailSettingsScreen() {
  const insets = useSafeAreaInsets()
  const { address, isLoading, regenerate, isRegenerating } = useInboundEmailAddress()

  const handleCopy = async () => {
    if (!address?.emailAddress) return
    const copied = await setClipboardText(address.emailAddress)
    showToast(copied ? 'Email address copied' : 'Could not copy address', {
      type: copied ? 'success' : 'error',
    })
  }

  const handleRegenerate = async () => {
    const confirmed = await dialogConfirm({
      title: 'Regenerate your MTD email?',
      description:
        'Regenerating your address will stop documents sent to the old address from being accepted.',
    })
    if (!confirmed) return
    try {
      await regenerate()
      showToast('New email address created', { type: 'success' })
    } catch (error) {
      showToast('Could not regenerate address', {
        type: 'error',
        message: error instanceof Error ? error.message : undefined,
      })
    }
  }

  return (
    <YStack
      flex={1}
      bg={MTD_TOKENS.background}
      px="$4"
      pt="$4"
      pb={isWeb ? '$6' : insets.bottom + MTD_TAB_BAR_HEIGHT + 24}
      gap="$4"
      maxW={520}
      width="100%"
      mx="auto"
    >
      <SizableText fontSize={14} color={MTD_TOKENS.textMuted} lineHeight={20}>
        Forward receipts, invoices, CIS vouchers and statements here.
      </SizableText>

      <YStack
        bg={MTD_TOKENS.card}
        borderWidth={1}
        borderColor={MTD_TOKENS.cardBorder}
        rounded="$5"
        px="$4"
        py="$4"
        gap="$3"
      >
        <SizableText fontSize={12} fontWeight="600" color={MTD_TOKENS.textSubtle}>
          Your MTD email
        </SizableText>
        <SizableText fontSize={16} fontWeight="600" color={MTD_TOKENS.text} selectable>
          {isLoading ? 'Loading…' : address?.emailAddress || 'Unavailable'}
        </SizableText>
        <MtdActionButton
          disabled={!address || isRegenerating}
          onPress={() => void handleCopy()}
        >
          Copy email address
        </MtdActionButton>
        <MtdActionButton
          variant="secondary"
          disabled={!address || isRegenerating}
          loading={isRegenerating}
          onPress={() => void handleRegenerate()}
        >
          Regenerate address
        </MtdActionButton>
      </YStack>

      <SizableText fontSize={13} color={MTD_TOKENS.textSubtle} lineHeight={18}>
        Regenerating your address will stop documents sent to the old address from being
        accepted.
      </SizableText>
    </YStack>
  )
}
