import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isWeb, ScrollView, SizableText, Spinner, XStack, YStack } from 'tamagui'

import { MtdActionButton } from '~/features/mtd/components/MtdActionButton'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'

import type { ReactNode } from 'react'
import type { ColorTokens, YStackProps } from 'tamagui'

export const ENGINE_MAX_WIDTH = 1100

export function EnginePage({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
}) {
  const insets = useSafeAreaInsets()

  const content = (
    <YStack
      gap="$5"
      px="$4"
      pt="$4"
      pb={isWeb ? '$8' : insets.bottom + 24}
      maxW={ENGINE_MAX_WIDTH}
      width="100%"
      mx="auto"
      $lg={{ px: '$6', pt: '$6' }}
    >
      <XStack items="flex-start" justify="space-between" gap="$3" flexWrap="wrap">
        <YStack gap="$1" flex={1} minW={200}>
          <SizableText
            fontSize={22}
            fontWeight="700"
            color={MTD_TOKENS.text}
            lineHeight={28}
          >
            {title}
          </SizableText>
          {subtitle ? (
            <SizableText fontSize={14} color={MTD_TOKENS.textMuted} lineHeight={20}>
              {subtitle}
            </SizableText>
          ) : null}
        </YStack>
        {actions ? (
          <XStack gap="$2" items="center" flexWrap="wrap">
            {actions}
          </XStack>
        ) : null}
      </XStack>
      {children}
    </YStack>
  )

  if (isWeb) {
    return (
      <YStack flex={1} minH={0} overflow="scroll">
        {content}
      </YStack>
    )
  }

  return (
    <ScrollView flex={1} bg={MTD_TOKENS.background} showsVerticalScrollIndicator={false}>
      {content}
    </ScrollView>
  )
}

export function SectionLabel({
  children,
  right,
}: {
  children: string
  right?: ReactNode
}) {
  return (
    <XStack items="center" justify="space-between" px="$1">
      <SizableText
        fontSize={12}
        fontWeight="600"
        color={MTD_TOKENS.textSubtle}
        textTransform="uppercase"
        letterSpacing={0.8}
      >
        {children}
      </SizableText>
      {right}
    </XStack>
  )
}

export function EngineSection({
  title,
  right,
  children,
}: {
  title: string
  right?: ReactNode
  children: ReactNode
}) {
  return (
    <YStack gap="$2.5">
      <SectionLabel right={right}>{title}</SectionLabel>
      {children}
    </YStack>
  )
}

export function EngineCard({
  children,
  ...props
}: YStackProps & { children: ReactNode }) {
  return (
    <YStack
      bg={MTD_TOKENS.card}
      borderWidth={1}
      borderColor={MTD_TOKENS.cardBorder}
      rounded="$4"
      overflow="hidden"
      {...props}
    >
      {children}
    </YStack>
  )
}

export function EngineRow({
  children,
  isLast,
  ...props
}: YStackProps & { children: ReactNode; isLast?: boolean }) {
  return (
    <XStack
      px="$3.5"
      py="$3"
      gap="$3"
      items="center"
      borderBottomWidth={isLast ? 0 : 1}
      borderBottomColor={MTD_TOKENS.cardBorder}
      {...props}
    >
      {children}
    </XStack>
  )
}

export function FieldLabel({ children }: { children: string }) {
  return (
    <SizableText
      fontSize={13}
      fontWeight="600"
      color={MTD_TOKENS.textMuted}
      lineHeight={18}
    >
      {children}
    </SizableText>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  // grow to share a row's width, but keep an auto basis so a column never collapses it to 0 height
  return (
    <YStack gap="$1.5" grow={1} shrink={1} flexBasis="auto" minW={160}>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </YStack>
  )
}

export function HelpText({ children }: { children: ReactNode }) {
  return (
    <SizableText fontSize={12} color={MTD_TOKENS.textSubtle} lineHeight={16}>
      {children}
    </SizableText>
  )
}

export function MonoText({ children, ...props }: { children: ReactNode } & YStackProps) {
  return (
    <YStack bg={MTD_TOKENS.cardInset} rounded="$3" px="$3" py="$2" {...props}>
      <SizableText fontFamily="$mono" fontSize={12} color={MTD_TOKENS.text} select="text">
        {children}
      </SizableText>
    </YStack>
  )
}

type PillTone = 'green' | 'orange' | 'blue' | 'purple' | 'muted'

const toneColor: Record<PillTone, ColorTokens> = {
  green: MTD_TOKENS.green,
  orange: MTD_TOKENS.orange,
  blue: MTD_TOKENS.blue,
  purple: MTD_TOKENS.purple,
  muted: MTD_TOKENS.textMuted,
}

export function toneForStatus(status: string): PillTone {
  switch (status) {
    case 'active':
    case 'connected':
    case 'ok':
    case 'succeeded':
    case 'paid':
    case 'customer':
      return 'green'
    case 'error':
    case 'expired':
    case 'failed':
    case 'refunded':
    case 'critical':
      return 'orange'
    case 'pending':
    case 'syncing':
    case 'lead':
    case 'warning':
      return 'blue'
    case 'opportunity':
      return 'purple'
    default:
      return 'muted'
  }
}

export function StatusPill({ label, tone }: { label: string; tone?: PillTone }) {
  const color = toneColor[tone ?? toneForStatus(label)]
  return (
    <XStack
      px="$2"
      py={2}
      rounded="$10"
      borderWidth={1}
      borderColor={color}
      items="center"
      gap="$1.5"
      self="flex-start"
    >
      <YStack width={6} height={6} rounded="$10" bg={color} />
      <SizableText
        fontSize={11}
        fontWeight="600"
        color={color}
        textTransform="capitalize"
      >
        {label.replace(/_/g, ' ')}
      </SizableText>
    </XStack>
  )
}

export function EmptyState({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <YStack px="$4" py="$6" items="center" gap="$1">
      <SizableText
        fontSize={14}
        fontWeight="600"
        color={MTD_TOKENS.textMuted}
        text="center"
      >
        {title}
      </SizableText>
      {description ? (
        <SizableText
          fontSize={13}
          color={MTD_TOKENS.textSubtle}
          text="center"
          lineHeight={18}
        >
          {description}
        </SizableText>
      ) : null}
    </YStack>
  )
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <XStack px="$4" py="$6" items="center" justify="center" gap="$2">
      <Spinner size="small" color={MTD_TOKENS.orange} />
      <SizableText fontSize={13} color={MTD_TOKENS.textMuted}>
        {label}
      </SizableText>
    </XStack>
  )
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Something went wrong'
  return (
    <YStack px="$4" py="$5" items="center" gap="$3">
      <SizableText fontSize={13} color={MTD_TOKENS.orange} text="center">
        {message}
      </SizableText>
      {retry ? (
        <MtdActionButton size="compact" variant="secondary" onPress={retry}>
          Try again
        </MtdActionButton>
      ) : null}
    </YStack>
  )
}

export function LoadMoreButton({
  hasMore,
  isLoading,
  onPress,
}: {
  hasMore: boolean | undefined
  isLoading: boolean
  onPress: () => void
}) {
  if (!hasMore) return null
  return (
    <XStack px="$3.5" py="$3" justify="center">
      <MtdActionButton
        size="compact"
        variant="secondary"
        loading={isLoading}
        onPress={onPress}
      >
        Load more
      </MtdActionButton>
    </XStack>
  )
}

export function StatTile({
  label,
  value,
  sub,
  subTone = 'muted',
}: {
  label: string
  value: string
  sub?: string | null
  subTone?: PillTone
}) {
  return (
    <EngineCard p="$3.5" gap="$1" grow={1} flexBasis={200} minW={160}>
      <SizableText
        fontSize={11}
        fontWeight="600"
        color={MTD_TOKENS.textSubtle}
        textTransform="uppercase"
        letterSpacing={0.6}
      >
        {label}
      </SizableText>
      <SizableText fontSize={22} fontWeight="700" color={MTD_TOKENS.text} lineHeight={28}>
        {value}
      </SizableText>
      {sub ? (
        <SizableText fontSize={12} color={toneColor[subTone]} lineHeight={16}>
          {sub}
        </SizableText>
      ) : null}
    </EngineCard>
  )
}

export function ProgressBar({
  ratio,
  tone = 'green',
}: {
  ratio: number
  tone?: PillTone
}) {
  const clamped = Math.min(Math.max(ratio, 0), 1)
  return (
    <YStack
      height={8}
      rounded="$10"
      bg={MTD_TOKENS.cardInset}
      overflow="hidden"
      width="100%"
    >
      <YStack
        height="100%"
        width={`${Math.round(clamped * 100)}%`}
        bg={toneColor[tone]}
      />
    </YStack>
  )
}

export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[]
  value: T
  onChange: (next: T) => void
}) {
  return (
    <XStack gap="$1.5" flexWrap="wrap">
      {options.map((option) => {
        const selected = option.id === value
        return (
          <XStack
            key={option.id}
            px="$2.5"
            py="$1.5"
            rounded="$10"
            borderWidth={1}
            borderColor={selected ? MTD_TOKENS.orange : MTD_TOKENS.cardBorder}
            bg={selected ? MTD_TOKENS.orangeMuted : 'transparent'}
            cursor="pointer"
            pressStyle={{ opacity: 0.85 }}
            onPress={() => onChange(option.id)}
          >
            <SizableText
              fontSize={12}
              fontWeight={selected ? '600' : '500'}
              color={selected ? MTD_TOKENS.orange : MTD_TOKENS.textMuted}
            >
              {option.label}
            </SizableText>
          </XStack>
        )
      })}
    </XStack>
  )
}

export function MultiChipGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[]
  value: T[]
  onChange: (next: T[]) => void
}) {
  return (
    <XStack gap="$1.5" flexWrap="wrap">
      {options.map((option) => {
        const selected = value.includes(option.id)
        return (
          <XStack
            key={option.id}
            px="$2.5"
            py="$1.5"
            rounded="$10"
            borderWidth={1}
            borderColor={selected ? MTD_TOKENS.orange : MTD_TOKENS.cardBorder}
            bg={selected ? MTD_TOKENS.orangeMuted : 'transparent'}
            cursor="pointer"
            pressStyle={{ opacity: 0.85 }}
            role="checkbox"
            aria-checked={selected}
            onPress={() =>
              onChange(
                selected
                  ? value.filter((item) => item !== option.id)
                  : [...value, option.id],
              )
            }
          >
            <SizableText
              fontSize={12}
              fontWeight={selected ? '600' : '500'}
              color={selected ? MTD_TOKENS.orange : MTD_TOKENS.textMuted}
            >
              {option.label}
            </SizableText>
          </XStack>
        )
      })}
    </XStack>
  )
}

export function IconButton({
  children,
  onPress,
  label,
}: {
  children: ReactNode
  onPress: () => void
  label: string
}) {
  return (
    <XStack
      width={32}
      height={32}
      rounded="$10"
      items="center"
      justify="center"
      cursor="pointer"
      hoverStyle={{ bg: MTD_TOKENS.cardInset }}
      pressStyle={{ opacity: 0.8 }}
      onPress={onPress}
      aria-label={label}
    >
      {children}
    </XStack>
  )
}
