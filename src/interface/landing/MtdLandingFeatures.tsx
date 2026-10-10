import { SizableText, XStack, YStack } from 'tamagui'

import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { MtdAccentMutedBg } from '~/features/mtd/components/MtdAccentMutedBg'
import { CloudArrowUpIcon } from '~/interface/icons/phosphor/CloudArrowUpIcon'
import { DownloadSimpleIcon } from '~/interface/icons/phosphor/DownloadSimpleIcon'
import { TagIcon } from '~/interface/icons/phosphor/TagIcon'

const steps = [
  {
    icon: DownloadSimpleIcon,
    title: 'Download transactions',
    description:
      'Connect your bank and pull in transactions for the current tax quarter.',
  },
  {
    icon: TagIcon,
    title: 'Categorise income & expenses',
    description:
      'Review and classify transactions, apply rules, and see your quarter summary at a glance.',
  },
  {
    icon: CloudArrowUpIcon,
    title: 'Submit to HMRC',
    description:
      'When your quarter is ready, submit your Making Tax Digital update with confidence.',
  },
] as const

export function MtdLandingFeatures() {
  return (
    <YStack maxW={720} self="center" width="100%" px="$4" gap="$5" pb="$4">
      <SizableText
        fontSize={22}
        fontWeight="700"
        color={MTD_TOKENS.text}
        text="center"
        $md={{ fontSize: 24 }}
      >
        Three steps to compliance
      </SizableText>

      <YStack gap="$3">
        {steps.map(({ icon: Icon, title, description }) => (
          <YStack
            key={title}
            gap="$2.5"
            p="$5"
            bg={MTD_TOKENS.card}
            rounded="$6"
            borderWidth={1}
            borderColor={MTD_TOKENS.cardBorder}
          >
            <XStack gap="$3" items="center">
              <MtdAccentMutedBg width={40} height={40} rounded="$10" shrink={0}>
                <Icon size={20} color={MTD_TOKENS.orange} />
              </MtdAccentMutedBg>
              <SizableText
                fontSize={16}
                fontWeight="700"
                color={MTD_TOKENS.text}
                flex={1}
              >
                {title}
              </SizableText>
            </XStack>
            <SizableText
              fontSize={14}
              color={MTD_TOKENS.textMuted}
              lineHeight={22}
              pl={53}
            >
              {description}
            </SizableText>
          </YStack>
        ))}
      </YStack>
    </YStack>
  )
}
