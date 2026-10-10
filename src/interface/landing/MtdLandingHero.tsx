import { useRouter } from 'one'
import { SizableText, YStack } from 'tamagui'

import { APP_NAME } from '~/constants/app'
import { MtdActionButton } from '~/features/mtd/components/MtdActionButton'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { isPublicAuthEnabled } from '~/helpers/isPublicAuthEnabled'

export function MtdLandingHero() {
  const router = useRouter()

  return (
    <YStack
      gap="$5"
      px="$4"
      maxW={720}
      mx="auto"
      items="center"
      pt="$4"
      pb="$8"
      $md={{ pt: '$6', pb: '$10' }}
    >
      <SizableText
        fontSize={36}
        fontWeight="800"
        letterSpacing={-1}
        color={MTD_TOKENS.text}
        text="center"
        lineHeight={42}
        $md={{ fontSize: 48, lineHeight: 54 }}
      >
        Making Tax Digital, simplified
      </SizableText>

      <SizableText
        fontSize={16}
        color={MTD_TOKENS.textMuted}
        maxW={560}
        text="center"
        lineHeight={24}
        $md={{ fontSize: 18, lineHeight: 28 }}
      >
        <SizableText fontWeight="700" color={MTD_TOKENS.text}>
          {APP_NAME}
        </SizableText>{' '}
        helps UK sole traders download bank transactions, categorise income and expenses,
        and submit quarterly updates to HMRC.
      </SizableText>

      {isPublicAuthEnabled && (
        <MtdActionButton minW={160} px="$5" onPress={() => router.push('/auth/login')}>
          Sign in →
        </MtdActionButton>
      )}
    </YStack>
  )
}
