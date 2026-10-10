import { Link, useRouter } from 'one'
import { useState } from 'react'
import { SizableText, XStack, YStack } from 'tamagui'

import { ENGINE_ROUTES } from '~/features/engine/client/engineRoutes'
import { formatNumber, formatSignedMinor } from '~/features/engine/client/format'
import {
  channelLabel,
  experimentStatusTone,
  kindLabel,
  primaryGrossProfitComparison,
} from '~/features/engine/client/measureDisplay'
import { useEngineDashboard } from '~/features/engine/client/useEngineInsights'
import {
  useChannelOptions,
  useEngineExperiments,
} from '~/features/engine/client/useEngineMeasure'
import {
  useEngineRole,
  useEngineWorkspace,
} from '~/features/engine/client/useEngineWorkspaces'
import { describeInterval } from '~/features/engine/components/CiBar'
import {
  EmptyState,
  EngineCard,
  EnginePage,
  EngineRow,
  EngineSection,
  ErrorState,
  LoadingState,
  StatusPill,
} from '~/features/engine/components/EngineUi'
import { ExperimentForm } from '~/features/engine/components/ExperimentForm'
import { SampleSizeCalculator } from '~/features/engine/components/SampleSizeCalculator'
import { VerdictPill } from '~/features/engine/components/VerdictPill'
import { MtdActionButton } from '~/features/mtd/components/MtdActionButton'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { PlusIcon } from '~/interface/icons/phosphor/PlusIcon'

import type { EngineExperimentDto } from '~/features/engine/contract'

function HeaderCell({ children, flex = 1 }: { children: string; flex?: number }) {
  return (
    <SizableText
      fontSize={11}
      fontWeight="600"
      color={MTD_TOKENS.textSubtle}
      textTransform="uppercase"
      letterSpacing={0.6}
      flex={flex}
    >
      {children}
    </SizableText>
  )
}

function IncrementalCell({ experiment }: { experiment: EngineExperimentDto }) {
  const comparison = primaryGrossProfitComparison(experiment.result)
  if (!experiment.result) {
    return (
      <SizableText fontSize={12} color={MTD_TOKENS.textSubtle} flex={2}>
        No result yet
      </SizableText>
    )
  }
  if (!comparison || comparison.incrementalGrossProfitMinor == null) {
    return (
      <SizableText fontSize={12} color={MTD_TOKENS.textSubtle} flex={2}>
        Not available
      </SizableText>
    )
  }
  const currency = experiment.result.currency
  return (
    <SizableText fontSize={12} color={MTD_TOKENS.text} flex={2} lineHeight={16}>
      {describeInterval({
        estimate: comparison.incrementalGrossProfitMinor,
        low: comparison.incrementalCiLowMinor,
        high: comparison.incrementalCiHighMinor,
        format: (value) => formatSignedMinor(value, currency),
      })}
    </SizableText>
  )
}

function ExperimentsTable({
  workspaceId,
  onCreate,
}: {
  workspaceId: string
  onCreate?: () => void
}) {
  const { experiments, isLoading, isError, error, refetch } =
    useEngineExperiments(workspaceId)

  return (
    <EngineCard>
      <EngineRow bg={MTD_TOKENS.cardInset} display="none" $md={{ display: 'flex' }}>
        <HeaderCell flex={2}>Name</HeaderCell>
        <HeaderCell>Kind</HeaderCell>
        <HeaderCell>Channel</HeaderCell>
        <HeaderCell>Status</HeaderCell>
        <HeaderCell>Assigned</HeaderCell>
        <HeaderCell>Verdict</HeaderCell>
        <HeaderCell flex={2}>Incremental gross profit</HeaderCell>
      </EngineRow>

      {isLoading ? <LoadingState label="Loading experiments…" /> : null}
      {isError ? <ErrorState error={error} retry={() => void refetch()} /> : null}
      {!isLoading && !isError && experiments.length === 0 ? (
        <YStack items="center" pb="$5">
          <EmptyState
            title="No experiments yet"
            description="Start with a holdout test on your main channel: it is the cleanest read of what the channel adds."
          />
          {onCreate ? (
            <MtdActionButton size="compact" onPress={onCreate}>
              New experiment
            </MtdActionButton>
          ) : null}
        </YStack>
      ) : null}

      {experiments.map((experiment, index) => {
        const verdict = experiment.result?.primary?.verdict ?? null
        return (
          <Link
            key={experiment.id}
            href={ENGINE_ROUTES.experiment(workspaceId, experiment.id)}
            asChild
          >
            <EngineRow
              isLast={index === experiments.length - 1}
              flexDirection="column"
              items="stretch"
              gap="$1.5"
              cursor="pointer"
              hoverStyle={{ bg: MTD_TOKENS.cardInset }}
              $md={{ flexDirection: 'row', items: 'center', gap: '$3' }}
            >
              <SizableText
                fontSize={14}
                fontWeight="600"
                color={MTD_TOKENS.text}
                numberOfLines={1}
                flex={2}
              >
                {experiment.name}
              </SizableText>
              <SizableText fontSize={13} color={MTD_TOKENS.textMuted} flex={1}>
                {kindLabel(experiment.kind)}
              </SizableText>
              <SizableText fontSize={13} color={MTD_TOKENS.textMuted} flex={1}>
                {channelLabel(experiment.channelKey)}
              </SizableText>
              <XStack flex={1}>
                <StatusPill
                  label={experiment.status}
                  tone={experimentStatusTone(experiment.status)}
                />
              </XStack>
              <SizableText fontSize={13} color={MTD_TOKENS.text} flex={1}>
                {formatNumber(experiment.assignedCount)}
              </SizableText>
              <XStack flex={1}>
                {verdict ? (
                  <VerdictPill verdict={verdict} />
                ) : (
                  <SizableText fontSize={12} color={MTD_TOKENS.textSubtle}>
                    {experiment.status === 'draft' ? 'Not started' : 'No result yet'}
                  </SizableText>
                )}
              </XStack>
              <IncrementalCell experiment={experiment} />
            </EngineRow>
          </Link>
        )
      })}
    </EngineCard>
  )
}

export function EngineExperimentsScreen({ workspaceId }: { workspaceId: string }) {
  const router = useRouter()
  const { workspace } = useEngineWorkspace(workspaceId)
  const { summary } = useEngineDashboard(workspaceId)
  const { canEdit } = useEngineRole(workspaceId)
  const { experiments } = useEngineExperiments(workspaceId)
  const channelOptions = useChannelOptions(
    workspaceId,
    experiments.map((experiment) => experiment.channelKey),
  )
  const [creating, setCreating] = useState(false)
  const currency = workspace?.currency ?? summary?.currency ?? 'GBP'

  return (
    <EnginePage
      title="Experiments"
      subtitle="Holdout-backed tests. Every assigned contact counts in its group, whether or not a message reached them."
      actions={
        canEdit && !creating ? (
          <MtdActionButton
            size="compact"
            icon={<PlusIcon size={14} color={MTD_TOKENS.onOrange} />}
            onPress={() => setCreating(true)}
          >
            New experiment
          </MtdActionButton>
        ) : null
      }
    >
      <YStack gap="$5">
        {creating ? (
          <EngineSection title="New experiment">
            <ExperimentForm
              workspaceId={workspaceId}
              channelOptions={channelOptions}
              onCancel={() => setCreating(false)}
              onSaved={(experiment) => {
                setCreating(false)
                router.push(ENGINE_ROUTES.experiment(workspaceId, experiment.id))
              }}
            />
          </EngineSection>
        ) : null}

        <EngineSection title="All experiments">
          <ExperimentsTable
            workspaceId={workspaceId}
            onCreate={canEdit ? () => setCreating(true) : undefined}
          />
        </EngineSection>

        <EngineSection title="Sample size calculator">
          <SampleSizeCalculator
            currency={currency}
            contactsTotal={summary?.contacts.total ?? null}
            globalHoldoutRate={workspace?.globalHoldoutRate ?? 0}
          />
        </EngineSection>
      </YStack>
    </EnginePage>
  )
}
