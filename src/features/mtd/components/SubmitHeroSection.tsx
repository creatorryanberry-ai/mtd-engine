import { SizableText, XStack, YStack } from 'tamagui'

import type { QuarterlySummary } from '~/features/submission/server/submissionService'
import { formatDisplayTaxYear } from '../utils/quarterPeriods'
import { MTD_TOKENS } from '../mtdTokens'
import { MtdAccentMutedBg } from './MtdAccentMutedBg'
import { ShieldIcon } from '~/interface/icons/phosphor/ShieldIcon'

type SubmitHeroSectionProps = {
  summary: QuarterlySummary
}

export function SubmitHeroSection({ summary }: SubmitHeroSectionProps) {
  const { quarter } = summary

  return (
    <XStack
      gap="$4"
      items="flex-start"
      justify="space-between"
      flexDirection="column"
      $md={{ flexDirection: 'row', items: 'center' }}
    >
      <YStack gap="$2.5" flex={1} maxW={520} pt="$1">
        <SizableText
          fontSize={12}
          fontWeight="600"
          color={MTD_TOKENS.orange}
          letterSpacing={1}
        >
          STEP 3 OF 3
        </SizableText>
        <SizableText fontSize={14} color={MTD_TOKENS.textMuted} lineHeight={20}>
          {quarter.hmrcUpdatePeriodLabel} · Tax year{' '}
          {formatDisplayTaxYear(quarter.taxYearStart)}
        </SizableText>
      </YStack>

      <XStack
        bg={MTD_TOKENS.card}
        borderWidth={1}
        borderColor={MTD_TOKENS.cardBorder}
        rounded="$4"
        px="$3.5"
        py="$3"
        gap="$3"
        items="center"
        width="100%"
        $md={{ width: 'auto', maxW: 320 }}
      >
        <MtdAccentMutedBg width={44} height={44} rounded="$10" shrink={0}>
          <ShieldIcon size={22} color={MTD_TOKENS.orange} />
        </MtdAccentMutedBg>
        <YStack gap="$0.5" flex={1}>
          <SizableText fontSize={14} fontWeight="600" color={MTD_TOKENS.text}>
            {quarter.label} · {formatDisplayTaxYear(quarter.taxYearStart)}
          </SizableText>
          <SizableText fontSize={12} color={MTD_TOKENS.orange}>
            Due {quarter.deadlineLabel}
          </SizableText>
        </YStack>
      </XStack>
    </XStack>
  )
}
