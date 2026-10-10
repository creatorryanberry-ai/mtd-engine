import { SizableText, XStack, YStack } from 'tamagui'

import {
  contactDisplayName,
  formatDateTime,
  formatMinor,
  formatRelative,
  titleCase,
} from '~/features/engine/client/format'
import {
  useEngineContacts,
  useEngineOrders,
} from '~/features/engine/client/useEngineInsights'
import {
  EmptyState,
  EngineCard,
  EnginePage,
  EngineRow,
  EngineSection,
  ErrorState,
  LoadMoreButton,
  LoadingState,
  StatusPill,
} from '~/features/engine/components/EngineUi'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'

function HeaderCell({
  children,
  flex = 1,
  width,
}: {
  children: string
  flex?: number
  width?: number
}) {
  return (
    <SizableText
      fontSize={11}
      fontWeight="600"
      color={MTD_TOKENS.textSubtle}
      textTransform="uppercase"
      letterSpacing={0.6}
      flex={width ? undefined : flex}
      width={width}
    >
      {children}
    </SizableText>
  )
}

function ContactsList({ workspaceId }: { workspaceId: string | undefined }) {
  const contacts = useEngineContacts(workspaceId)

  return (
    <EngineCard>
      <EngineRow bg={MTD_TOKENS.cardInset} display="none" $md={{ display: 'flex' }}>
        <HeaderCell flex={2}>Name</HeaderCell>
        <HeaderCell flex={2}>Email</HeaderCell>
        <HeaderCell>Stage</HeaderCell>
        <HeaderCell>Uplift</HeaderCell>
        <HeaderCell>Last activity</HeaderCell>
      </EngineRow>

      {contacts.isLoading ? <LoadingState label="Loading contacts…" /> : null}
      {contacts.isError ? (
        <ErrorState error={contacts.error} retry={() => void contacts.refetch()} />
      ) : null}
      {!contacts.isLoading && !contacts.isError && contacts.items.length === 0 ? (
        <EmptyState
          title="No contacts yet"
          description="Sync a CRM or revenue connection and contacts will appear here."
        />
      ) : null}

      {contacts.items.map((contact, index) => (
        <EngineRow
          key={contact.id}
          isLast={index === contacts.items.length - 1 && !contacts.hasMore}
          flexDirection="column"
          items="stretch"
          gap="$1"
          $md={{ flexDirection: 'row', items: 'center', gap: '$3' }}
        >
          <SizableText
            fontSize={14}
            fontWeight="500"
            color={MTD_TOKENS.text}
            flex={2}
            numberOfLines={1}
          >
            {contactDisplayName(contact)}
          </SizableText>
          <SizableText
            fontSize={13}
            color={MTD_TOKENS.textMuted}
            flex={2}
            numberOfLines={1}
          >
            {contact.email ?? '—'}
          </SizableText>
          <XStack flex={1}>
            <StatusPill label={contact.lifecycleStage} />
          </XStack>
          <SizableText fontSize={13} color={MTD_TOKENS.textMuted} flex={1}>
            {contact.upliftClass ? titleCase(contact.upliftClass) : '—'}
          </SizableText>
          <SizableText fontSize={12} color={MTD_TOKENS.textSubtle} flex={1}>
            {formatRelative(contact.lastActivityAt)}
          </SizableText>
        </EngineRow>
      ))}

      <LoadMoreButton
        hasMore={contacts.hasMore}
        isLoading={contacts.isLoadingMore}
        onPress={contacts.loadMore}
      />
    </EngineCard>
  )
}

function OrdersList({ workspaceId }: { workspaceId: string | undefined }) {
  const orders = useEngineOrders(workspaceId)

  return (
    <EngineCard>
      <EngineRow bg={MTD_TOKENS.cardInset} display="none" $md={{ display: 'flex' }}>
        <HeaderCell flex={2}>Date</HeaderCell>
        <HeaderCell>Source</HeaderCell>
        <HeaderCell>Revenue</HeaderCell>
        <HeaderCell>Gross profit</HeaderCell>
        <HeaderCell>Status</HeaderCell>
      </EngineRow>

      {orders.isLoading ? <LoadingState label="Loading orders…" /> : null}
      {orders.isError ? (
        <ErrorState error={orders.error} retry={() => void orders.refetch()} />
      ) : null}
      {!orders.isLoading && !orders.isError && orders.items.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="Connect Stripe and press Sync to pull revenue in."
        />
      ) : null}

      {orders.items.map((order, index) => (
        <EngineRow
          key={order.id}
          isLast={index === orders.items.length - 1 && !orders.hasMore}
          flexDirection="column"
          items="stretch"
          gap="$1"
          $md={{ flexDirection: 'row', items: 'center', gap: '$3' }}
        >
          <XStack flex={2} gap="$2" items="center">
            <SizableText fontSize={13} color={MTD_TOKENS.text}>
              {formatDateTime(order.occurredAt)}
            </SizableText>
            {order.isFirstOrder ? <StatusPill label="first order" tone="purple" /> : null}
          </XStack>
          <SizableText fontSize={13} color={MTD_TOKENS.textMuted} flex={1}>
            {titleCase(order.source)}
          </SizableText>
          <SizableText fontSize={13} color={MTD_TOKENS.text} flex={1}>
            {formatMinor(order.revenueMinor, order.currency)}
          </SizableText>
          <SizableText
            fontSize={13}
            fontWeight="600"
            color={order.grossProfitMinor >= 0 ? MTD_TOKENS.green : MTD_TOKENS.orange}
            flex={1}
          >
            {formatMinor(order.grossProfitMinor, order.currency)}
          </SizableText>
          <XStack flex={1}>
            <StatusPill label={order.status} />
          </XStack>
        </EngineRow>
      ))}

      <LoadMoreButton
        hasMore={orders.hasMore}
        isLoading={orders.isLoadingMore}
        onPress={orders.loadMore}
      />
    </EngineCard>
  )
}

export function EngineAudiencesScreen({ workspaceId }: { workspaceId: string }) {
  return (
    <EnginePage
      title="Audiences"
      subtitle="Contacts resolved across every connection, and the orders they produced."
    >
      <YStack gap="$5">
        <EngineSection title="Contacts">
          <ContactsList workspaceId={workspaceId} />
        </EngineSection>
        <EngineSection title="Recent orders">
          <OrdersList workspaceId={workspaceId} />
        </EngineSection>
      </YStack>
    </EnginePage>
  )
}
