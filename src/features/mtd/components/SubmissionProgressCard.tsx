import { SizableText, Spinner, XStack, YStack } from 'tamagui'

import { useHmrcConnection } from '~/features/hmrc/client/useHmrcConnection'

import { MTD_TOKENS } from '../mtdTokens'
import type { IconComponent } from '~/interface/icons/types'
import { CheckIcon } from '~/interface/icons/phosphor/CheckIcon'
import { CloudArrowUpIcon } from '~/interface/icons/phosphor/CloudArrowUpIcon'
import { ShieldIcon } from '~/interface/icons/phosphor/ShieldIcon'

export type SubmissionPhase = 'connecting' | 'uploading' | 'processing'

type StepConfig = {
  id: SubmissionPhase
  label: string
  detail: string
  icon: IconComponent
}

const STEPS: StepConfig[] = [
  {
    id: 'connecting',
    label: 'Connecting to HMRC',
    detail: 'Establishing secure Government Gateway session…',
    icon: ShieldIcon,
  },
  {
    id: 'uploading',
    label: 'Uploading quarterly report',
    detail: 'Sending income and expense totals for this period…',
    icon: CloudArrowUpIcon,
  },
  {
    id: 'processing',
    label: 'Processing submission',
    detail: 'HMRC is validating your quarterly update…',
    icon: ShieldIcon,
  },
]

const PHASE_ORDER: SubmissionPhase[] = ['connecting', 'uploading', 'processing']

type SubmissionProgressCardProps = {
  phase: SubmissionPhase
}

function phaseIndex(phase: SubmissionPhase) {
  return PHASE_ORDER.indexOf(phase)
}

export function SubmissionProgressCard({ phase }: SubmissionProgressCardProps) {
  const activeIndex = phaseIndex(phase)
  const { status } = useHmrcConnection()
  const progress = ((activeIndex + 1) / STEPS.length) * 100

  return (
    <YStack
      width="100%"
      maxW={520}
      mx="auto"
      bg={MTD_TOKENS.card}
      borderWidth={1}
      borderColor={MTD_TOKENS.cardBorder}
      rounded="$5"
      px="$4"
      py="$5"
      gap="$4"
    >
      <YStack gap="$1.5" items="center">
        <SizableText fontSize={20} fontWeight="700" color={MTD_TOKENS.text}>
          Submitting to HMRC
        </SizableText>
        <SizableText fontSize={13} color={MTD_TOKENS.textMuted} text="center">
          Please wait while we send your quarterly update securely.
        </SizableText>
      </YStack>

      <YStack height={4} bg={MTD_TOKENS.cardInset} rounded="$10" overflow="hidden">
        <YStack
          height="100%"
          width={`${progress}%`}
          bg={MTD_TOKENS.orange}
          rounded="$10"
        />
      </YStack>

      <YStack gap="$2.5">
        {STEPS.map((step, index) => {
          const Icon = step.icon
          const isComplete = index < activeIndex
          const isActive = index === activeIndex
          const isPending = index > activeIndex

          return (
            <XStack
              key={step.id}
              bg={isActive ? MTD_TOKENS.cardInset : MTD_TOKENS.background}
              borderWidth={1}
              borderColor={isActive ? MTD_TOKENS.orange : MTD_TOKENS.cardBorder}
              rounded="$4"
              px="$3"
              py="$3"
              gap="$3"
              items="center"
              opacity={isPending ? 0.45 : 1}
            >
              <YStack
                width={40}
                height={40}
                rounded="$10"
                bg={isComplete ? MTD_TOKENS.green : MTD_TOKENS.orangeMuted}
                items="center"
                justify="center"
                shrink={0}
              >
                {isComplete ? (
                  <CheckIcon size={18} color={MTD_TOKENS.text} />
                ) : isActive ? (
                  <Spinner size="small" color={MTD_TOKENS.orange} />
                ) : (
                  <Icon size={18} color={MTD_TOKENS.textSubtle} />
                )}
              </YStack>

              <YStack flex={1} gap="$0.5" minW={0}>
                <SizableText
                  fontSize={14}
                  fontWeight="600"
                  color={isActive ? MTD_TOKENS.orange : MTD_TOKENS.text}
                >
                  {step.label}
                </SizableText>
                {(isActive || isComplete) && (
                  <SizableText fontSize={12} color={MTD_TOKENS.textMuted} lineHeight={16}>
                    {step.detail}
                  </SizableText>
                )}
              </YStack>
            </XStack>
          )
        })}
      </YStack>

      {!status.configured || !status.connected ? (
        <SizableText fontSize={11} color={MTD_TOKENS.textSubtle} text="center">
          Demo mode — connect HMRC in settings to submit for real
        </SizableText>
      ) : null}
    </YStack>
  )
}
