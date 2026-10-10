import { useState } from 'react'
import { SizableText, XStack, YStack } from 'tamagui'

import { formatAction, formatDateTime, titleCase } from '~/features/engine/client/format'
import { useEngineAudit } from '~/features/engine/client/useEngineInsights'
import {
  EmptyState,
  EngineCard,
  EnginePage,
  EngineRow,
  ErrorState,
  LoadMoreButton,
  LoadingState,
  MonoText,
  StatusPill,
} from '~/features/engine/components/EngineUi'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { CaretDownIcon } from '~/interface/icons/phosphor/CaretDownIcon'
import { CaretRightIcon } from '~/interface/icons/phosphor/CaretRightIcon'

import type { EngineAuditLogDto } from '~/features/engine/contract'

function actorLabel(actor: string) {
  if (actor.startsWith('agent:')) return `Agent · ${titleCase(actor.slice(6))}`
  if (actor.startsWith('system')) return 'System'
  if (actor.startsWith('user:')) return 'You'
  return actor
}

function JsonBlock({
  label,
  value,
}: {
  label: string
  value: Record<string, unknown> | null
}) {
  return (
    <YStack gap="$1" grow={1} flexBasis={260} minW={0}>
      <SizableText
        fontSize={11}
        fontWeight="600"
        color={MTD_TOKENS.textSubtle}
        textTransform="uppercase"
      >
        {label}
      </SizableText>
      <MonoText>{value ? JSON.stringify(value, null, 2) : 'null'}</MonoText>
    </YStack>
  )
}

function AuditEntry({ entry, isLast }: { entry: EngineAuditLogDto; isLast: boolean }) {
  const [open, setOpen] = useState(false)
  const hasDiff = entry.before != null || entry.after != null
  const Caret = open ? CaretDownIcon : CaretRightIcon

  return (
    <YStack borderBottomWidth={isLast ? 0 : 1} borderBottomColor={MTD_TOKENS.cardBorder}>
      <EngineRow
        isLast
        items="flex-start"
        cursor={hasDiff ? 'pointer' : undefined}
        hoverStyle={hasDiff ? { bg: MTD_TOKENS.cardInset } : undefined}
        onPress={hasDiff ? () => setOpen((value) => !value) : undefined}
      >
        <YStack width={16} pt={2} shrink={0}>
          {hasDiff ? <Caret size={14} color={MTD_TOKENS.textSubtle} /> : null}
        </YStack>
        <YStack flex={1} gap="$1" minW={0}>
          <XStack gap="$2" items="center" flexWrap="wrap">
            <SizableText fontSize={14} fontWeight="600" color={MTD_TOKENS.text}>
              {formatAction(entry.action)}
            </SizableText>
            {entry.entityType ? (
              <StatusPill label={entry.entityType} tone="muted" />
            ) : null}
            {entry.autonomyLevel != null ? (
              <StatusPill label={`autonomy ${entry.autonomyLevel}`} tone="blue" />
            ) : null}
          </XStack>
          <SizableText fontSize={12} color={MTD_TOKENS.textMuted}>
            {actorLabel(entry.actor)} · {formatDateTime(entry.createdAt)}
            {entry.entityId ? ` · ${entry.entityId}` : ''}
          </SizableText>
          {entry.reasoning ? (
            <SizableText fontSize={13} color={MTD_TOKENS.text} lineHeight={18}>
              {entry.reasoning}
            </SizableText>
          ) : null}
        </YStack>
      </EngineRow>
      {open ? (
        <XStack px="$3.5" pb="$3.5" pl={44} gap="$3" flexWrap="wrap">
          <JsonBlock label="Before" value={entry.before} />
          <JsonBlock label="After" value={entry.after} />
        </XStack>
      ) : null}
    </YStack>
  )
}

export function EngineAuditScreen({ workspaceId }: { workspaceId: string }) {
  const audit = useEngineAudit(workspaceId)

  return (
    <EnginePage
      title="Audit log"
      subtitle="Every change, by a person or an agent, with its reasoning and the before and after."
    >
      <EngineCard>
        {audit.isLoading ? <LoadingState label="Loading audit log…" /> : null}
        {audit.isError ? (
          <ErrorState error={audit.error} retry={() => void audit.refetch()} />
        ) : null}
        {!audit.isLoading && !audit.isError && audit.items.length === 0 ? (
          <EmptyState
            title="Nothing logged yet"
            description="Actions appear here as they happen."
          />
        ) : null}
        {audit.items.map((entry, index) => (
          <AuditEntry
            key={entry.id}
            entry={entry}
            isLast={index === audit.items.length - 1 && !audit.hasMore}
          />
        ))}
        <LoadMoreButton
          hasMore={audit.hasMore}
          isLoading={audit.isLoadingMore}
          onPress={audit.loadMore}
        />
      </EngineCard>
    </EnginePage>
  )
}
