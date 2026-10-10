import { Link } from 'one'
import { useState } from 'react'
import { SizableText, XStack, YStack } from 'tamagui'

import { toastError, toastSuccess } from '~/features/engine/client/engineToast'
import { ENGINE_ROUTES } from '~/features/engine/client/engineRoutes'
import {
  formatDate,
  formatDateTime,
  formatMinor,
  formatNumber,
  formatPercent,
  formatProbability,
  formatPValue,
  formatSignedMinor,
  formatSignedPercent,
  titleCase,
} from '~/features/engine/client/format'
import {
  channelLabel,
  experimentStatusTone,
  formatComparisonValue,
  groupLabel,
  kindLabel,
  metricLabel,
  transitionsFor,
} from '~/features/engine/client/measureDisplay'
import {
  useChannelOptions,
  useEngineExperiment,
  useExperimentAssignment,
  useRefreshExperiment,
  useTransitionExperiment,
} from '~/features/engine/client/useEngineMeasure'
import { useEngineRole } from '~/features/engine/client/useEngineWorkspaces'
import { CiBar, ciDomain } from '~/features/engine/components/CiBar'
import {
  EmptyState,
  EngineCard,
  EnginePage,
  EngineRow,
  EngineSection,
  ErrorState,
  HelpText,
  LoadingState,
  StatusPill,
} from '~/features/engine/components/EngineUi'
import { ExperimentForm } from '~/features/engine/components/ExperimentForm'
import { VerdictPill } from '~/features/engine/components/VerdictPill'
import { MtdActionButton } from '~/features/mtd/components/MtdActionButton'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { dialogConfirm } from '~/interface/dialogs/actions'
import { Input } from '~/interface/forms/Input'
import { ArrowsClockwiseIcon } from '~/interface/icons/phosphor/ArrowsClockwiseIcon'
import { CaretLeftIcon } from '~/interface/icons/phosphor/CaretLeftIcon'
import { WarningIcon } from '~/interface/icons/phosphor/WarningIcon'

import type {
  ExperimentComparison,
  TransitionAction,
} from '~/features/engine/client/measureDisplay'
import type { EngineExperimentDto, ExperimentResultDto } from '~/features/engine/contract'

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <YStack gap="$0.5" minW={140} flexBasis={160} grow={1}>
      <SizableText
        fontSize={11}
        fontWeight="600"
        color={MTD_TOKENS.textSubtle}
        textTransform="uppercase"
        letterSpacing={0.6}
      >
        {label}
      </SizableText>
      <SizableText fontSize={14} color={MTD_TOKENS.text}>
        {value}
      </SizableText>
    </YStack>
  )
}

function ConfigSummary({ experiment }: { experiment: EngineExperimentDto }) {
  const { audience } = experiment
  const stages = audience.lifecycleStages?.length
    ? audience.lifecycleStages.map(titleCase).join(', ')
    : 'Every stage'
  const consent = audience.requireConsentChannel
    ? `, ${titleCase(audience.requireConsentChannel)} consent required`
    : ''
  const arms = experiment.arms
    .map(
      (arm) =>
        `${arm.name}${arm.isControl ? ' (control)' : ''} · weight ${formatNumber(
          arm.weight,
        )}`,
    )
    .join('\n')

  return (
    <EngineCard p="$3.5" gap="$3.5">
      <XStack gap="$4" flexWrap="wrap">
        <SummaryItem label="Kind" value={kindLabel(experiment.kind)} />
        <SummaryItem
          label="Success metric"
          value={metricLabel(experiment.successMetric)}
        />
        <SummaryItem label="Channel" value={channelLabel(experiment.channelKey)} />
        <SummaryItem label="Holdout" value={formatPercent(experiment.holdoutRate)} />
      </XStack>
      <XStack gap="$4" flexWrap="wrap">
        <SummaryItem
          label="Minimum sample per arm"
          value={formatNumber(experiment.minSamplePerArm)}
        />
        <SummaryItem label="Assigned" value={formatNumber(experiment.assignedCount)} />
        <SummaryItem label="Started" value={formatDate(experiment.startsAt)} />
        <SummaryItem
          label="Ends"
          value={experiment.endsAt ? formatDate(experiment.endsAt) : 'No end date'}
        />
      </XStack>
      <XStack gap="$4" flexWrap="wrap">
        <SummaryItem label="Audience" value={`${stages}${consent}`} />
        <SummaryItem label="Arms" value={arms || 'Created on start'} />
      </XStack>
    </EngineCard>
  )
}

function isSameComparison(a: ExperimentComparison, b: ExperimentComparison | null) {
  return (
    !!b &&
    a.treatmentKey === b.treatmentKey &&
    a.baselineKey === b.baselineKey &&
    a.metric === b.metric
  )
}

function ComparisonMetric({
  comparison,
  result,
  domain,
  isPrimary,
}: {
  comparison: ExperimentComparison
  result: ExperimentResultDto
  domain: [number, number]
  isPrimary: boolean
}) {
  const format = (value: number) =>
    formatComparisonValue(comparison.metric, value, result.currency)
  const isGp = comparison.metric === 'gross_profit_per_contact'
  const relative =
    comparison.relativeLift == null
      ? null
      : `${formatSignedPercent(comparison.relativeLift)}${
          comparison.relativeCiLow != null && comparison.relativeCiHigh != null
            ? ` (${formatSignedPercent(comparison.relativeCiLow)} to ${formatSignedPercent(
                comparison.relativeCiHigh,
              )})`
            : ''
        }`

  return (
    <YStack
      gap="$2"
      p="$3"
      rounded="$3"
      borderWidth={1}
      borderColor={isPrimary ? MTD_TOKENS.orange : MTD_TOKENS.cardBorder}
      bg={isPrimary ? MTD_TOKENS.cardInset : 'transparent'}
    >
      <XStack items="center" justify="space-between" gap="$2" flexWrap="wrap">
        <XStack items="center" gap="$2">
          <SizableText fontSize={13} fontWeight="600" color={MTD_TOKENS.text}>
            {metricLabel(comparison.metric)}
          </SizableText>
          {isPrimary ? <StatusPill label="primary" tone="orange" /> : null}
        </XStack>
        <VerdictPill verdict={comparison.verdict} />
      </XStack>
      <CiBar
        estimate={comparison.diff}
        low={comparison.ciLow}
        high={comparison.ciHigh}
        verdict={comparison.verdict}
        format={format}
        domain={domain}
        emphasis={isPrimary}
        label={`${metricLabel(comparison.metric)} difference`}
      />
      <XStack gap="$4" flexWrap="wrap">
        <HelpText>Relative lift {relative ?? 'n/a'}</HelpText>
        <HelpText>{formatPValue(comparison.pValue)}</HelpText>
        {comparison.probabilityBetter != null ? (
          <HelpText>
            {formatProbability(comparison.probabilityBetter)} chance treatment beats{' '}
            {groupLabel(result, comparison.baselineKey).toLowerCase()}
          </HelpText>
        ) : null}
      </XStack>
      {isGp && comparison.incrementalGrossProfitMinor != null ? (
        <SizableText fontSize={13} color={MTD_TOKENS.text}>
          Incremental gross profit{' '}
          {formatSignedMinor(comparison.incrementalGrossProfitMinor, result.currency)}
          {comparison.incrementalCiLowMinor != null &&
          comparison.incrementalCiHighMinor != null
            ? ` (95% CI ${formatSignedMinor(
                comparison.incrementalCiLowMinor,
                result.currency,
              )} to ${formatSignedMinor(comparison.incrementalCiHighMinor, result.currency)})`
            : ''}
        </SizableText>
      ) : null}
    </YStack>
  )
}

function Comparisons({ result }: { result: ExperimentResultDto }) {
  const pairs = new Map<string, ExperimentComparison[]>()
  for (const comparison of result.comparisons) {
    const key = `${comparison.treatmentKey}|${comparison.baselineKey}`
    pairs.set(key, [...(pairs.get(key) ?? []), comparison])
  }
  const domains = new Map<string, [number, number]>()
  for (const metric of ['gross_profit_per_contact', 'conversion_rate'] as const) {
    const rows = result.comparisons.filter((comparison) => comparison.metric === metric)
    domains.set(
      metric,
      ciDomain(rows.flatMap((row) => [row.diff, row.ciLow, row.ciHigh])),
    )
  }

  if (pairs.size === 0) {
    return (
      <EngineCard>
        <EmptyState
          title="No comparisons yet"
          description="Groups need contacts first."
        />
      </EngineCard>
    )
  }

  return (
    <YStack gap="$3">
      {[...pairs.entries()].map(([key, comparisons]) => {
        const first = comparisons[0]!
        const ordered = [...comparisons].sort(
          (a, b) =>
            Number(isSameComparison(b, result.primary)) -
            Number(isSameComparison(a, result.primary)),
        )
        return (
          <EngineCard key={key} p="$3.5" gap="$3">
            <SizableText fontSize={14} fontWeight="600" color={MTD_TOKENS.text}>
              {groupLabel(result, first.treatmentKey)} vs{' '}
              {groupLabel(result, first.baselineKey)}
            </SizableText>
            {ordered.map((comparison) => (
              <ComparisonMetric
                key={comparison.metric}
                comparison={comparison}
                result={result}
                domain={domains.get(comparison.metric) ?? [-1, 1]}
                isPrimary={isSameComparison(comparison, result.primary)}
              />
            ))}
          </EngineCard>
        )
      })}
    </YStack>
  )
}

function GroupsTable({ result }: { result: ExperimentResultDto }) {
  const money = (minor: number) => formatMinor(minor, result.currency)
  const cells: { label: string; flex: number }[] = [
    { label: 'Group', flex: 2 },
    { label: 'Contacts', flex: 1 },
    { label: 'Conversions', flex: 1 },
    { label: 'Conv. rate', flex: 1 },
    { label: 'Gross profit', flex: 1 },
    { label: 'Per contact', flex: 1 },
    { label: 'SD', flex: 1 },
  ]
  return (
    <EngineCard>
      <EngineRow bg={MTD_TOKENS.cardInset} display="none" $md={{ display: 'flex' }}>
        {cells.map((cell) => (
          <SizableText
            key={cell.label}
            fontSize={11}
            fontWeight="600"
            color={MTD_TOKENS.textSubtle}
            textTransform="uppercase"
            letterSpacing={0.6}
            flex={cell.flex}
          >
            {cell.label}
          </SizableText>
        ))}
      </EngineRow>
      {result.groups.map((group, index) => (
        <EngineRow
          key={group.key}
          isLast={index === result.groups.length - 1}
          flexDirection="column"
          items="stretch"
          gap="$1"
          $md={{ flexDirection: 'row', items: 'center', gap: '$3' }}
        >
          <XStack flex={2} gap="$2" items="center" flexWrap="wrap">
            <SizableText fontSize={13} fontWeight="600" color={MTD_TOKENS.text}>
              {group.label}
            </SizableText>
            {group.isHoldout ? <StatusPill label="holdout" tone="muted" /> : null}
            {group.isControl ? <StatusPill label="control" tone="muted" /> : null}
          </XStack>
          <SizableText fontSize={13} color={MTD_TOKENS.text} flex={1}>
            {formatNumber(group.n)}
          </SizableText>
          <SizableText fontSize={13} color={MTD_TOKENS.text} flex={1}>
            {formatNumber(group.conversions)}
          </SizableText>
          <SizableText fontSize={13} color={MTD_TOKENS.text} flex={1}>
            {formatPercent(group.conversionRate, 2)}
          </SizableText>
          <SizableText fontSize={13} color={MTD_TOKENS.text} flex={1}>
            {money(group.grossProfitMinor)}
          </SizableText>
          <SizableText fontSize={13} color={MTD_TOKENS.text} flex={1}>
            {money(group.meanGrossProfitMinor)}
          </SizableText>
          <SizableText fontSize={13} color={MTD_TOKENS.textMuted} flex={1}>
            {money(group.sdGrossProfitMinor)}
          </SizableText>
        </EngineRow>
      ))}
    </EngineCard>
  )
}

function SrmBanner({ result }: { result: ExperimentResultDto }) {
  if (!result.srm.mismatch) return null
  return (
    <EngineCard p="$3.5" gap="$1.5" borderColor="$red10">
      <XStack items="center" gap="$2">
        <WarningIcon size={16} color="$red10" />
        <SizableText fontSize={14} fontWeight="600" color={MTD_TOKENS.text}>
          Sample ratio mismatch: do not trust this result yet
        </SizableText>
      </XStack>
      <SizableText fontSize={13} color={MTD_TOKENS.textMuted} lineHeight={18}>
        Group sizes differ from the intended split by more than chance allows (chi-square{' '}
        {result.srm.chiSquare.toFixed(1)}, {formatPValue(result.srm.pValue)}). Something
        is assigning or dropping contacts unevenly; find the cause before acting on the
        numbers below.
      </SizableText>
    </EngineCard>
  )
}

function Results({ experiment }: { experiment: EngineExperimentDto }) {
  const { result } = experiment
  if (!result) {
    return (
      <EngineCard>
        <EmptyState
          title="No results yet"
          description="Press Refresh to compute the first read. Results are also recomputed on a schedule."
        />
      </EngineCard>
    )
  }
  return (
    <YStack gap="$5">
      <HelpText>
        Computed {formatDateTime(result.computedAt)} over {formatDate(result.windowFrom)}{' '}
        to {formatDate(result.windowTo)}. Intent to treat: every assigned contact counts,
        outcomes after assignment only. Intervals are 95%.
      </HelpText>
      <SrmBanner result={result} />
      {result.warnings.length ? (
        <EngineCard>
          {result.warnings.map((warning, index) => (
            <EngineRow
              key={warning}
              isLast={index === result.warnings.length - 1}
              items="flex-start"
            >
              <WarningIcon size={16} color="$yellow10" />
              <SizableText fontSize={13} color={MTD_TOKENS.text} flex={1} lineHeight={18}>
                {warning}
              </SizableText>
            </EngineRow>
          ))}
        </EngineCard>
      ) : null}
      {result.primary ? (
        <EngineCard p="$3.5" gap="$2">
          <SizableText fontSize={12} color={MTD_TOKENS.textSubtle}>
            Primary result: {metricLabel(result.primaryMetric)},{' '}
            {groupLabel(result, result.primary.treatmentKey)} vs{' '}
            {groupLabel(result, result.primary.baselineKey)}
          </SizableText>
          <VerdictPill verdict={result.primary.verdict} showHelp />
        </EngineCard>
      ) : null}
      <EngineSection title="Comparisons">
        <Comparisons result={result} />
      </EngineSection>
      <EngineSection title="Groups">
        <GroupsTable result={result} />
      </EngineSection>
    </YStack>
  )
}

function AssignmentLookup({
  workspaceId,
  experimentId,
  arms,
}: {
  workspaceId: string
  experimentId: string
  arms: EngineExperimentDto['arms']
}) {
  const [draft, setDraft] = useState('')
  const [contactId, setContactId] = useState<string | null>(null)
  const { assignment, isLoading, isError, error } = useExperimentAssignment(
    workspaceId,
    experimentId,
    contactId,
  )
  const lookUp = () => setContactId(draft.trim() || null)

  return (
    <EngineCard p="$3.5" gap="$3">
      <XStack gap="$2" items="center" flexWrap="wrap">
        <YStack flex={1} minW={200}>
          <Input
            width="100%"
            value={draft}
            onChangeText={setDraft}
            placeholder="Contact id"
            autoCapitalize="none"
            onSubmitEditing={lookUp}
          />
        </YStack>
        <MtdActionButton size="compact" variant="secondary" onPress={lookUp}>
          Look up
        </MtdActionButton>
      </XStack>
      {isLoading ? <LoadingState label="Looking up…" /> : null}
      {isError ? <ErrorState error={error} /> : null}
      {assignment ? (
        <SizableText fontSize={13} color={MTD_TOKENS.text} lineHeight={18}>
          {assignment.excluded
            ? `Excluded${assignment.excludedReason ? `: ${assignment.excludedReason}` : ''}.`
            : assignment.isHoldout
              ? 'In the experiment holdout.'
              : `Assigned to ${
                  arms.find((arm) => arm.id === assignment.armId)?.name ?? 'an arm'
                }.`}
          {assignment.assignedAt
            ? ` Since ${formatDateTime(assignment.assignedAt)}.`
            : ''}
        </SizableText>
      ) : null}
      <HelpText>
        Assignment is a deterministic hash of the experiment and contact, so it never
        changes.
      </HelpText>
    </EngineCard>
  )
}

export function EngineExperimentDetailScreen({
  workspaceId,
  experimentId,
}: {
  workspaceId: string
  experimentId: string
}) {
  const { experiment, isLoading, isError, error, refetch } = useEngineExperiment(
    workspaceId,
    experimentId,
  )
  const { canEdit } = useEngineRole(workspaceId)
  const transition = useTransitionExperiment(workspaceId, experimentId)
  const refresh = useRefreshExperiment(workspaceId, experimentId)
  const channelOptions = useChannelOptions(workspaceId, [experiment?.channelKey ?? null])
  const [pendingTo, setPendingTo] = useState<string | null>(null)

  const runTransition = async (action: TransitionAction) => {
    if (transition.isPending) return
    const confirmed = await dialogConfirm({
      title: action.title,
      description: action.description,
      confirmText: action.label,
    })
    if (!confirmed) return
    setPendingTo(action.to)
    try {
      await transition.mutateAsync({ to: action.to })
      toastSuccess(`Experiment ${action.to}`)
    } catch (err) {
      toastError(err, 'Failed to change experiment status')
    } finally {
      setPendingTo(null)
    }
  }

  const runRefresh = async () => {
    try {
      const result = await refresh.mutateAsync()
      toastSuccess(
        result.srm.mismatch
          ? 'Results refreshed, with a sample ratio warning'
          : 'Results refreshed',
      )
    } catch (err) {
      toastError(err, 'Failed to refresh results')
    }
  }

  const isDraft = experiment?.status === 'draft'
  const actions = experiment ? (
    <>
      {!isDraft ? (
        <MtdActionButton
          size="compact"
          variant="secondary"
          loading={refresh.isPending}
          icon={<ArrowsClockwiseIcon size={14} color={MTD_TOKENS.text} />}
          onPress={() => void runRefresh()}
        >
          Refresh
        </MtdActionButton>
      ) : null}
      {canEdit
        ? transitionsFor(experiment.status).map((action) => (
            <MtdActionButton
              key={action.to}
              size="compact"
              variant={action.variant}
              loading={pendingTo === action.to}
              disabled={transition.isPending}
              onPress={() => void runTransition(action)}
            >
              {action.label}
            </MtdActionButton>
          ))
        : null}
    </>
  ) : null

  return (
    <EnginePage
      title={experiment?.name ?? 'Experiment'}
      subtitle={
        experiment
          ? `${kindLabel(experiment.kind)} on ${channelLabel(
              experiment.channelKey,
            ).toLowerCase()} · created ${formatDate(experiment.createdAt)}`
          : undefined
      }
      actions={actions}
    >
      <XStack items="center" gap="$3" flexWrap="wrap">
        <Link href={ENGINE_ROUTES.experiments(workspaceId)} asChild>
          <XStack items="center" gap="$1" cursor="pointer">
            <CaretLeftIcon size={14} color={MTD_TOKENS.textSubtle} />
            <SizableText fontSize={13} color={MTD_TOKENS.textSubtle}>
              All experiments
            </SizableText>
          </XStack>
        </Link>
        {experiment ? (
          <StatusPill
            label={experiment.status}
            tone={experimentStatusTone(experiment.status)}
          />
        ) : null}
      </XStack>

      {isLoading ? <LoadingState label="Loading experiment…" /> : null}
      {isError ? (
        <EngineCard>
          <ErrorState error={error} retry={() => void refetch()} />
        </EngineCard>
      ) : null}

      {experiment ? (
        <YStack gap="$5">
          <EngineSection title="Setup">
            <ConfigSummary experiment={experiment} />
          </EngineSection>

          {isDraft ? (
            <EngineSection title="Edit draft">
              {canEdit ? (
                <ExperimentForm
                  key={experiment.updatedAt}
                  workspaceId={workspaceId}
                  experiment={experiment}
                  channelOptions={channelOptions}
                />
              ) : (
                <EngineCard>
                  <EmptyState
                    title="Draft"
                    description="A marketer or admin can edit and start this experiment."
                  />
                </EngineCard>
              )}
            </EngineSection>
          ) : (
            <>
              <EngineSection title="Results">
                <Results experiment={experiment} />
              </EngineSection>
              <EngineSection title="Check a contact's assignment">
                <AssignmentLookup
                  workspaceId={workspaceId}
                  experimentId={experimentId}
                  arms={experiment.arms}
                />
              </EngineSection>
            </>
          )}
        </YStack>
      ) : null}
    </EnginePage>
  )
}
