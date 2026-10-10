import { SizableText, XStack, YStack } from 'tamagui'

import type { SubmitQuarterlyResult } from '~/features/submission/server/submissionService'
import { MTD_TOKENS } from '../mtdTokens'
import { CheckIcon } from '~/interface/icons/phosphor/CheckIcon'
import { formatSubmissionAmount, formatSubmissionTimestamp } from '../utils/formatAmount'

type SubmissionSuccessCardProps = {
  result: SubmitQuarterlyResult
  onStartAgain: () => void
}

type StatBoxProps = {
  label: string
  value: string
  valueColor?: string
}

function StatBox({ label, value, valueColor = MTD_TOKENS.text }: StatBoxProps) {
  return (
    <YStack
      flex={1}
      minW="45%"
      bg={MTD_TOKENS.cardInset}
      borderWidth={1}
      borderColor={MTD_TOKENS.cardBorder}
      rounded="$4"
      px="$3"
      py="$3"
      gap="$1.5"
    >
      <SizableText
        fontSize={10}
        fontWeight="600"
        color={MTD_TOKENS.textSubtle}
        letterSpacing={0.8}
      >
        {label}
      </SizableText>
      <SizableText
        fontSize={18}
        fontWeight="700"
        color={valueColor as any}
        fontFamily={'monospace' as any}
        numberOfLines={1}
      >
        {value}
      </SizableText>
    </YStack>
  )
}

export function SubmissionSuccessCard({
  result,
  onStartAgain,
}: SubmissionSuccessCardProps) {
  return (
    <YStack
      width="100%"
      maxW={520}
      mx="auto"
      bg={MTD_TOKENS.card}
      borderWidth={1}
      borderColor={MTD_TOKENS.green}
      rounded="$5"
      px="$4"
      py="$5"
      gap="$4"
      items="center"
    >
      <YStack
        width={56}
        height={56}
        rounded="$10"
        bg={MTD_TOKENS.green}
        items="center"
        justify="center"
      >
        <CheckIcon size={28} color={MTD_TOKENS.text} />
      </YStack>

      <YStack gap="$1.5" items="center">
        <SizableText fontSize={24} fontWeight="700" color={MTD_TOKENS.text}>
          Submitted to HMRC
        </SizableText>
        <SizableText fontSize={12} color={MTD_TOKENS.textMuted} letterSpacing={0.6}>
          {result.status} · {formatSubmissionTimestamp(result.submittedAt)}
        </SizableText>
      </YStack>

      <XStack gap="$2.5" width="100%" flexWrap="wrap">
        <StatBox label="REFERENCE" value={result.reference} />
        <StatBox label="INCOME" value={formatSubmissionAmount(result.incomeTotal)} />
        <StatBox
          label="ALLOWABLE EXPENSES"
          value={formatSubmissionAmount(result.expenseTotal)}
        />
        <StatBox
          label="TAXABLE PROFIT"
          value={formatSubmissionAmount(result.taxableProfit)}
        />
        <StatBox
          label="TAX DUE"
          value={formatSubmissionAmount(result.taxDue)}
          valueColor={MTD_TOKENS.green}
        />
      </XStack>

      <YStack gap="$2" items="center" pt="$1">
        <SizableText fontSize={12} color={MTD_TOKENS.textSubtle} text="center">
          Demo only — nothing was sent to HMRC.
        </SizableText>
        <SizableText
          fontSize={14}
          fontWeight="600"
          color={MTD_TOKENS.orange}
          cursor="pointer"
          onPress={onStartAgain}
          pressStyle={{ opacity: 0.85 }}
        >
          Start again
        </SizableText>
      </YStack>
    </YStack>
  )
}
