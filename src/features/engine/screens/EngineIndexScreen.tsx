import { Redirect, router } from 'one'
import { useState } from 'react'
import { SizableText, XStack, YStack } from 'tamagui'

import { ENGINE_ROUTES } from '~/features/engine/client/engineRoutes'
import { toastError, toastSuccess } from '~/features/engine/client/engineToast'
import {
  useCreateWorkspace,
  useEngineWorkspaces,
} from '~/features/engine/client/useEngineWorkspaces'
import {
  ChipGroup,
  EngineCard,
  EnginePage,
  ErrorState,
  Field,
  HelpText,
  LoadingState,
} from '~/features/engine/components/EngineUi'
import { MtdActionButton } from '~/features/mtd/components/MtdActionButton'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { Input } from '~/interface/forms/Input'

const CURRENCIES = [
  { id: 'GBP', label: 'GBP' },
  { id: 'EUR', label: 'EUR' },
  { id: 'USD', label: 'USD' },
] as const

type Currency = (typeof CURRENCIES)[number]['id']

function CreateWorkspaceForm() {
  const create = useCreateWorkspace()
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState<Currency>('GBP')
  const canSave = name.trim().length >= 2 && !create.isPending

  const submit = async () => {
    if (!canSave) return
    try {
      const workspace = await create.mutateAsync({ name: name.trim(), currency })
      toastSuccess(`Workspace "${workspace.name}" created`)
      router.replace(ENGINE_ROUTES.workspace(workspace.id))
    } catch (error) {
      toastError(error, 'Failed to create workspace')
    }
  }

  return (
    <EngineCard p="$4" gap="$4" maxW={520}>
      <YStack gap="$1">
        <SizableText fontSize={16} fontWeight="600" color={MTD_TOKENS.text}>
          Create your first workspace
        </SizableText>
        <HelpText>
          A workspace holds one business: its brand kit, connections, contacts and
          revenue. You become the owner.
        </HelpText>
      </YStack>
      <Field label="Business name">
        <Input
          width="100%"
          placeholder="Northstar Roofing"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          onSubmitEditing={() => void submit()}
        />
      </Field>
      <Field label="Currency">
        <ChipGroup options={[...CURRENCIES]} value={currency} onChange={setCurrency} />
      </Field>
      <XStack justify="flex-end">
        <MtdActionButton
          disabled={!canSave}
          loading={create.isPending}
          onPress={() => void submit()}
        >
          Create workspace
        </MtdActionButton>
      </XStack>
    </EngineCard>
  )
}

export function EngineIndexScreen() {
  const { workspaces, isLoading, isError, error, refetch } = useEngineWorkspaces()

  if (isLoading) {
    return (
      <EnginePage title="Growth engine">
        <LoadingState label="Loading workspaces…" />
      </EnginePage>
    )
  }

  if (isError) {
    return (
      <EnginePage title="Growth engine">
        <EngineCard>
          <ErrorState error={error} retry={() => void refetch()} />
        </EngineCard>
      </EnginePage>
    )
  }

  const first = workspaces[0]
  if (first) {
    return <Redirect href={ENGINE_ROUTES.workspace(first.id)} />
  }

  return (
    <EnginePage
      title="Growth engine"
      subtitle="An autonomous sales and marketing loop that optimises for gross profit."
    >
      <CreateWorkspaceForm />
    </EnginePage>
  )
}
