import { useState } from 'react'
import { SizableText, XStack, YStack } from 'tamagui'

import { toastError, toastSuccess } from '~/features/engine/client/engineToast'
import {
  formatMinor,
  formatNumber,
  formatShortDay,
  formatSignedMinor,
} from '~/features/engine/client/format'
import {
  ATTRIBUTION_MODEL_HELP,
  ATTRIBUTION_MODEL_OPTIONS,
  PERIOD_OPTIONS,
  channelLabel,
  periodRange,
} from '~/features/engine/client/measureDisplay'
import {
  useAttribution,
  useIncremental,
  useMetricsDaily,
  useRunRollup,
} from '~/features/engine/client/useEngineMeasure'
import {
  useEngineRole,
  useEngineWorkspace,
} from '~/features/engine/client/useEngineWorkspaces'
import { describeInterval } from '~/features/engine/components/CiBar'
import {
  ChipGroup,
  EmptyState,
  EngineCard,
  EnginePage,
  EngineRow,
  EngineSection,
  ErrorState,
  HelpText,
  LoadingState,
} from '~/features/engine/components/EngineUi'
import { IncrementalCard } from '~/features/engine/components/IncrementalCard'
import { TrendBars } from '~/features/engine/components/TrendBars'
import { MtdActionButton } from '~/features/mtd/components/MtdActionButton'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { ArrowsClockwiseIcon } from '~/interface/icons/phosphor/ArrowsClockwiseIcon'
import { CaretDownIcon } from '~/interface/icons/phosphor/CaretDownIcon'
import { CaretRightIcon } from '~/interface/icons/phosphor/CaretRightIcon'
import { InfoIcon } from '~/interface/icons/phosphor/InfoIcon'
import { WarningCircleIcon } from '~/interface/icons/phosphor/WarningCircleIcon'
import { WarningIcon } from '~/interface/icons/phosphor/WarningIcon'

import type { MeasurePeriod } from '~/features/engine/client/measureDisplay'
import type {
  AttributionChannelDto,
  AttributionModelValue,
  AttributionReportDto,
} from '~/features/engine/contract'
import type { IconComponent } from '~/interface/icons/types'
import type { ColorTokens } from 'tamagui'

type FlagLevel = AttributionChannelDto['flags'][number]['level']

const FLAG_STYLE: Record<FlagLevel, { color: ColorTokens; icon: IconComponent }> = {
  info: { color: '$blue10', icon: InfoIcon },
  warning: { color: '$yellow10', icon: WarningIcon },
  critical: { color: '$red10', icon: WarningCircleIcon },
}

const COLUMNS: { label: string; flex: number }[] = [
  { label: 'Channel', flex: 1.4 },
  { label: 'Spend', flex: 1 },
  { label: 'First-party', flex: 1.4 },
  { label: 'Platform claims', flex: 1.4 },
  { label: 'Experiment lift', flex: 2 },
  { label: 'MMM', flex: 0.8 },
]

function CellText({
  children,
  flex,
  muted,
}: {
  children: string
  flex: number
  muted?: boolean
}) {
  return (
    <SizableText
      fontSize={13}
      color={muted ? MTD_TOKENS.textSubtle : MTD_TOKENS.text}
      flex={flex}
      lineHeight={18}
    >
      {children}
    </SizableText>
  )
}

function ChannelRow({
  channel,
  report,
  isLast,
}: {
  channel: AttributionChannelDto
  report: AttributionReportDto
  isLast: boolean
}) {
  const [open, setOpen] = useState(false)
  const money = (minor: number) => formatMinor(minor, report.currency)
  const Caret = open ? CaretDownIcon : CaretRightIcon
  const experiment = channel.experiment

  return (
    <YStack borderBottomWidth={isLast ? 0 : 1} borderBottomColor={MTD_TOKENS.cardBorder}>
      <EngineRow
        isLast
        cursor="pointer"
        hoverStyle={{ bg: MTD_TOKENS.cardInset }}
        onPress={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={`${channelLabel(channel.channelKey)}, show credit under every model`}
        flexDirection="column"
        items="stretch"
        gap="$1"
        $md={{ flexDirection: 'row', items: 'center', gap: '$3' }}
      >
        <XStack flex={1.4} items="center" gap="$1.5">
          <Caret size={12} color={MTD_TOKENS.textSubtle} />
          <SizableText fontSize={14} fontWeight="600" color={MTD_TOKENS.text}>
            {channelLabel(channel.channelKey)}
          </SizableText>
        </XStack>
        <CellText flex={1}>{money(channel.spendMinor)}</CellText>
        <CellText flex={1.4}>
          {`${money(channel.firstParty.grossProfitMinor)} GP · ${formatNumber(
            Math.round(channel.firstParty.conversions * 10) / 10,
          )} conv.`}
        </CellText>
        <CellText flex={1.4} muted={!channel.platform}>
          {channel.platform
            ? `${formatNumber(channel.platform.conversions)} conv. · ${money(
                channel.platform.revenueMinor,
              )} revenue`
            : 'Not reported'}
        </CellText>
        <CellText flex={2} muted={!experiment}>
          {experiment
            ? `${describeInterval({
                estimate: experiment.incrementalGrossProfitMinor,
                low: experiment.ciLowMinor,
                high: experiment.ciHighMinor,
                format: (value) => formatSignedMinor(value, report.currency),
              })} from ${formatNumber(experiment.experiments)} experiment${
                experiment.experiments === 1 ? '' : 's'
              }`
            : 'No experiment'}
        </CellText>
        <CellText flex={0.8} muted>
          {channel.mmm
            ? formatSignedMinor(channel.mmm.contributionMinor, report.currency)
            : 'Phase 7'}
        </CellText>
      </EngineRow>

      {channel.flags.length ? (
        <YStack px="$3.5" pb="$2.5" gap="$1.5">
          {channel.flags.map((flag) => {
            const style = FLAG_STYLE[flag.level]
            const Icon = style.icon
            return (
              <XStack
                key={flag.code}
                gap="$2"
                items="flex-start"
                pl="$2.5"
                borderLeftWidth={2}
                borderLeftColor={style.color}
              >
                <Icon size={14} color={style.color} />
                <SizableText
                  fontSize={12}
                  color={MTD_TOKENS.text}
                  flex={1}
                  lineHeight={16}
                >
                  <SizableText fontSize={12} fontWeight="600" color={MTD_TOKENS.text}>
                    {flag.level === 'critical'
                      ? 'Critical: '
                      : flag.level === 'warning'
                        ? 'Warning: '
                        : 'Note: '}
                  </SizableText>
                  {flag.message}
                </SizableText>
              </XStack>
            )
          })}
        </YStack>
      ) : null}

      {open ? (
        <YStack mx="$3.5" mb="$3" bg={MTD_TOKENS.cardInset} rounded="$3" px="$3" py="$2">
          <HelpText>First-party credit under every model</HelpText>
          {ATTRIBUTION_MODEL_OPTIONS.map((model) => {
            const credit = channel.byModel[model.id]
            const selected = model.id === report.model
            return (
              <XStack key={model.id} py="$1" gap="$3" items="center">
                <SizableText
                  fontSize={12}
                  color={MTD_TOKENS.text}
                  fontWeight={selected ? '700' : '400'}
                  flex={1}
                >
                  {model.label}
                  {selected ? ' (shown)' : ''}
                </SizableText>
                <SizableText
                  fontSize={12}
                  color={MTD_TOKENS.textMuted}
                  fontFamily="$mono"
                >
                  {credit
                    ? `${formatNumber(Math.round(credit.conversions * 10) / 10)} conv.`
                    : '—'}
                </SizableText>
                <SizableText
                  fontSize={12}
                  color={MTD_TOKENS.text}
                  fontFamily="$mono"
                  width={110}
                  text="right"
                >
                  {credit ? money(credit.grossProfitMinor) : '—'}
                </SizableText>
              </XStack>
            )
          })}
        </YStack>
      ) : null}
    </YStack>
  )
}

function Triangulation({
  report,
  isFetching,
}: {
  report: AttributionReportDto
  isFetching: boolean
}) {
  const { totals } = report
  return (
    <YStack gap="$2.5">
      <HelpText>
        {formatNumber(totals.outcomes)} outcomes,{' '}
        {formatNumber(totals.attributedOutcomes)} with a touch in the{' '}
        {report.lookbackDays}-day lookback and {formatNumber(totals.unattributedOutcomes)}{' '}
        without. {formatMinor(totals.grossProfitMinor, report.currency)} gross profit in
        total. The columns are shown side by side and never blended; flags mark where they
        disagree.
        {isFetching ? ' Updating…' : ''}
      </HelpText>
      <EngineCard>
        <EngineRow bg={MTD_TOKENS.cardInset} display="none" $md={{ display: 'flex' }}>
          {COLUMNS.map((column) => (
            <SizableText
              key={column.label}
              fontSize={11}
              fontWeight="600"
              color={MTD_TOKENS.textSubtle}
              textTransform="uppercase"
              letterSpacing={0.6}
              flex={column.flex}
            >
              {column.label}
            </SizableText>
          ))}
        </EngineRow>
        {report.channels.length === 0 ? (
          <EmptyState
            title="No channel activity in this period"
            description="Spend, touches and platform reports appear here once channels sync."
          />
        ) : (
          report.channels.map((channel, index) => (
            <ChannelRow
              key={channel.channelKey}
              channel={channel}
              report={report}
              isLast={index === report.channels.length - 1}
            />
          ))
        )}
      </EngineCard>
    </YStack>
  )
}

function IncrementalSection({
  workspaceId,
  range,
}: {
  workspaceId: string
  range: { from: string; to: string }
}) {
  const { report, isLoading, isError, error, refetch } = useIncremental(
    workspaceId,
    range,
  )
  if (isLoading) {
    return (
      <EngineCard>
        <LoadingState label="Measuring against the holdout…" />
      </EngineCard>
    )
  }
  if (isError) {
    return (
      <EngineCard>
        <ErrorState error={error} retry={() => void refetch()} />
      </EngineCard>
    )
  }
  if (!report) return null
  return <IncrementalCard report={report} />
}

function TrendSection({
  workspaceId,
  range,
  currency,
}: {
  workspaceId: string
  range: { from: string; to: string }
  currency: string
}) {
  const { rows, isLoading, isError, error, refetch } = useMetricsDaily(workspaceId, {
    ...range,
    channelKey: 'all',
  })
  const points = [...rows]
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((row) => ({
      key: row.day,
      label: formatShortDay(row.day),
      value: row.grossProfitMinor,
    }))

  return (
    <EngineCard p="$3.5">
      {isLoading ? <LoadingState label="Loading daily metrics…" /> : null}
      {isError ? <ErrorState error={error} retry={() => void refetch()} /> : null}
      {!isLoading && !isError && points.length === 0 ? (
        <EmptyState
          title="No daily metrics for this period"
          description="Metrics roll up nightly. An admin can recompute them now."
        />
      ) : null}
      {points.length ? (
        <TrendBars
          points={points}
          title="Daily gross profit, all channels"
          format={(value) => formatMinor(value, currency)}
        />
      ) : null}
    </EngineCard>
  )
}

export function EngineMeasurementScreen({ workspaceId }: { workspaceId: string }) {
  const { workspace } = useEngineWorkspace(workspaceId)
  const { isAdmin } = useEngineRole(workspaceId)
  const [period, setPeriod] = useState<MeasurePeriod>('4w')
  const [model, setModel] = useState<AttributionModelValue>('last_touch')
  const range = periodRange(period)
  const attribution = useAttribution(workspaceId, { ...range, model })
  const rollup = useRunRollup(workspaceId)
  const currency = workspace?.currency ?? attribution.report?.currency ?? 'GBP'

  const recompute = async () => {
    try {
      const result = await rollup.mutateAsync(range)
      toastSuccess(
        `Recomputed ${formatNumber(result.days)} days (${formatNumber(result.rows)} rows)`,
      )
    } catch (error) {
      toastError(error, 'Failed to recompute metrics')
    }
  }

  return (
    <EnginePage
      title="Measurement"
      subtitle="What marketing added, measured against people who got none of it. Platform numbers sit beside it, never blended in."
      actions={
        isAdmin ? (
          <MtdActionButton
            size="compact"
            variant="secondary"
            loading={rollup.isPending}
            icon={<ArrowsClockwiseIcon size={14} color={MTD_TOKENS.text} />}
            onPress={() => void recompute()}
          >
            Recompute metrics
          </MtdActionButton>
        ) : null
      }
    >
      <XStack gap="$4" flexWrap="wrap" items="center">
        <ChipGroup options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
        <HelpText>{formatShortDay(range.from)} to today (UTC)</HelpText>
      </XStack>

      <YStack gap="$5">
        <EngineSection title="Incremental profit">
          <IncrementalSection workspaceId={workspaceId} range={range} />
        </EngineSection>

        <EngineSection title="Triangulation by channel">
          <YStack gap="$2">
            <ChipGroup
              options={ATTRIBUTION_MODEL_OPTIONS}
              value={model}
              onChange={setModel}
            />
            <HelpText>{ATTRIBUTION_MODEL_HELP[model]}</HelpText>
          </YStack>
          {attribution.isLoading ? (
            <EngineCard>
              <LoadingState label="Loading attribution…" />
            </EngineCard>
          ) : null}
          {attribution.isError ? (
            <EngineCard>
              <ErrorState
                error={attribution.error}
                retry={() => void attribution.refetch()}
              />
            </EngineCard>
          ) : null}
          {attribution.report ? (
            <Triangulation
              report={attribution.report}
              isFetching={attribution.isFetching}
            />
          ) : null}
        </EngineSection>

        <EngineSection title="Daily gross profit">
          <TrendSection workspaceId={workspaceId} range={range} currency={currency} />
        </EngineSection>
      </YStack>
    </EnginePage>
  )
}
