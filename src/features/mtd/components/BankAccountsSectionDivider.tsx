import { Separator, SizableText, YStack } from 'tamagui'

import { MTD_TOKENS } from '~/features/mtd/mtdTokens'

export function BankAccountsSectionDivider({
  label = 'Connected banks',
}: {
  label?: string
}) {
  return (
    <YStack gap="$2" py="$1">
      <Separator borderColor={MTD_TOKENS.cardBorder} />
      <SizableText
        fontSize={12}
        fontWeight="600"
        color={MTD_TOKENS.textMuted}
        letterSpacing={0.6}
        textTransform="uppercase"
      >
        {label}
      </SizableText>
    </YStack>
  )
}
