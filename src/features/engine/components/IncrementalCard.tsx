import { SizableText, XStack, YStack } from 'tamagui'

import {
  formatDate,
  formatMinor,
  formatNumber,
  formatPercent,
  formatPValue,
  formatSignedMinor,
} from '~/features/engine/client/format'
import { CiBar } from '~/features/engine/components/CiBar'
import { EngineCard, HelpText } from '~/features/engine/components/EngineUi'
import { VerdictPill } from '~/features/engine/components/VerdictPill'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'

import type { IncrementalReportDto } from '~/features/engine/contract'
import type { ReactNode } from 'react'

function Figure({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <YStack gap="$0.5" minW={130} flexBasis={150} grow={1}>
      <SizableText
        fontSize={11}
        fontWeight="600"
        color={MTD_TOKENS.textSubtle}
        textTransform="uppercase"
        letterSpacing={0.6}
      >
        {label}
      </SizableText>
      <SizableText fontSize={15} fontWeight="600" color={MTD_TOKENS.text}>
        {value}
      </SizableText>
      {sub ? <HelpText>{sub}</HelpText> : null}
    </YStack>
  )
}

/** workspace incremental gross profit against the permanent holdout */
export function IncrementalCard({
  report,
  footer,
}: {
  report: IncrementalReportDto
  footer?: ReactNode
}) {
  const money = (minor: number) => formatMinor(minor, report.currency)
  const signed = (minor: number) => formatSignedMinor(minor, report.currency)

  return (
    <EngineCard p="$3.5" gap="$3.5">
      <XStack items="flex-start" justify="space-between" gap="$3" flexWrap="wrap">
        <YStack gap="$1" flex={1} minW={200}>
          <SizableText
            fontSize={11}
            fontWeight="600"
            color={MTD_TOKENS.textSubtle}
            textTransform="uppercase"
            letterSpacing={0.6}
          >
            Incremental gross profit
          </SizableText>
          <SizableText
            fontSize={26}
            fontWeight="700"
            color={MTD_TOKENS.text}
            lineHeight={32}
          >
            {report.incrementalMinor == null ? '—' : signed(report.incrementalMinor)}
          </SizableText>
          <HelpText>
            (Treated mean − holdout mean) × treated contacts,{' '}
            {formatDate(report.windowFrom)} to {formatDate(report.windowTo)} ·{' '}
            {formatPValue(report.pValue)}
          </HelpText>
        </YStack>
        <YStack maxW={360} flex={1} minW={200}>
          <VerdictPill verdict={report.verdict} showHelp />
        </YStack>
      </XStack>

      <CiBar
        estimate={report.incrementalMinor}
        low={report.ciLowMinor}
        high={report.ciHighMinor}
        verdict={report.verdict}
        format={signed}
        label="Incremental gross profit"
        emphasis
      />

      <XStack gap="$4" flexWrap="wrap">
        <Figure
          label="Treated, per contact"
          value={money(report.treatedMeanMinor)}
          sub={`${formatNumber(report.treatedContacts)} contacts`}
        />
        <Figure
          label="Holdout, per contact"
          value={money(report.holdoutMeanMinor)}
          sub={`${formatNumber(report.holdoutContacts)} contacts (${formatPercent(
            report.holdoutRate,
          )} rate)`}
        />
        <Figure
          label="Unmatched orders"
          value={formatNumber(report.unattributedOrders)}
          sub="Not tied to a contact, so not in either group"
        />
      </XStack>

      {report.note ? (
        <SizableText fontSize={13} color={MTD_TOKENS.textMuted} lineHeight={18}>
          {report.note}
        </SizableText>
      ) : null}
      {footer}
    </EngineCard>
  )
}
