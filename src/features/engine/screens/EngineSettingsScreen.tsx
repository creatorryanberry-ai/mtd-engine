import { useEffect, useState } from 'react'
import { SizableText, XStack, YStack } from 'tamagui'

import { toastError, toastSuccess } from '~/features/engine/client/engineToast'
import {
  formatDateTime,
  formatMicrosUsd,
  formatMinor,
  formatNumber,
  formatPercent,
} from '~/features/engine/client/format'
import { useEngineLlmCalls } from '~/features/engine/client/useEngineInsights'
import {
  useGlobalHoldout,
  useUpdateGlobalHoldoutRate,
} from '~/features/engine/client/useEngineMeasure'
import {
  useAddMember,
  useEngineMembers,
  useEngineWorkspace,
  useEngineWorkspaces,
  useRemoveMember,
  useUpdateMember,
  useUpdateWorkspace,
} from '~/features/engine/client/useEngineWorkspaces'
import {
  ChipGroup,
  EmptyState,
  EngineCard,
  EnginePage,
  EngineRow,
  EngineSection,
  ErrorState,
  Field,
  HelpText,
  IconButton,
  LoadMoreButton,
  LoadingState,
  StatusPill,
} from '~/features/engine/components/EngineUi'
import { MtdActionButton } from '~/features/mtd/components/MtdActionButton'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { dialogConfirm } from '~/interface/dialogs/actions'
import { Input } from '~/interface/forms/Input'
import { Switch } from '~/interface/forms/Switch'
import { TrashIcon } from '~/interface/icons/phosphor/TrashIcon'

import type { EngineRoleValue, EngineWorkspaceDto } from '~/features/engine/contract'

const ROLE_OPTIONS: { id: EngineRoleValue; label: string }[] = [
  { id: 'owner', label: 'Owner' },
  { id: 'admin', label: 'Admin' },
  { id: 'marketer', label: 'Marketer' },
  { id: 'approver', label: 'Approver' },
  { id: 'viewer', label: 'Viewer' },
]

const centsToMajor = (cents: number) => (cents / 100).toFixed(2)
const majorToCents = (value: string) => {
  const parsed = Number.parseFloat(value.replace(/[^\d.]/g, ''))
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null
}

function WorkspaceForm({ workspace }: { workspace: EngineWorkspaceDto }) {
  const update = useUpdateWorkspace(workspace.id)
  const [name, setName] = useState(workspace.name)
  const [currency, setCurrency] = useState(workspace.currency)
  const [timezone, setTimezone] = useState(workspace.timezone)
  const [llmBudget, setLlmBudget] = useState(
    centsToMajor(workspace.llmBudgetMonthlyCents),
  )
  const [mediaBudget, setMediaBudget] = useState(
    centsToMajor(workspace.mediaBudgetMonthlyCents),
  )

  useEffect(() => {
    setName(workspace.name)
    setCurrency(workspace.currency)
    setTimezone(workspace.timezone)
    setLlmBudget(centsToMajor(workspace.llmBudgetMonthlyCents))
    setMediaBudget(centsToMajor(workspace.mediaBudgetMonthlyCents))
  }, [workspace])

  const llmCents = majorToCents(llmBudget)
  const mediaCents = majorToCents(mediaBudget)
  const canSave =
    name.trim().length >= 2 &&
    currency.trim().length === 3 &&
    llmCents != null &&
    mediaCents != null &&
    !update.isPending

  const save = async () => {
    if (!canSave || llmCents == null || mediaCents == null) return
    try {
      await update.mutateAsync({
        name: name.trim(),
        currency: currency.trim().toUpperCase(),
        timezone: timezone.trim() || undefined,
        llmBudgetMonthlyCents: llmCents,
        mediaBudgetMonthlyCents: mediaCents,
      })
      toastSuccess('Workspace saved')
    } catch (error) {
      toastError(error, 'Failed to save workspace')
    }
  }

  return (
    <EngineCard p="$3.5" gap="$3.5">
      <XStack gap="$3" flexWrap="wrap">
        <Field label="Workspace name">
          <Input
            width="100%"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        </Field>
        <Field label="Currency">
          <Input
            width="100%"
            value={currency}
            onChangeText={setCurrency}
            autoCapitalize="characters"
            maxLength={3}
          />
        </Field>
        <Field label="Timezone">
          <Input
            width="100%"
            placeholder="Europe/London"
            value={timezone}
            onChangeText={setTimezone}
            autoCapitalize="none"
          />
        </Field>
      </XStack>
      <XStack gap="$3" flexWrap="wrap">
        <Field label="Monthly LLM budget (USD)">
          <Input
            width="100%"
            value={llmBudget}
            onChangeText={setLlmBudget}
            inputMode="decimal"
          />
          <HelpText>
            Currently {formatMinor(workspace.llmBudgetMonthlyCents, 'USD', 'en-US')}. The
            gateway stops calling models once this is reached.
          </HelpText>
        </Field>
        <Field label={`Monthly media budget (${workspace.currency})`}>
          <Input
            width="100%"
            value={mediaBudget}
            onChangeText={setMediaBudget}
            inputMode="decimal"
          />
          <HelpText>
            Currently {formatMinor(workspace.mediaBudgetMonthlyCents, workspace.currency)}
            . Hard cap for paid channels in phase 3.
          </HelpText>
        </Field>
      </XStack>
      <XStack justify="flex-end">
        <MtdActionButton
          disabled={!canSave}
          loading={update.isPending}
          onPress={() => void save()}
        >
          Save
        </MtdActionButton>
      </XStack>
    </EngineCard>
  )
}

function KillSwitchCard({ workspace }: { workspace: EngineWorkspaceDto }) {
  const update = useUpdateWorkspace(workspace.id)

  const toggle = async (next: boolean) => {
    if (update.isPending) return
    const confirmed = await dialogConfirm({
      title: next ? 'Turn the kill switch on?' : 'Turn the kill switch off?',
      description: next
        ? 'The engine stops publishing, spending and calling models immediately. Syncs keep running.'
        : 'The engine resumes autonomous actions within its guardrails.',
    })
    if (!confirmed) return
    try {
      await update.mutateAsync({ killSwitch: next })
      toastSuccess(next ? 'Kill switch on' : 'Kill switch off')
    } catch (error) {
      toastError(error, 'Failed to update kill switch')
    }
  }

  return (
    <EngineCard
      p="$3.5"
      borderColor={workspace.killSwitch ? MTD_TOKENS.orange : MTD_TOKENS.cardBorder}
    >
      <XStack items="center" gap="$3">
        <YStack flex={1} gap="$0.5">
          <SizableText fontSize={14} fontWeight="600" color={MTD_TOKENS.text}>
            Kill switch
          </SizableText>
          <HelpText>
            {workspace.killSwitch
              ? 'On. Nothing is published or spent until this is turned off.'
              : 'Off. The engine acts within its autonomy settings.'}
          </HelpText>
        </YStack>
        <Switch
          checked={workspace.killSwitch}
          disabled={update.isPending}
          onCheckedChange={(next) => void toggle(next)}
          aria-label="Kill switch"
        />
      </XStack>
    </EngineCard>
  )
}

const rateToPct = (rate: number) => String(Math.round(rate * 1000) / 10)

function HoldoutCard({
  workspace,
  canManage,
}: {
  workspace: EngineWorkspaceDto
  canManage: boolean
}) {
  const update = useUpdateGlobalHoldoutRate(workspace.id)
  const { holdout, isLoading, isError, error, refetch } = useGlobalHoldout(workspace.id)
  const [pct, setPct] = useState(rateToPct(workspace.globalHoldoutRate))

  useEffect(() => {
    setPct(rateToPct(workspace.globalHoldoutRate))
  }, [workspace.globalHoldoutRate])

  const parsed = Number.parseFloat(pct.replace(',', '.'))
  const valid = Number.isFinite(parsed) && parsed >= 0 && parsed <= 50
  const nextRate = valid ? Math.round(parsed * 10) / 1000 : null
  const changed = nextRate != null && nextRate !== workspace.globalHoldoutRate

  const save = async () => {
    if (nextRate == null || !changed || update.isPending) return
    const confirmed = await dialogConfirm({
      title: `Change the permanent holdout to ${formatPercent(nextRate)}?`,
      description:
        nextRate === 0
          ? 'Every contact becomes eligible for sends and experiments, and incremental profit can no longer be measured. The change is audited.'
          : 'Contacts move in or out of the holdout by their hash bucket, so the incremental profit baseline restarts from now and earlier weeks are not comparable. The change is audited.',
      confirmText: 'Change holdout',
    })
    if (!confirmed) return
    try {
      await update.mutateAsync(nextRate)
      toastSuccess(`Permanent holdout set to ${formatPercent(nextRate)}`)
    } catch (err) {
      toastError(err, 'Failed to change the holdout')
    }
  }

  return (
    <EngineCard p="$3.5" gap="$3">
      <YStack gap="$0.5">
        <SizableText fontSize={14} fontWeight="600" color={MTD_TOKENS.text}>
          Permanent holdout
        </SizableText>
        <HelpText>
          A fixed share of contacts that never receive automated sends and are left out of
          every experiment. Incremental profit compares everyone else with them.
        </HelpText>
      </YStack>
      {isLoading ? <LoadingState label="Counting the holdout…" /> : null}
      {isError ? <ErrorState error={error} retry={() => void refetch()} /> : null}
      {holdout ? (
        <SizableText fontSize={13} color={MTD_TOKENS.text}>
          {formatNumber(holdout.contactsHeldOut)} of {formatNumber(holdout.contactsTotal)}{' '}
          contacts held out at {formatPercent(holdout.rate)}.
        </SizableText>
      ) : null}
      {canManage ? (
        <XStack gap="$2" items="flex-end" flexWrap="wrap">
          <Field label="Holdout (%)">
            <Input
              width="100%"
              maxW={160}
              value={pct}
              onChangeText={setPct}
              inputMode="decimal"
            />
            <HelpText>0% to 50%. 5% is a sensible default.</HelpText>
          </Field>
          <MtdActionButton
            disabled={!changed || !valid}
            loading={update.isPending}
            onPress={() => void save()}
          >
            Save holdout
          </MtdActionButton>
        </XStack>
      ) : (
        <HelpText>Only owners and admins can change the holdout.</HelpText>
      )}
      {!valid ? (
        <SizableText fontSize={12} color={MTD_TOKENS.orange}>
          Enter a percentage between 0 and 50.
        </SizableText>
      ) : null}
    </EngineCard>
  )
}

function MembersCard({
  workspaceId,
  canManage,
}: {
  workspaceId: string
  canManage: boolean
}) {
  const { members, isLoading, isError, error } = useEngineMembers(workspaceId)
  const addMember = useAddMember(workspaceId)
  const updateMember = useUpdateMember(workspaceId)
  const removeMember = useRemoveMember(workspaceId)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<EngineRoleValue>('marketer')

  const add = async () => {
    const trimmed = email.trim()
    if (!trimmed || addMember.isPending) return
    try {
      await addMember.mutateAsync({ email: trimmed, role })
      toastSuccess(`${trimmed} added as ${role}`)
      setEmail('')
    } catch (err) {
      toastError(err, 'Failed to add member')
    }
  }

  const changeRole = async (
    memberId: string,
    nextRole: EngineRoleValue,
    label: string,
  ) => {
    try {
      await updateMember.mutateAsync({ memberId, role: nextRole })
      toastSuccess(`${label} is now ${nextRole}`)
    } catch (err) {
      toastError(err, 'Failed to change role')
    }
  }

  const remove = async (memberId: string, label: string) => {
    const confirmed = await dialogConfirm({
      title: `Remove ${label}?`,
      description: 'They lose access to this workspace immediately.',
    })
    if (!confirmed) return
    try {
      await removeMember.mutateAsync(memberId)
      toastSuccess(`${label} removed`)
    } catch (err) {
      toastError(err, 'Failed to remove member')
    }
  }

  return (
    <EngineCard>
      {isLoading ? <LoadingState label="Loading members…" /> : null}
      {isError ? <ErrorState error={error} /> : null}
      {!isLoading && !isError && members.length === 0 ? (
        <EmptyState title="No members" />
      ) : null}
      {members.map((member, index) => {
        const label = member.name || member.email || member.userId
        return (
          <EngineRow
            key={member.id}
            isLast={index === members.length - 1 && !canManage}
            flexWrap="wrap"
          >
            <YStack flex={1} minW={160} gap="$0.5">
              <SizableText
                fontSize={14}
                fontWeight="500"
                color={MTD_TOKENS.text}
                numberOfLines={1}
              >
                {label}
              </SizableText>
              {member.email && member.name ? (
                <SizableText fontSize={12} color={MTD_TOKENS.textMuted} numberOfLines={1}>
                  {member.email}
                </SizableText>
              ) : null}
            </YStack>
            {canManage ? (
              <XStack gap="$2" items="center">
                <ChipGroup
                  options={ROLE_OPTIONS}
                  value={member.role}
                  onChange={(next) => void changeRole(member.id, next, label)}
                />
                <IconButton
                  label="Remove member"
                  onPress={() => void remove(member.id, label)}
                >
                  <TrashIcon size={16} color={MTD_TOKENS.textSubtle} />
                </IconButton>
              </XStack>
            ) : (
              <StatusPill label={member.role} tone="muted" />
            )}
          </EngineRow>
        )
      })}
      {canManage ? (
        <YStack px="$3.5" py="$3.5" gap="$3" bg={MTD_TOKENS.cardInset}>
          <HelpText>
            Add someone who already has an account. Invitations for new people come later.
          </HelpText>
          <XStack gap="$2" items="center" flexWrap="wrap">
            <YStack flex={1} minW={200}>
              <Input
                width="100%"
                placeholder="name@company.com"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                inputMode="email"
                onSubmitEditing={() => void add()}
              />
            </YStack>
            <ChipGroup options={ROLE_OPTIONS} value={role} onChange={setRole} />
            <MtdActionButton
              size="compact"
              disabled={!email.trim()}
              loading={addMember.isPending}
              onPress={() => void add()}
            >
              Add
            </MtdActionButton>
          </XStack>
        </YStack>
      ) : null}
    </EngineCard>
  )
}

function LlmCallsCard({ workspaceId }: { workspaceId: string }) {
  const calls = useEngineLlmCalls(workspaceId)

  return (
    <EngineCard>
      {calls.isLoading ? <LoadingState label="Loading LLM calls…" /> : null}
      {calls.isError ? (
        <ErrorState error={calls.error} retry={() => void calls.refetch()} />
      ) : null}
      {!calls.isLoading && !calls.isError && calls.items.length === 0 ? (
        <EmptyState
          title="No model calls yet"
          description="Brand kit imports and agents log every call here."
        />
      ) : null}
      {calls.items.map((call, index) => (
        <EngineRow
          key={call.id}
          isLast={index === calls.items.length - 1 && !calls.hasMore}
          flexWrap="wrap"
        >
          <YStack flex={2} minW={180} gap="$0.5">
            <XStack gap="$2" items="center" flexWrap="wrap">
              <SizableText fontSize={13} fontWeight="600" color={MTD_TOKENS.text}>
                {call.agent}
              </SizableText>
              <StatusPill label={call.tier} tone="muted" />
              {call.error ? <StatusPill label="error" tone="orange" /> : null}
            </XStack>
            <SizableText fontSize={12} color={MTD_TOKENS.textMuted} numberOfLines={1}>
              {call.model}
              {call.purpose ? ` · ${call.purpose}` : ''} ·{' '}
              {formatDateTime(call.createdAt)}
            </SizableText>
          </YStack>
          <SizableText fontSize={12} color={MTD_TOKENS.textMuted} fontFamily="$mono">
            {formatNumber(call.inputTokens)} in · {formatNumber(call.outputTokens)} out
            {call.cacheReadTokens
              ? ` · ${formatNumber(call.cacheReadTokens)} cached`
              : ''}
          </SizableText>
          <SizableText
            fontSize={12}
            color={MTD_TOKENS.text}
            fontFamily="$mono"
            width={80}
            text="right"
          >
            {formatMicrosUsd(call.costMicros)}
          </SizableText>
          <SizableText
            fontSize={12}
            color={MTD_TOKENS.textSubtle}
            fontFamily="$mono"
            width={64}
            text="right"
          >
            {formatNumber(call.latencyMs)}ms
          </SizableText>
        </EngineRow>
      ))}
      <LoadMoreButton
        hasMore={calls.hasMore}
        isLoading={calls.isLoadingMore}
        onPress={calls.loadMore}
      />
    </EngineCard>
  )
}

export function EngineSettingsScreen({ workspaceId }: { workspaceId: string }) {
  const { workspace, isLoading, isError, error, refetch } =
    useEngineWorkspace(workspaceId)
  const { workspaces } = useEngineWorkspaces()
  const role = workspaces.find((item) => item.id === workspaceId)?.role
  const isAdmin = role === 'owner' || role === 'admin'

  return (
    <EnginePage
      title="Workspace settings"
      subtitle="Budgets, guardrails and who can act."
    >
      {isLoading ? <LoadingState label="Loading workspace…" /> : null}
      {isError ? (
        <EngineCard>
          <ErrorState error={error} retry={() => void refetch()} />
        </EngineCard>
      ) : null}

      {workspace && workspaceId ? (
        <YStack gap="$5">
          <EngineSection title="Workspace">
            <WorkspaceForm workspace={workspace} />
          </EngineSection>
          <EngineSection title="Guardrails">
            <KillSwitchCard workspace={workspace} />
          </EngineSection>
          <EngineSection title="Measurement">
            <HoldoutCard workspace={workspace} canManage={isAdmin} />
          </EngineSection>
          <EngineSection title="Members">
            <MembersCard workspaceId={workspaceId} canManage={isAdmin} />
          </EngineSection>
          {isAdmin ? (
            <EngineSection title="LLM calls">
              <LlmCallsCard workspaceId={workspaceId} />
            </EngineSection>
          ) : null}
        </YStack>
      ) : null}
    </EnginePage>
  )
}
