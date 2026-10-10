import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isWeb, SizableText, View, XStack, YStack } from 'tamagui'

import { APP_NAME } from '~/constants/app'
import { LoginDemoButton } from '~/features/auth/ui/LoginDemoButton'
import { LoginEmailButton } from '~/features/auth/ui/LoginEmailButton'
import { LoginLegalText } from '~/features/auth/ui/LoginLegalText'
import { LoginSocialButtons } from '~/features/auth/ui/LoginSocialButtons'
import { CuratorLogo } from '~/features/mtd/components/CuratorLogo'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'

const AUTH_STEPS = ['Download', 'Categorise', 'Submit'] as const

function LoginHero() {
  return (
    <YStack gap="$4" width="100%" items="center">
      <CuratorLogo />
      <YStack gap="$1.5" items="center">
        <SizableText
          fontSize={isWeb ? 24 : 28}
          // rn clips bold headings when lineHeight is omitted / too tight
          lineHeight={isWeb ? 30 : 36}
          fontWeight="700"
          color={MTD_TOKENS.text}
          text="center"
          letterSpacing={-0.5}
        >
          Sign in to {APP_NAME}
        </SizableText>
        <SizableText
          fontSize={14}
          color={MTD_TOKENS.textMuted}
          text="center"
          lineHeight={20}
          maxW={320}
        >
          Download, categorise, and submit your quarterly update to HMRC
        </SizableText>
      </YStack>
      <XStack gap="$2" flexWrap="wrap" justify="center">
        {AUTH_STEPS.map((step) => (
          <XStack
            key={step}
            bg={MTD_TOKENS.cardInset}
            borderWidth={1}
            borderColor={MTD_TOKENS.cardBorder}
            px="$2.5"
            py="$1"
            rounded="$10"
          >
            <SizableText fontSize={11} fontWeight="600" color={MTD_TOKENS.textSubtle}>
              {step}
            </SizableText>
          </XStack>
        ))}
      </XStack>
    </YStack>
  )
}

function LoginActions() {
  return (
    <YStack width="100%" gap="$3">
      <LoginEmailButton />
      <LoginDemoButton />
      <LoginSocialButtons />
      <LoginLegalText />
    </YStack>
  )
}

export const LoginPage = () => {
  const insets = useSafeAreaInsets()

  if (isWeb) {
    return (
      <YStack gap="$5" width="100%">
        <LoginHero />
        <LoginActions />
      </YStack>
    )
  }

  return (
    <YStack flex={1} bg={MTD_TOKENS.background}>
      <View flex={1} items="center" justify="center" pt={insets.top} px="$6">
        <LoginHero />
      </View>

      <YStack
        bg={MTD_TOKENS.card}
        borderTopWidth={1}
        borderTopColor={MTD_TOKENS.cardBorder}
        px="$5"
        pt="$6"
        pb={insets.bottom + 16}
        gap="$4"
        borderTopLeftRadius="$8"
        borderTopRightRadius="$8"
      >
        <LoginActions />
      </YStack>
    </YStack>
  )
}
