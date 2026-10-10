import { Link } from 'one'
import { SizableText, YStack } from 'tamagui'

import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { CuratorLogo } from '~/features/mtd/components/CuratorLogo'

export default () => {
  return (
    <YStack
      flex={1}
      minH="60vh"
      bg={MTD_TOKENS.background}
      py="$18"
      items="center"
      justify="center"
      gap="$4"
      px="$4"
    >
      <CuratorLogo />
      <SizableText fontSize={24} fontWeight="700" color={MTD_TOKENS.text}>
        Page not found
      </SizableText>
      <SizableText fontSize={14} color={MTD_TOKENS.textMuted} text="center">
        The page you&apos;re looking for doesn&apos;t exist.
      </SizableText>
      <Link href="/home/feed">
        <SizableText fontSize={14} fontWeight="600" color={MTD_TOKENS.orange}>
          Go to dashboard
        </SizableText>
      </Link>
    </YStack>
  )
}
