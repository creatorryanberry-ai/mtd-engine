import { useState } from 'react'
import { SizableText, XStack, YStack } from 'tamagui'

import { toastError, toastSuccess } from '~/features/engine/client/engineToast'
import {
  KIND_OPTIONS,
  LIFECYCLE_OPTIONS,
  METRIC_OPTIONS,
  channelLabel,
} from '~/features/engine/client/measureDisplay'
import {
  useCreateExperiment,
  useUpdateExperiment,
} from '~/features/engine/client/useEngineMeasure'
import {
  ChipGroup,
  EngineCard,
  Field,
  FieldLabel,
  HelpText,
  IconButton,
  MultiChipGroup,
} from '~/features/engine/components/EngineUi'
import { MtdActionButton } from '~/features/mtd/components/MtdActionButton'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { Input } from '~/interface/forms/Input'
import { MtdDatePicker } from '~/interface/forms/MtdDatePicker'
import { Switch } from '~/interface/forms/Switch'
import { PlusIcon } from '~/interface/icons/phosphor/PlusIcon'
import { TrashIcon } from '~/interface/icons/phosphor/TrashIcon'

import type {
  CreateExperimentInput,
  UpdateExperimentInput,
} from '~/features/engine/client/engineApi'
import type {
  ExperimentKind,
  ExperimentMetric,
} from '~/features/engine/client/measureDisplay'
import type { EngineExperimentDto } from '~/features/engine/contract'

type ArmDraft = { key: string; name: string; isControl: boolean; weight: string }

let armSeq = 0
const nextArmKey = () => `arm-${++armSeq}`

const DEFAULT_ARMS = (): ArmDraft[] => [
  { key: nextArmKey(), name: 'Control', isControl: true, weight: '1' },
  { key: nextArmKey(), name: 'Variant B', isControl: false, weight: '1' },
]

const OTHER_CHANNEL = '__other__'
const NO_CHANNEL = '__none__'

function parseNumber(value: string) {
  const parsed = Number.parseFloat(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function asMetric(value: string): ExperimentMetric {
  return value === 'conversion_rate' ? 'conversion_rate' : 'incremental_gross_profit'
}

function asKind(value: string): ExperimentKind {
  return value === 'ab' ? 'ab' : 'holdout'
}

type FormState = {
  name: string
  kind: ExperimentKind
  metric: ExperimentMetric
  channelChoice: string
  channelText: string
  holdoutPct: string
  minSample: string
  arms: ArmDraft[]
  stages: string[]
  requireEmailConsent: boolean
  endsOn: string
}

function initialState(
  experiment: EngineExperimentDto | undefined,
  channelOptions: string[],
): FormState {
  if (!experiment) {
    return {
      name: '',
      kind: 'holdout',
      metric: 'incremental_gross_profit',
      channelChoice: channelOptions[0] ?? NO_CHANNEL,
      channelText: '',
      holdoutPct: '10',
      minSample: '200',
      arms: DEFAULT_ARMS(),
      stages: [],
      requireEmailConsent: true,
      endsOn: '',
    }
  }
  const channel = experiment.channelKey
  const known = channel ? channelOptions.includes(channel) : true
  return {
    name: experiment.name,
    kind: asKind(experiment.kind),
    metric: asMetric(experiment.successMetric),
    channelChoice: !channel ? NO_CHANNEL : known ? channel : OTHER_CHANNEL,
    channelText: known ? '' : (channel ?? ''),
    holdoutPct: String(Math.round(experiment.holdoutRate * 1000) / 10),
    minSample: String(experiment.minSamplePerArm),
    arms: experiment.arms.length
      ? experiment.arms.map((arm) => ({
          key: arm.id,
          name: arm.name,
          isControl: arm.isControl,
          weight: String(arm.weight),
        }))
      : DEFAULT_ARMS(),
    stages: experiment.audience.lifecycleStages ?? [],
    requireEmailConsent: experiment.audience.requireConsentChannel === 'email',
    endsOn: experiment.endsAt ? experiment.endsAt.slice(0, 10) : '',
  }
}

function validate(state: FormState) {
  const errors: string[] = []
  const name = state.name.trim()
  if (name.length < 2) errors.push('Give the experiment a name of at least 2 characters.')
  const holdout = parseNumber(state.holdoutPct)
  const minHoldout = state.kind === 'holdout' ? 2 : 0
  if (holdout == null || holdout < minHoldout || holdout > 50) {
    errors.push(
      state.kind === 'holdout'
        ? 'Holdout experiments need a holdout between 2% and 50%.'
        : 'Holdout must be between 0% and 50%.',
    )
  }
  const minSample = parseNumber(state.minSample)
  if (minSample == null || !Number.isInteger(minSample) || minSample < 30) {
    errors.push('Minimum sample per arm must be a whole number of at least 30.')
  }
  if (state.channelChoice === OTHER_CHANNEL && !state.channelText.trim()) {
    errors.push('Type a channel key or pick one from the list.')
  }
  if (state.kind === 'ab') {
    if (state.arms.length < 2) errors.push('An A/B test needs at least two arms.')
    if (state.arms.some((arm) => !arm.name.trim())) errors.push('Every arm needs a name.')
    if (
      state.arms.some((arm) => {
        const weight = parseNumber(arm.weight)
        return weight == null || weight <= 0
      })
    ) {
      errors.push('Arm weights must be greater than zero.')
    }
    const controls = state.arms.filter((arm) => arm.isControl).length
    if (controls > 1) errors.push('Mark at most one arm as the control.')
    if (controls === 0 && holdout === 0) {
      errors.push('With no holdout, mark one arm as the control to compare against.')
    }
  }
  return errors
}

function toInput(state: FormState) {
  const channelKey =
    state.channelChoice === NO_CHANNEL
      ? null
      : state.channelChoice === OTHER_CHANNEL
        ? state.channelText.trim()
        : state.channelChoice
  return {
    name: state.name.trim(),
    successMetric: state.metric,
    channelKey,
    holdoutRate: (parseNumber(state.holdoutPct) ?? 0) / 100,
    minSamplePerArm: Math.round(parseNumber(state.minSample) ?? 200),
    arms:
      state.kind === 'ab'
        ? state.arms.map((arm) => ({
            name: arm.name.trim(),
            isControl: arm.isControl,
            weight: parseNumber(arm.weight) ?? 1,
          }))
        : undefined,
    audience: {
      lifecycleStages: state.stages.length ? state.stages : undefined,
      requireConsentChannel: state.requireEmailConsent ? 'email' : undefined,
    },
    endsAt: state.endsOn ? `${state.endsOn}T23:59:59.999Z` : null,
  }
}

function ArmsEditor({
  arms,
  onChange,
}: {
  arms: ArmDraft[]
  onChange: (next: ArmDraft[]) => void
}) {
  const patch = (key: string, next: Partial<ArmDraft>) =>
    onChange(
      arms.map((arm) => {
        if (arm.key === key) return { ...arm, ...next }
        // one control at most: picking a new one clears the others
        if (next.isControl) return { ...arm, isControl: false }
        return arm
      }),
    )
  const totalWeight = arms.reduce((sum, arm) => sum + (parseNumber(arm.weight) ?? 0), 0)

  return (
    <YStack gap="$2">
      <FieldLabel>Arms</FieldLabel>
      {arms.map((arm) => {
        const weight = parseNumber(arm.weight) ?? 0
        const share = totalWeight > 0 ? Math.round((weight / totalWeight) * 100) : 0
        return (
          <XStack key={arm.key} gap="$2" items="center" flexWrap="wrap">
            <YStack flex={2} minW={160}>
              <Input
                width="100%"
                value={arm.name}
                onChangeText={(name) => patch(arm.key, { name })}
                placeholder="Arm name"
                aria-label="Arm name"
              />
            </YStack>
            <YStack width={90}>
              <Input
                width="100%"
                value={arm.weight}
                onChangeText={(value) => patch(arm.key, { weight: value })}
                inputMode="decimal"
                aria-label="Arm weight"
              />
            </YStack>
            <SizableText fontSize={12} color={MTD_TOKENS.textSubtle} width={92}>
              {share}% of treated
            </SizableText>
            <XStack items="center" gap="$1.5">
              <Switch
                size="$2"
                checked={arm.isControl}
                onCheckedChange={(checked) => patch(arm.key, { isControl: checked })}
                aria-label={`Use ${arm.name || 'this arm'} as control`}
              />
              <SizableText fontSize={12} color={MTD_TOKENS.textMuted}>
                Control
              </SizableText>
            </XStack>
            <IconButton
              label="Remove arm"
              onPress={() => onChange(arms.filter((item) => item.key !== arm.key))}
            >
              <TrashIcon size={16} color={MTD_TOKENS.textSubtle} />
            </IconButton>
          </XStack>
        )
      })}
      <XStack>
        <MtdActionButton
          size="compact"
          variant="secondary"
          icon={<PlusIcon size={14} color={MTD_TOKENS.text} />}
          onPress={() =>
            onChange([
              ...arms,
              {
                key: nextArmKey(),
                name: `Variant ${String.fromCharCode(65 + arms.length)}`,
                isControl: false,
                weight: '1',
              },
            ])
          }
        >
          Add arm
        </MtdActionButton>
      </XStack>
      <HelpText>
        Weights split the treated share between arms. The holdout is set aside first.
      </HelpText>
    </YStack>
  )
}

/** create a new experiment, or edit a draft (kind is fixed once created) */
export function ExperimentForm({
  workspaceId,
  experiment,
  channelOptions,
  onSaved,
  onCancel,
}: {
  workspaceId: string
  experiment?: EngineExperimentDto
  channelOptions: string[]
  onSaved?: (experiment: EngineExperimentDto) => void
  onCancel?: () => void
}) {
  const isEdit = !!experiment
  const create = useCreateExperiment(workspaceId)
  const update = useUpdateExperiment(workspaceId, experiment?.id ?? '')
  const [state, setState] = useState(() => initialState(experiment, channelOptions))
  const [showErrors, setShowErrors] = useState(false)
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState((current) => ({ ...current, [key]: value }))

  const errors = validate(state)
  const pending = create.isPending || update.isPending
  const channelChoices = [
    ...channelOptions.map((key) => ({ id: key, label: channelLabel(key) })),
    { id: NO_CHANNEL, label: 'Any channel' },
    { id: OTHER_CHANNEL, label: 'Other…' },
  ]
  const today = new Date().toISOString().slice(0, 10)

  const submit = async () => {
    if (errors.length) {
      setShowErrors(true)
      return
    }
    const base = toInput(state)
    try {
      if (isEdit) {
        const input: UpdateExperimentInput = base
        const saved = await update.mutateAsync(input)
        toastSuccess('Draft saved')
        onSaved?.(saved)
      } else {
        const input: CreateExperimentInput = { ...base, kind: state.kind }
        const saved = await create.mutateAsync(input)
        toastSuccess(`${saved.name} created as a draft`)
        setState(initialState(undefined, channelOptions))
        setShowErrors(false)
        onSaved?.(saved)
      }
    } catch (error) {
      toastError(error, isEdit ? 'Failed to save draft' : 'Failed to create experiment')
    }
  }

  return (
    <EngineCard p="$3.5" gap="$3.5">
      <XStack gap="$3" flexWrap="wrap">
        <Field label="Name">
          <Input
            width="100%"
            value={state.name}
            onChangeText={(value) => set('name', value)}
            placeholder="Win-back email vs holdout"
          />
        </Field>
      </XStack>

      <XStack gap="$4" flexWrap="wrap">
        <YStack gap="$1.5">
          <FieldLabel>Kind</FieldLabel>
          {isEdit ? (
            <HelpText>
              {state.kind === 'ab' ? 'A/B test' : 'Holdout'} (fixed once created)
            </HelpText>
          ) : (
            <ChipGroup
              options={KIND_OPTIONS}
              value={state.kind}
              onChange={(kind) => set('kind', kind)}
            />
          )}
        </YStack>
        <YStack gap="$1.5">
          <FieldLabel>Success metric</FieldLabel>
          <ChipGroup
            options={METRIC_OPTIONS}
            value={state.metric}
            onChange={(metric) => set('metric', metric)}
          />
        </YStack>
      </XStack>
      <HelpText>
        {state.kind === 'holdout'
          ? 'A holdout test withholds the treatment from a random share of the audience and compares everyone else with them.'
          : 'An A/B test compares arms against a control arm, or against the holdout when there is one.'}{' '}
        Gross profit per contact is the default reward; conversion rate is reported either
        way.
      </HelpText>

      <YStack gap="$1.5">
        <FieldLabel>Channel</FieldLabel>
        <ChipGroup
          options={channelChoices}
          value={state.channelChoice}
          onChange={(value) => set('channelChoice', value)}
        />
        {state.channelChoice === OTHER_CHANNEL ? (
          <Input
            width="100%"
            maxW={320}
            value={state.channelText}
            onChangeText={(value) => set('channelText', value)}
            placeholder="channel key, e.g. sms"
            autoCapitalize="none"
          />
        ) : null}
      </YStack>

      <XStack gap="$3" flexWrap="wrap">
        <Field label="Holdout (% of audience)">
          <Input
            width="100%"
            value={state.holdoutPct}
            onChangeText={(value) => set('holdoutPct', value)}
            inputMode="decimal"
          />
          <HelpText>
            {state.kind === 'holdout' ? '2% to 50%.' : '0% to 50%. 0 means arms only.'}
          </HelpText>
        </Field>
        <Field label="Minimum sample per arm">
          <Input
            width="100%"
            value={state.minSample}
            onChangeText={(value) => set('minSample', value)}
            inputMode="numeric"
          />
          <HelpText>No result is called until every group reaches this.</HelpText>
        </Field>
        <Field label="End date (optional)">
          <MtdDatePicker
            value={state.endsOn}
            onChange={(value) => set('endsOn', value)}
            minDate={today}
            maxDate={false}
            placeholder="No end date"
          />
          {state.endsOn ? (
            <SizableText
              fontSize={12}
              color={MTD_TOKENS.textMuted}
              cursor="pointer"
              onPress={() => set('endsOn', '')}
            >
              Clear end date
            </SizableText>
          ) : null}
        </Field>
      </XStack>

      {state.kind === 'ab' ? (
        <ArmsEditor arms={state.arms} onChange={(arms) => set('arms', arms)} />
      ) : (
        <HelpText>
          One treatment arm is created automatically for a holdout test.
        </HelpText>
      )}

      <YStack gap="$1.5">
        <FieldLabel>Audience lifecycle stages</FieldLabel>
        <MultiChipGroup
          options={LIFECYCLE_OPTIONS}
          value={state.stages}
          onChange={(stages) => set('stages', stages)}
        />
        <HelpText>
          {state.stages.length
            ? 'Only contacts in these stages are assigned.'
            : 'None selected: every stage is eligible.'}{' '}
          Contacts in the permanent holdout are always excluded.
        </HelpText>
      </YStack>

      <XStack items="center" gap="$3">
        <YStack flex={1} gap="$0.5">
          <SizableText fontSize={14} fontWeight="600" color={MTD_TOKENS.text}>
            Require email consent
          </SizableText>
          <HelpText>Skip contacts who have withdrawn consent for email.</HelpText>
        </YStack>
        <Switch
          checked={state.requireEmailConsent}
          onCheckedChange={(checked) => set('requireEmailConsent', checked)}
          aria-label="Require email consent"
        />
      </XStack>

      {showErrors && errors.length ? (
        <YStack gap="$1">
          {errors.map((error) => (
            <SizableText key={error} fontSize={12} color={MTD_TOKENS.orange}>
              {error}
            </SizableText>
          ))}
        </YStack>
      ) : null}

      <XStack justify="flex-end" gap="$2">
        {onCancel ? (
          <MtdActionButton variant="secondary" onPress={onCancel} disabled={pending}>
            Cancel
          </MtdActionButton>
        ) : null}
        <MtdActionButton loading={pending} onPress={() => void submit()}>
          {isEdit ? 'Save draft' : 'Create draft'}
        </MtdActionButton>
      </XStack>
    </EngineCard>
  )
}
