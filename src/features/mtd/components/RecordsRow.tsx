import type { ReactNode } from 'react'
import { router, type Href } from 'one'
import { SizableText, XStack, YStack } from 'tamagui'

import { composeHapticPressIn } from '~/interface/haptics/haptics'
import { CaretRightIcon } from '~/interface/icons/phosphor/CaretRightIcon'

import { MTD_TOKENS } from '../mtdTokens'

type RecordsRowProps = {
  title: string
  subtitle: string
  value?: string
  icon: ReactNode
  iconBg: string
  href: Href | string
  onPress?: () => void
}

export function RecordsRow({
  title,
  subtitle,
  value,
  icon,
  iconBg,
  href,
  onPress,
}: RecordsRowProps) {
  return (
    <XStack
      bg={MTD_TOKENS.card}
      borderWidth={1}
      borderColor={MTD_TOKENS.cardBorder}
      rounded="$5"
      px="$4"
      py="$3.5"
      items="center"
      gap="$3.5"
      cursor="pointer"
      pressStyle={{ opacity: 0.92 }}
      onPress={() => {
        onPress?.()
        router.push(href as Href)
      }}
      onPressIn={composeHapticPressIn()}
    >
      <YStack
        width={44}
        height={44}
        rounded="$4"
        items="center"
        justify="center"
        shrink={0}
        style={{ backgroundColor: iconBg }}
      >
        {icon}
      </YStack>

      <YStack flex={1} gap="$0.5" minW={0}>
        <SizableText fontSize={16} fontWeight="600" color={MTD_TOKENS.text}>
          {title}
        </SizableText>
        <SizableText fontSize={13} color={MTD_TOKENS.textMuted}>
          {subtitle}
        </SizableText>
      </YStack>

      {value ? (
        <SizableText fontSize={15} fontWeight="600" color={MTD_TOKENS.text} shrink={0}>
          {value}
        </SizableText>
      ) : null}

      <CaretRightIcon size={18} color={MTD_TOKENS.textMuted} />
    </XStack>
  )
}
