import { useState } from 'react'
import { Linking, TextInput } from 'react-native'
import { isWeb, SizableText, XStack, YStack } from 'tamagui'

import { MtdActionButton } from '~/features/mtd/components/MtdActionButton'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { useMtdThemeColors } from '~/features/mtd/useMtdThemeColors'
import { HMRC_PRODUCTION_ACCOUNT_URL } from '~/features/hmrc/constants'

import { useHmrcConnection } from '../client/useHmrcConnection'

function formatNinoInput(value: string) {
  const cleaned = value.replace(/\s+/g, '').toUpperCase()
  if (cleaned.length <= 2) return cleaned
  if (cleaned.length <= 8) return `${cleaned.slice(0, 2)} ${cleaned.slice(2)}`
  return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 8)} ${cleaned.slice(8, 9)}`
}

export function HmrcConnectSection() {
  const colors = useMtdThemeColors()
  const { status, isLoading, isConnecting, error, connect, disconnect } =
    useHmrcConnection()
  const [nino, setNino] = useState(status.nino ?? '')
  const showHmrcAccountLink = status.environment === 'production'

  const openHmrcAccount = () => {
    if (isWeb) {
      window.open(HMRC_PRODUCTION_ACCOUNT_URL, '_blank', 'noopener,noreferrer')
      return
    }

    void Linking.openURL(HMRC_PRODUCTION_ACCOUNT_URL)
  }

  if (isLoading) {
    return (
      <YStack
        bg={MTD_TOKENS.card}
        borderWidth={1}
        borderColor={MTD_TOKENS.cardBorder}
        rounded="$4"
        p="$4"
        gap="$2"
      >
        <SizableText fontSize={14} color={MTD_TOKENS.textMuted}>
          Loading HMRC connection…
        </SizableText>
      </YStack>
    )
  }

  if (!status.configured) {
    return (
      <YStack
        bg={MTD_TOKENS.card}
        borderWidth={1}
        borderColor={MTD_TOKENS.cardBorder}
        rounded="$4"
        p="$4"
        gap="$2"
      >
        <SizableText fontSize={15} fontWeight="600" color={MTD_TOKENS.text}>
          HMRC connection
        </SizableText>
        <SizableText fontSize={13} color={MTD_TOKENS.textMuted} lineHeight={18}>
          HMRC API credentials are not configured in this environment. Submissions will
          stay in demo mode until HMRC client credentials are set.
        </SizableText>
      </YStack>
    )
  }

  if (status.connected) {
    return (
      <YStack
        bg={MTD_TOKENS.card}
        borderWidth={1}
        borderColor={MTD_TOKENS.cardBorder}
        rounded="$4"
        p="$4"
        gap="$3"
      >
        <YStack gap="$1">
          <SizableText fontSize={15} fontWeight="600" color={MTD_TOKENS.text}>
            HMRC connected
          </SizableText>
          <SizableText fontSize={13} color={MTD_TOKENS.textMuted}>
            NINO ending {status.nino}
            {status.businessName ? ` · ${status.businessName}` : ''}
          </SizableText>
        </YStack>

        <XStack gap="$2" flexWrap="wrap">
          {showHmrcAccountLink && (
            <MtdActionButton size="compact" onPress={openHmrcAccount}>
              View HMRC account
            </MtdActionButton>
          )}
          <MtdActionButton
            size="compact"
            loading={isConnecting}
            onPress={() => void disconnect().catch(() => undefined)}
          >
            Disconnect
          </MtdActionButton>
        </XStack>
      </YStack>
    )
  }

  return (
    <YStack
      bg={MTD_TOKENS.card}
      borderWidth={1}
      borderColor={MTD_TOKENS.cardBorder}
      rounded="$4"
      p="$4"
      gap="$3"
    >
      <YStack gap="$1">
        <SizableText fontSize={15} fontWeight="600" color={MTD_TOKENS.text}>
          Connect to HMRC
        </SizableText>
        <SizableText fontSize={13} color={MTD_TOKENS.textMuted} lineHeight={18}>
          Authorise Straight Up Tax to submit quarterly self-employment updates and
          retrieve your tax estimate.
        </SizableText>
      </YStack>

      {isWeb ? (
        <input
          value={nino}
          onChange={(event) => setNino(formatNinoInput(event.target.value))}
          placeholder="QQ 12 34 56 C"
          style={{
            width: '100%',
            borderRadius: 12,
            border: `1px solid ${colors.cardBorder}`,
            background: colors.cardInset,
            color: colors.text,
            padding: '12px 14px',
            fontSize: 14,
          }}
        />
      ) : (
        <TextInput
          value={nino}
          onChangeText={(value) => setNino(formatNinoInput(value))}
          placeholder="QQ 12 34 56 C"
          placeholderTextColor={colors.textSubtle}
          autoCapitalize="characters"
          style={{
            width: '100%',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            backgroundColor: colors.cardInset,
            color: colors.text,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 14,
          }}
        />
      )}

      {error && (
        <SizableText fontSize={13} color="#EF4444">
          {error}
        </SizableText>
      )}

      <MtdActionButton
        size="large"
        width="100%"
        loading={isConnecting}
        disabled={!nino.trim()}
        onPress={() => void connect(nino)}
      >
        Connect to HMRC
      </MtdActionButton>
    </YStack>
  )
}
