import { Paragraph, SizableText, View, YStack, styled } from 'tamagui'

import { MTD_TOKENS } from '~/features/mtd/mtdTokens'

import type { ComponentType } from 'react'
import type { IconProps } from '~/interface/icons/types'

interface InfoCardProps {
  title: string
  Icon: ComponentType<IconProps>
  children: React.ReactNode
  maxColumns?: 1 | 2 | 3
}

export const InfoCard = ({ title, Icon, children, maxColumns }: InfoCardProps) => {
  return (
    <CardContainer maxColumns={maxColumns}>
      <View self="flex-end" mb={-4}>
        <Icon size={24} color={MTD_TOKENS.orange} />
      </View>

      <SizableText fontSize={16} fontWeight="600" color={MTD_TOKENS.text} mt="$1">
        {title}
      </SizableText>

      <Paragraph fontSize={14} color={MTD_TOKENS.textMuted} lineHeight={20}>
        {children}
      </Paragraph>
    </CardContainer>
  )
}

const CardContainer = styled(YStack, {
  gap: '$2',
  mb: '$2',
  py: '$4',
  px: '$4',
  position: 'relative',
  bg: MTD_TOKENS.card,
  borderWidth: 1,
  borderColor: MTD_TOKENS.cardBorder,
  rounded: '$4',
  cursor: 'pointer',
  hoverStyle: {
    borderColor: MTD_TOKENS.orangeMuted,
    bg: MTD_TOKENS.cardInset,
  },

  variants: {
    maxColumns: {
      1: {
        width: '100%',
      },

      2: {
        width: '100%',

        $md: {
          width: 'calc(50% - 12px)',
          mb: '$4',
        },
      },

      3: {
        width: '100%',

        $md: {
          width: 'calc(50% - 12px)',
          mb: '$4',
        },

        $xl: {
          width: 'calc(32% - 12px)',
          mb: '$4',
        },
      },
    },
  } as const,

  defaultVariants: {
    maxColumns: 3,
  },
})
