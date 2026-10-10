import { SizableText, YStack } from 'tamagui'

import { EULA_URL, PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from '~/constants/app'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { Link } from '~/interface/app/Link'

export const LoginLegalText = () => {
  return (
    <YStack items="center" gap="$2">
      <SizableText
        fontSize={12}
        text="center"
        color={MTD_TOKENS.textSubtle}
        px="$2"
        lineHeight={18}
      >
        By continuing, you agree to our{' '}
        <Link href={TERMS_OF_SERVICE_URL} color={MTD_TOKENS.orange}>
          Terms
        </Link>
        ,{' '}
        <Link href={PRIVACY_POLICY_URL} color={MTD_TOKENS.orange}>
          Privacy
        </Link>{' '}
        &{' '}
        <Link href={EULA_URL} color={MTD_TOKENS.orange}>
          EULA
        </Link>
      </SizableText>
    </YStack>
  )
}
