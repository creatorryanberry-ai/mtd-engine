import { useState } from 'react'
import { SizableText, XStack, YStack } from 'tamagui'

import {
  formatMinor,
  formatNumber,
  formatPercent,
  formatPoints,
} from '~/features/engine/client/format'
import { METRIC_OPTIONS } from '~/features/engine/client/measureDisplay'
import {
  ChipGroup,
  EngineCard,
  Field,
  HelpText,
  StatTile,
} from '~/features/engine/components/EngineUi'
import {
  minimumDetectableMean,
  sampleSizeForConversion,
  sampleSizeForMean,
} from '~/features/engine/measure/stats'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { Input } from '~/interface/forms/Input'

import type { ExperimentMetric } from '~/features/engine/client/measureDisplay'

function parse(value: string) {
  const parsed = Number.parseFloat(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * live power calculation with the same stats module the server uses:
 * two-sided 95% confidence and 80% power.
 */
export function SampleSizeCalculator({
  currency,
  contactsTotal,
  globalHoldoutRate,
}: {
  currency: string
  contactsTotal: number | null
  globalHoldoutRate: number
}) {
  const [metric, setMetric] = useState<ExperimentMetric>('incremental_gross_profit')
  const [baselineRatePct, setBaselineRatePct] = useState('3')
  const [relativeLiftPct, setRelativeLiftPct] = useState('10')
  const [sdMajor, setSdMajor] = useState('40')
  const [effectMajor, setEffectMajor] = useState('2')
  const [holdoutPct, setHoldoutPct] = useState('10')

  const holdout = parse(holdoutPct)
  const baselineShare =
    holdout != null && holdout > 0 && holdout < 100 ? holdout / 100 : null
  const isConversion = metric === 'conversion_rate'
  const baselineRate = (parse(baselineRatePct) ?? Number.NaN) / 100
  const relativeLift = (parse(relativeLiftPct) ?? Number.NaN) / 100
  const sdMinor = (parse(sdMajor) ?? Number.NaN) * 100
  const effectMinor = (parse(effectMajor) ?? Number.NaN) * 100

  const plan =
    baselineShare == null
      ? null
      : isConversion
        ? sampleSizeForConversion({ baselineRate, relativeLift, baselineShare })
        : sampleSizeForMean({
            standardDeviation: sdMinor,
            minimumEffect: effectMinor,
            baselineShare,
          })

  // experiments never draw from the permanent holdout
  const eligible =
    contactsTotal == null ? null : Math.floor(contactsTotal * (1 - globalHoldoutRate))

  let mdeText: string | null = null
  let mdeSub: string | null = null
  if (eligible != null && eligible > 0 && baselineShare != null) {
    if (isConversion) {
      const sd =
        baselineRate > 0 && baselineRate < 1
          ? Math.sqrt(baselineRate * (1 - baselineRate))
          : Number.NaN
      const absolute = minimumDetectableMean({
        standardDeviation: sd,
        total: eligible,
        baselineShare,
      })
      if (absolute != null) {
        mdeText = formatPoints(absolute)
        mdeSub = `about ${formatPercent(absolute / baselineRate, 0)} relative lift on a ${formatPercent(
          baselineRate,
        )} baseline`
      }
    } else {
      const absolute = minimumDetectableMean({
        standardDeviation: sdMinor,
        total: eligible,
        baselineShare,
      })
      if (absolute != null) {
        const treated = Math.max(0, eligible - Math.ceil(eligible * baselineShare))
        mdeText = `${formatMinor(Math.ceil(absolute), currency)} per contact`
        mdeSub = `about ${formatMinor(Math.ceil(absolute * treated), currency)} across ${formatNumber(
          treated,
        )} treated contacts`
      }
    }
  }

  const shortfall = plan && eligible != null && plan.total > eligible

  return (
    <EngineCard p="$3.5" gap="$3.5">
      <ChipGroup options={METRIC_OPTIONS} value={metric} onChange={setMetric} />
      <XStack gap="$3" flexWrap="wrap">
        {isConversion ? (
          <>
            <Field label="Baseline conversion rate (%)">
              <Input
                width="100%"
                value={baselineRatePct}
                onChangeText={setBaselineRatePct}
                inputMode="decimal"
              />
            </Field>
            <Field label="Minimum relative lift (%)">
              <Input
                width="100%"
                value={relativeLiftPct}
                onChangeText={setRelativeLiftPct}
                inputMode="decimal"
              />
            </Field>
          </>
        ) : (
          <>
            <Field label={`Gross profit SD per contact (${currency})`}>
              <Input
                width="100%"
                value={sdMajor}
                onChangeText={setSdMajor}
                inputMode="decimal"
              />
            </Field>
            <Field label={`Minimum effect per contact (${currency})`}>
              <Input
                width="100%"
                value={effectMajor}
                onChangeText={setEffectMajor}
                inputMode="decimal"
              />
            </Field>
          </>
        )}
        <Field label="Holdout or control share (%)">
          <Input
            width="100%"
            value={holdoutPct}
            onChangeText={setHoldoutPct}
            inputMode="decimal"
          />
        </Field>
      </XStack>

      {plan ? (
        <XStack gap="$3" flexWrap="wrap">
          <StatTile label="Total contacts" value={formatNumber(plan.total)} />
          <StatTile label="Holdout or control" value={formatNumber(plan.baseline)} />
          <StatTile label="Treatment" value={formatNumber(plan.treatment)} />
        </XStack>
      ) : (
        <SizableText fontSize={13} color={MTD_TOKENS.orange}>
          {baselineShare == null
            ? 'Set a holdout or control share between 0% and 100%.'
            : isConversion
              ? 'Enter a baseline rate between 0% and 100% and a non-zero lift that keeps the rate below 100%.'
              : 'Enter a positive standard deviation and a non-zero effect.'}
        </SizableText>
      )}

      {shortfall ? (
        <SizableText fontSize={13} color={MTD_TOKENS.orange}>
          That needs more contacts than the {formatNumber(eligible ?? 0)} eligible in this
          workspace. Aim for a bigger effect or run the test for longer.
        </SizableText>
      ) : null}

      <YStack gap="$1" bg={MTD_TOKENS.cardInset} rounded="$3" p="$3">
        <SizableText
          fontSize={11}
          fontWeight="600"
          color={MTD_TOKENS.textSubtle}
          textTransform="uppercase"
          letterSpacing={0.6}
        >
          Smallest detectable effect with your contacts
        </SizableText>
        {eligible == null ? (
          <SizableText fontSize={13} color={MTD_TOKENS.textMuted}>
            Waiting for the contact count…
          </SizableText>
        ) : mdeText ? (
          <>
            <SizableText fontSize={18} fontWeight="700" color={MTD_TOKENS.text}>
              {mdeText}
            </SizableText>
            {mdeSub ? <HelpText>{mdeSub}</HelpText> : null}
            <HelpText>
              Using {formatNumber(eligible)} contacts: everyone except the{' '}
              {formatPercent(globalHoldoutRate)} permanent holdout.
              {isConversion ? ' Normal approximation.' : ''}
            </HelpText>
          </>
        ) : (
          <SizableText fontSize={13} color={MTD_TOKENS.textMuted}>
            {eligible === 0 ? 'No eligible contacts yet.' : 'Fill in the inputs above.'}
          </SizableText>
        )}
      </YStack>

      <HelpText>
        95% confidence, two-sided, with 80% power, matching the intervals the engine
        reports. Every group must also reach the experiment's minimum sample before a
        result is called. Get the gross profit SD from a past experiment's groups table.
      </HelpText>
    </EngineCard>
  )
}
