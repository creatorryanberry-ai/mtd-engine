import { Link } from 'one'
import { SizableText, XStack, YStack } from 'tamagui'

import { ENGINE_ROUTES } from '~/features/engine/client/engineRoutes'
import {
  formatDelta,
  formatMinor,
  formatNumber,
  formatRelative,
  formatShortDay,
  formatSignedMinor,
  titleCase,
} from '~/features/engine/client/format'
import { useEngineDashboard } from '~/features/engine/client/useEngineInsights'
import { useEngineWorkspace } from '~/features/engine/client/useEngineWorkspaces'
import {
  EmptyState,
  EngineCard,
  EnginePage,
  EngineRow,
  EngineSection,
  ErrorState,
  HelpText,
  LoadingState,
  ProgressBar,
  StatTile,
  StatusPill,
  toneForStatus,
} from '~/features/engine/components/EngineUi'
import { IncrementalCard } from '~/features/engine/components/IncrementalCard'
import { TrendBars } from '~/features/engine/components/TrendBars'
import { VERDICT_LABEL } from '~/features/engine/components/VerdictPill'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { ArrowRightIcon } from '~/interface/icons/phosphor/ArrowRightIcon'

import type { DashboardSummaryDto } from '~/features/engine/contract'

function deltaTone(current: number, previous: number) {
  if (current === previous) return 'muted' as const
  return current > previous ? ('green' as const) : ('orange' as const)
}

function StatTiles({ summary }: { summary: DashboardSummaryDto }) {
  const {
    currency,
    grossProfit,
    revenue,
    orders,
    contacts,
    deals,
    experiments,
    approvals,
    incremental,
  } = summary
  const money = (minor: number) => formatMinor(minor, currency)
  const gpDelta = formatDelta(grossProfit.thisWeekMinor, grossProfit.lastWeekMinor)
  const revDelta = formatDelta(revenue.thisWeekMinor, revenue.lastWeekMinor)
  const ordersDelta = formatDelta(orders.thisWeek, orders.lastWeek)

  return (
    <XStack gap="$3" flexWrap="wrap">
      <StatTile
        label="Gross profit this week"
        value={money(grossProfit.thisWeekMinor)}
        sub={
          gpDelta
            ? `${gpDelta} vs ${money(grossProfit.lastWeekMinor)} last week`
            : `Same as last week (${money(grossProfit.lastWeekMinor)})`
        }
        subTone={deltaTone(grossProfit.thisWeekMinor, grossProfit.lastWeekMinor)}
      />
      <StatTile
        label="Incremental profit"
        value={
          incremental?.incrementalMinor == null
            ? '—'
            : formatSignedMinor(incremental.incrementalMinor, currency)
        }
        sub={
          incremental
            ? `${VERDICT_LABEL[incremental.verdict]} · vs permanent holdout`
            : 'No permanent holdout set'
        }
        subTone={
          incremental?.verdict === 'positive'
            ? 'green'
            : incremental?.verdict === 'negative'
              ? 'orange'
              : 'muted'
        }
      />
      <StatTile
        label="Revenue"
        value={money(revenue.thisWeekMinor)}
        sub={revDelta ? `${revDelta} week on week` : 'Flat week on week'}
        subTone={deltaTone(revenue.thisWeekMinor, revenue.lastWeekMinor)}
      />
      <StatTile
        label="Orders"
        value={formatNumber(orders.thisWeek)}
        sub={`${formatNumber(orders.newCustomersThisWeek)} new customers${
          ordersDelta ? ` · ${ordersDelta}` : ''
        }`}
        subTone={deltaTone(orders.thisWeek, orders.lastWeek)}
      />
      <StatTile
        label="Contacts"
        value={formatNumber(contacts.total)}
        sub={`${formatNumber(contacts.newThisWeek)} new this week`}
      />
      <StatTile
        label="Open pipeline"
        value={money(deals.openValueMinor)}
        sub={`${formatNumber(deals.open)} open · ${formatNumber(deals.wonThisWeek)} won this week`}
      />
      <StatTile
        label="Running experiments"
        value={formatNumber(experiments.running)}
        sub={experiments.running === 0 ? 'None yet' : 'Live now'}
      />
      <StatTile
        label="Pending approvals"
        value={formatNumber(approvals.pending)}
        sub={approvals.pending > 0 ? 'Waiting on you' : 'Nothing waiting'}
        subTone={approvals.pending > 0 ? 'orange' : 'muted'}
      />
    </XStack>
  )
}

function MeasurementLink({ workspaceId }: { workspaceId: string }) {
  return (
    <Link href={ENGINE_ROUTES.measurement(workspaceId)} asChild>
      <XStack items="center" gap="$1.5" cursor="pointer" self="flex-start">
        <SizableText fontSize={13} fontWeight="600" color={MTD_TOKENS.orange}>
          Open Measurement
        </SizableText>
        <ArrowRightIcon size={14} color={MTD_TOKENS.orange} />
      </XStack>
    </Link>
  )
}

function Incremental({
  summary,
  workspaceId,
}: {
  summary: DashboardSummaryDto
  workspaceId: string
}) {
  if (!summary.incremental) {
    return (
      <EngineCard p="$3.5" gap="$2">
        <SizableText fontSize={14} fontWeight="600" color={MTD_TOKENS.text}>
          Not measured
        </SizableText>
        <HelpText>
          The permanent holdout is 0%, so there is no baseline to compare against. Set one
          in Settings to measure what marketing adds.
        </HelpText>
      </EngineCard>
    )
  }
  return (
    <IncrementalCard
      report={summary.incremental}
      footer={<MeasurementLink workspaceId={workspaceId} />}
    />
  )
}

function GrossProfitTrend({ summary }: { summary: DashboardSummaryDto }) {
  const points = summary.trend.map((row) => ({
    key: row.day,
    label: formatShortDay(row.day),
    value: row.grossProfitMinor,
  }))
  return (
    <EngineCard p="$3.5">
      {points.length === 0 ? (
        <EmptyState
          title="No daily metrics yet"
          description="Daily gross profit appears once the nightly rollup has run."
        />
      ) : (
        <TrendBars
          points={points}
          title="Gross profit, last 28 days"
          format={(value) => formatMinor(value, summary.currency)}
        />
      )}
    </EngineCard>
  )
}

function LlmSpend({ summary }: { summary: DashboardSummaryDto }) {
  const { llm } = summary
  const ratio = llm.monthBudgetCents > 0 ? llm.monthCostCents / llm.monthBudgetCents : 0
  const tone = ratio >= 1 ? 'orange' : ratio >= 0.8 ? 'blue' : 'green'

  return (
    <EngineCard p="$3.5" gap="$2.5">
      <XStack items="baseline" justify="space-between" gap="$3">
        <SizableText fontSize={15} fontWeight="600" color={MTD_TOKENS.text}>
          {formatMinor(llm.monthCostCents, 'USD', 'en-US')}
        </SizableText>
        <SizableText fontSize={12} color={MTD_TOKENS.textMuted}>
          of {formatMinor(llm.monthBudgetCents, 'USD', 'en-US')} budget ·{' '}
          {formatNumber(llm.calls)} calls this month
        </SizableText>
      </XStack>
      <ProgressBar ratio={ratio} tone={tone} />
      <SizableText fontSize={12} color={MTD_TOKENS.textSubtle}>
        {llm.monthBudgetCents === 0
          ? 'No LLM budget set. Set one in Settings.'
          : `${Math.round(ratio * 100)}% used`}
      </SizableText>
    </EngineCard>
  )
}

function ConnectionHealth({ summary }: { summary: DashboardSummaryDto }) {
  const { connections } = summary
  return (
    <EngineCard>
      {connections.length === 0 ? (
        <EmptyState
          title="No connections yet"
          description="Connect Stripe or HubSpot in Integrations to start syncing revenue and contacts."
        />
      ) : (
        connections.map((connection, index) => (
          <EngineRow
            key={`${connection.provider}-${index}`}
            isLast={index === connections.length - 1}
          >
            <SizableText fontSize={14} fontWeight="500" color={MTD_TOKENS.text} flex={1}>
              {titleCase(connection.provider)}
            </SizableText>
            <SizableText fontSize={12} color={MTD_TOKENS.textSubtle}>
              synced {formatRelative(connection.lastSyncAt)}
            </SizableText>
            <StatusPill
              label={connection.status}
              tone={toneForStatus(connection.status)}
            />
          </EngineRow>
        ))
      )}
    </EngineCard>
  )
}

function Alerts({ summary }: { summary: DashboardSummaryDto }) {
  const { alerts } = summary
  return (
    <EngineCard>
      {alerts.length === 0 ? (
        <EmptyState title="All quiet" description="No alerts right now." />
      ) : (
        alerts.map((alert, index) => (
          <EngineRow
            key={alert.id}
            isLast={index === alerts.length - 1}
            items="flex-start"
          >
            <StatusPill label={alert.level} tone={toneForStatus(alert.level)} />
            <SizableText fontSize={13} color={MTD_TOKENS.text} flex={1} lineHeight={18}>
              {alert.message}
            </SizableText>
          </EngineRow>
        ))
      )}
    </EngineCard>
  )
}

function Learnings({ summary }: { summary: DashboardSummaryDto }) {
  const { learnings } = summary
  return (
    <EngineCard>
      {learnings.length === 0 ? (
        <EmptyState title="No graded learnings yet. The first experiments create them." />
      ) : (
        learnings.map((learning, index) => (
          <EngineRow
            key={learning.id}
            isLast={index === learnings.length - 1}
            items="flex-start"
          >
            <YStack
              width={28}
              height={28}
              rounded="$3"
              bg={MTD_TOKENS.cardInset}
              items="center"
              justify="center"
              shrink={0}
            >
              <SizableText fontSize={12} fontWeight="700" color={MTD_TOKENS.text}>
                {learning.grade}
              </SizableText>
            </YStack>
            <SizableText fontSize={13} color={MTD_TOKENS.text} flex={1} lineHeight={18}>
              {learning.statement}
            </SizableText>
            <StatusPill label={learning.status} />
          </EngineRow>
        ))
      )}
    </EngineCard>
  )
}

export function EngineCommandCentreScreen({ workspaceId }: { workspaceId: string }) {
  const { workspace } = useEngineWorkspace(workspaceId)
  const { summary, isLoading, isError, error, refetch } = useEngineDashboard(workspaceId)

  const subtitle = summary
    ? `Week of ${new Date(summary.period.from).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
      })} to ${new Date(summary.period.to).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
      })}`
    : 'Everything here comes from synced orders and events, not platform numbers.'

  return (
    <EnginePage title={workspace?.name ?? 'Command Centre'} subtitle={subtitle}>
      {workspace?.killSwitch ? (
        <EngineCard p="$3" borderColor={MTD_TOKENS.orange} bg={MTD_TOKENS.orangeMuted}>
          <SizableText fontSize={13} fontWeight="600" color={MTD_TOKENS.orange}>
            Kill switch is on. The engine will not publish or spend until it is turned off
            in Settings.
          </SizableText>
        </EngineCard>
      ) : null}

      {isLoading ? <LoadingState label="Loading command centre…" /> : null}
      {isError ? (
        <EngineCard>
          <ErrorState error={error} retry={() => void refetch()} />
        </EngineCard>
      ) : null}

      {summary ? (
        <>
          <StatTiles summary={summary} />

          <XStack gap="$5" flexWrap="wrap" items="flex-start">
            <YStack gap="$2.5" grow={1} flexBasis={420} minW={280}>
              <EngineSection title="Incremental profit this week">
                <Incremental summary={summary} workspaceId={workspaceId} />
              </EngineSection>
            </YStack>
            <YStack gap="$2.5" grow={1} flexBasis={420} minW={280}>
              <EngineSection title="Gross profit, last 28 days">
                <GrossProfitTrend summary={summary} />
              </EngineSection>
            </YStack>
          </XStack>

          <XStack gap="$5" flexWrap="wrap" items="flex-start">
            <YStack gap="$5" grow={1} flexBasis={420} minW={280}>
              <EngineSection title="LLM spend">
                <LlmSpend summary={summary} />
              </EngineSection>
              <EngineSection title="Connection health">
                <ConnectionHealth summary={summary} />
              </EngineSection>
            </YStack>
            <YStack gap="$5" grow={1} flexBasis={420} minW={280}>
              <EngineSection title="Alerts">
                <Alerts summary={summary} />
              </EngineSection>
              <EngineSection title="Top learnings">
                <Learnings summary={summary} />
              </EngineSection>
            </YStack>
          </XStack>
        </>
      ) : null}
    </EnginePage>
  )
}
