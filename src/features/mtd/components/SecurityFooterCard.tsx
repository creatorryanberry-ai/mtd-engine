import { SizableText, XStack } from 'tamagui'

import { MTD_TOKENS } from '../mtdTokens'
import { MtdAccentMutedBg } from './MtdAccentMutedBg'
import { CaretRightIcon } from '~/interface/icons/phosphor/CaretRightIcon'
import { LockIcon } from '~/interface/icons/phosphor/LockIcon'

export function SecurityFooterCard() {
  return (
    <XStack
      bg={MTD_TOKENS.card}
      borderWidth={1}
      borderColor={MTD_TOKENS.cardBorder}
      rounded="$4"
      px="$3.5"
      py="$3.5"
      gap="$3"
      items="center"
      cursor="pointer"
      pressStyle={{ opacity: 0.9 }}
      hoverStyle={{ borderColor: MTD_TOKENS.orange }}
    >
      <MtdAccentMutedBg width={36} height={36} rounded="$10">
        <LockIcon size={18} color={MTD_TOKENS.orange} />
      </MtdAccentMutedBg>
      <SizableText fontSize={13} color={MTD_TOKENS.textMuted} flex={1} lineHeight={18}>
        Your records are secure and encrypted. We take security seriously. Your data is
        safe with us.
      </SizableText>
      <CaretRightIcon size={18} color={MTD_TOKENS.textSubtle} />
    </XStack>
  )
}
