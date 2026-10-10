import { SizableText, YStack } from 'tamagui'

import { getContrastingTextColor } from '../utils/contrastTextColor'

type MtdMerchantAvatarProps = {
  initials: string
  color: string
  size?: number
  fontSize?: number
}

export function MtdMerchantAvatar({
  initials,
  color,
  size = 40,
  fontSize = 12,
}: MtdMerchantAvatarProps) {
  const textColor = getContrastingTextColor(color)

  return (
    <YStack
      width={size}
      height={size}
      rounded="$10"
      items="center"
      justify="center"
      shrink={0}
      style={{ backgroundColor: color }}
    >
      <SizableText fontSize={fontSize} fontWeight="700" style={{ color: textColor }}>
        {initials}
      </SizableText>
    </YStack>
  )
}
