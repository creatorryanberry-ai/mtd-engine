import { YStack } from 'tamagui'

import { MTD_TOKENS } from '~/features/mtd/mtdTokens'

import type { YStackProps } from 'tamagui'

export function MileageFormCard({
  children,
  accent = false,
  ...props
}: YStackProps & { accent?: boolean }) {
  return (
    <YStack
      bg={MTD_TOKENS.card}
      borderWidth={1}
      borderColor={accent ? MTD_TOKENS.orange : MTD_TOKENS.cardBorder}
      rounded="$5"
      p="$4"
      gap="$3"
      {...props}
    >
      {children}
    </YStack>
  )
}
