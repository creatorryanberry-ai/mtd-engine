import { useEffect, useState } from 'react'
import { Linking } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isWeb, ScrollView, SizableText, XStack, YStack } from 'tamagui'

import { API_BASE_URL } from '~/constants/urls'
import { toastError, toastSuccess } from '~/features/engine/client/engineToast'
import { formatRelative, titleCase } from '~/features/engine/client/format'
import {
  useConnectProvider,
  useDisconnect,
  useEngineConnections,
  useEngineConnectors,
  useSyncConnection,
} from '~/features/engine/client/useEngineConnections'
import {
  EmptyState,
  EngineCard,
  EnginePage,
  EngineRow,
  EngineSection,
  ErrorState,
  Field,
  HelpText,
  LoadingState,
  MonoText,
  StatusPill,
} from '~/features/engine/components/EngineUi'
import { MtdActionButton } from '~/features/mtd/components/MtdActionButton'
import { SlideFromRightPanel } from '~/features/mtd/components/SlideFromRightPanel'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { dialogConfirm } from '~/interface/dialogs/actions'
import { Input } from '~/interface/forms/Input'
import { XIcon } from '~/interface/icons/phosphor/XIcon'
import { showToast } from '~/interface/toast/helpers'

import type { ConnectorInfoDto, EngineConnectionDto } from '~/features/engine/contract'

function stripeWebhookUrl(connectionId: string) {
  return `${API_BASE_URL}/api/engine/webhooks/stripe/${connectionId}`
}

function openExternal(url: string) {
  if (isWeb) {
    window.location.assign(url)
    return
  }
  void Linking.openURL(url)
}

function useOauthReturnToast() {
  useEffect(() => {
    if (!isWeb || typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const hubspot = params.get('hubspot')
    const message = params.get('message')
    if (!hubspot) return

    if (hubspot === 'connected') {
      showToast('HubSpot connected', { type: 'success' })
    } else if (hubspot === 'error') {
      showToast(
        message
          ? `HubSpot connection failed: ${message.replace(/_/g, ' ')}`
          : 'HubSpot connection failed',
        { type: 'error' },
      )
    }
    window.history.replaceState({}, '', window.location.pathname)
  }, [])
}

function ApiKeyPanel({
  connector,
  workspaceId,
  onClose,
}: {
  connector: ConnectorInfoDto
  workspaceId: string
  onClose: () => void
}) {
  const insets = useSafeAreaInsets()
  const connect = useConnectProvider(workspaceId)
  const [apiKey, setApiKey] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const isStripe = connector.key === 'stripe'

  const submit = async (requestClose: () => void) => {
    if (!apiKey.trim() || connect.isPending) return
    try {
      await connect.mutateAsync({
        provider: connector.key,
        apiKey: apiKey.trim(),
        ...(webhookSecret.trim() ? { webhookSecret: webhookSecret.trim() } : {}),
      })
      toastSuccess(`${connector.displayName} connected`)
      requestClose()
    } catch (error) {
      toastError(error, `Failed to connect ${connector.displayName}`)
    }
  }

  return (
    <SlideFromRightPanel onClose={onClose}>
      {(requestClose) => (
        <YStack flex={1} bg={MTD_TOKENS.background}>
          <XStack
            px="$4"
            pt={isWeb ? '$3' : insets.top + 12}
            pb="$3"
            items="center"
            justify="space-between"
            borderBottomWidth={1}
            borderColor={MTD_TOKENS.cardBorder}
          >
            <SizableText fontSize={18} fontWeight="600" color={MTD_TOKENS.text} flex={1}>
              Connect {connector.displayName}
            </SizableText>
            <XStack
              width={36}
              height={36}
              rounded="$10"
              bg={MTD_TOKENS.card}
              borderWidth={1}
              borderColor={MTD_TOKENS.cardBorder}
              items="center"
              justify="center"
              cursor="pointer"
              pressStyle={{ opacity: 0.85 }}
              onPress={requestClose}
              aria-label="Close"
            >
              <XIcon size={18} color={MTD_TOKENS.text} />
            </XStack>
          </XStack>

          <ScrollView flex={1} showsVerticalScrollIndicator={false}>
            <YStack
              gap="$4"
              px="$4"
              pt="$4"
              pb={isWeb ? '$8' : insets.bottom + 24}
              maxW={520}
              width="100%"
              mx="auto"
            >
              <HelpText>
                {isStripe
                  ? 'Use a restricted key with read access to charges, invoices, customers, refunds and balance transactions. It is encrypted at rest and never shown again.'
                  : 'The key is encrypted at rest and never shown again.'}
              </HelpText>
              <Field label="API key">
                <Input
                  width="100%"
                  placeholder={isStripe ? 'rk_live_…' : 'API key'}
                  value={apiKey}
                  onChangeText={setApiKey}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </Field>
              {isStripe ? (
                <Field label="Webhook signing secret (optional)">
                  <Input
                    width="100%"
                    placeholder="whsec_…"
                    value={webhookSecret}
                    onChangeText={setWebhookSecret}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </Field>
              ) : null}
              <MtdActionButton
                width="100%"
                size="large"
                disabled={!apiKey.trim()}
                loading={connect.isPending}
                onPress={() => void submit(requestClose)}
              >
                Connect
              </MtdActionButton>
            </YStack>
          </ScrollView>
        </YStack>
      )}
    </SlideFromRightPanel>
  )
}

function ConnectorCard({
  connector,
  connectedCount,
  onConnect,
  isConnecting,
}: {
  connector: ConnectorInfoDto
  connectedCount: number
  onConnect: () => void
  isConnecting: boolean
}) {
  const canConnect = connector.authKind === 'api_key' || connector.configured
  return (
    <EngineCard p="$3.5" gap="$3" grow={1} flexBasis={300} minW={240}>
      <XStack items="flex-start" justify="space-between" gap="$2">
        <YStack gap="$0.5" flex={1}>
          <SizableText fontSize={15} fontWeight="600" color={MTD_TOKENS.text}>
            {connector.displayName}
          </SizableText>
          <SizableText fontSize={12} color={MTD_TOKENS.textMuted}>
            {titleCase(connector.kind)} ·{' '}
            {connector.authKind === 'oauth' ? 'OAuth' : 'API key'}
          </SizableText>
        </YStack>
        <StatusPill
          label={connector.configured ? 'configured' : 'not configured'}
          tone={connector.configured ? 'green' : 'muted'}
        />
      </XStack>
      {connector.scopes.length ? (
        <SizableText fontSize={11} color={MTD_TOKENS.textSubtle} numberOfLines={2}>
          {connector.scopes.join(' · ')}
        </SizableText>
      ) : null}
      <XStack items="center" justify="space-between" gap="$2">
        <SizableText fontSize={12} color={MTD_TOKENS.textSubtle}>
          {connectedCount > 0
            ? `${connectedCount} connected`
            : canConnect
              ? 'Not connected'
              : 'Credentials missing in this environment'}
        </SizableText>
        <MtdActionButton
          size="compact"
          variant={connectedCount > 0 ? 'secondary' : 'primary'}
          disabled={!canConnect}
          loading={isConnecting}
          onPress={onConnect}
        >
          {connectedCount > 0 ? 'Add another' : 'Connect'}
        </MtdActionButton>
      </XStack>
    </EngineCard>
  )
}

function ConnectionRow({
  connection,
  isLast,
  workspaceId,
}: {
  connection: EngineConnectionDto
  isLast: boolean
  workspaceId: string
}) {
  const sync = useSyncConnection(workspaceId)
  const disconnect = useDisconnect(workspaceId)
  const name = connection.displayName || titleCase(connection.provider)

  const runSync = async () => {
    try {
      const result = await sync.mutateAsync(connection.id)
      toastSuccess(result.queued ? `${name} sync queued` : `${name} sync already running`)
    } catch (error) {
      toastError(error, 'Failed to queue sync')
    }
  }

  const runDisconnect = async () => {
    const confirmed = await dialogConfirm({
      title: `Disconnect ${name}?`,
      description:
        'Synced contacts and orders stay. New data stops arriving until you reconnect.',
    })
    if (!confirmed) return
    try {
      await disconnect.mutateAsync(connection.id)
      toastSuccess(`${name} disconnected`)
    } catch (error) {
      toastError(error, 'Failed to disconnect')
    }
  }

  return (
    <YStack borderBottomWidth={isLast ? 0 : 1} borderBottomColor={MTD_TOKENS.cardBorder}>
      <EngineRow isLast flexWrap="wrap">
        <YStack flex={1} minW={160} gap="$0.5">
          <XStack gap="$2" items="center" flexWrap="wrap">
            <SizableText fontSize={14} fontWeight="600" color={MTD_TOKENS.text}>
              {name}
            </SizableText>
            <StatusPill label={connection.status} />
          </XStack>
          <SizableText fontSize={12} color={MTD_TOKENS.textMuted}>
            {titleCase(connection.provider)}
            {connection.externalAccountId ? ` · ${connection.externalAccountId}` : ''} ·
            last sync {formatRelative(connection.lastSyncAt)}
          </SizableText>
          {connection.lastSyncError ? (
            <SizableText fontSize={12} color={MTD_TOKENS.orange} numberOfLines={2}>
              {connection.lastSyncError}
            </SizableText>
          ) : null}
        </YStack>
        <XStack gap="$2">
          <MtdActionButton
            size="compact"
            variant="secondary"
            loading={sync.isPending}
            onPress={() => void runSync()}
          >
            Sync
          </MtdActionButton>
          <MtdActionButton
            size="compact"
            variant="secondary"
            loading={disconnect.isPending}
            onPress={() => void runDisconnect()}
          >
            Disconnect
          </MtdActionButton>
        </XStack>
      </EngineRow>
      {connection.provider === 'stripe' ? (
        <YStack px="$3.5" pb="$3" gap="$1">
          <HelpText>
            Paste this endpoint into Stripe → Developers → Webhooks (events: charge,
            invoice, refund).
          </HelpText>
          <MonoText>{stripeWebhookUrl(connection.id)}</MonoText>
        </YStack>
      ) : null}
    </YStack>
  )
}

export function EngineIntegrationsScreen({ workspaceId }: { workspaceId: string }) {
  const connectors = useEngineConnectors()
  const connections = useEngineConnections(workspaceId)
  const connect = useConnectProvider(workspaceId ?? '')
  const [apiKeyConnector, setApiKeyConnector] = useState<ConnectorInfoDto | null>(null)
  const [oauthPending, setOauthPending] = useState<string | null>(null)

  useOauthReturnToast()

  const startConnect = async (connector: ConnectorInfoDto) => {
    if (!workspaceId) return
    if (connector.authKind === 'api_key') {
      setApiKeyConnector(connector)
      return
    }
    setOauthPending(connector.key)
    try {
      const result = await connect.mutateAsync({
        provider: connector.key,
        returnTo: isWeb && typeof window !== 'undefined' ? window.location.href : null,
      })
      if (result.authorizeUrl) {
        openExternal(result.authorizeUrl)
        return
      }
      toastSuccess(`${connector.displayName} connected`)
    } catch (error) {
      toastError(error, `Failed to connect ${connector.displayName}`)
    } finally {
      setOauthPending(null)
    }
  }

  const countFor = (key: string) =>
    connections.connections.filter((connection) => connection.provider === key).length

  return (
    <EnginePage
      title="Integrations"
      subtitle="Revenue truth and channels. Credentials are encrypted and never leave the server."
    >
      <EngineSection title="Connectors">
        {connectors.isLoading ? <LoadingState label="Loading connectors…" /> : null}
        {connectors.isError ? (
          <EngineCard>
            <ErrorState error={connectors.error} />
          </EngineCard>
        ) : null}
        <XStack gap="$3" flexWrap="wrap">
          {connectors.connectors.map((connector) => (
            <ConnectorCard
              key={connector.key}
              connector={connector}
              connectedCount={countFor(connector.key)}
              isConnecting={oauthPending === connector.key}
              onConnect={() => void startConnect(connector)}
            />
          ))}
        </XStack>
      </EngineSection>

      <EngineSection title="Connections">
        <EngineCard>
          {connections.isLoading ? <LoadingState label="Loading connections…" /> : null}
          {connections.isError ? (
            <ErrorState
              error={connections.error}
              retry={() => void connections.refetch()}
            />
          ) : null}
          {!connections.isLoading &&
          !connections.isError &&
          connections.connections.length === 0 ? (
            <EmptyState
              title="Nothing connected"
              description="Connect Stripe with a restricted key, then press Sync to pull orders and customers."
            />
          ) : null}
          {workspaceId
            ? connections.connections.map((connection, index) => (
                <ConnectionRow
                  key={connection.id}
                  connection={connection}
                  workspaceId={workspaceId}
                  isLast={index === connections.connections.length - 1}
                />
              ))
            : null}
        </EngineCard>
      </EngineSection>

      {apiKeyConnector && workspaceId ? (
        <ApiKeyPanel
          connector={apiKeyConnector}
          workspaceId={workspaceId}
          onClose={() => setApiKeyConnector(null)}
        />
      ) : null}
    </EnginePage>
  )
}
