import { useMemo, useRef, useState } from 'react'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Redirect } from 'one'
import { isWeb, ScrollView, SizableText, Spinner, XStack, YStack } from 'tamagui'

import { useAuth } from '~/features/auth/client/authClient'
import { useBusinessSettings } from '~/features/business/useBusinessSettings'
import {
  MILEAGE_LIST_PAGE_SIZE,
  useMileageEntries,
} from '~/features/mileage/client/useMileageEntries'
import { useMileageSeries } from '~/features/mileage/client/useMileageSeries'
import { MileageEditScreen } from '~/features/mileage/components/MileageEditScreen'
import {
  MileageScopeScreen,
  type MileageEditScope,
} from '~/features/mileage/components/MileageScopeScreen'
import { MileageSeriesDetailsScreen } from '~/features/mileage/components/MileageSeriesDetailsScreen'
import { MileageSwipeableRow } from '~/features/mileage/components/MileageSwipeableRow'
import { formatMileageClaimPounds } from '~/features/mileage/utils/mileageClaim'
import {
  confirmDeleteMileageEntry,
  confirmStopMileageSeries,
} from '~/features/mileage/utils/confirmDeleteMileageEntry'
import { getReviewWizardMileageIds } from '~/features/mtd/components/review-wizard/reviewWizardEntriesStorage'
import { MtdActionButton } from '~/features/mtd/components/MtdActionButton'
import { MtdDetailHeader } from '~/features/mtd/components/MtdDetailHeader'
import { MTD_ROUTES, MTD_TAB_BAR_HEIGHT } from '~/features/mtd/constants'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { useSubmissionPeriod } from '~/features/mtd/context/TaxYearProvider'
import { PlusIcon } from '~/interface/icons/phosphor/PlusIcon'

import type { MileageEntryDto } from '~/features/mileage/client/useMileageEntries'
import type { MileageSeriesDto } from '~/features/mileage/mileageSeriesTypes'

type EditorState =
  | { type: 'create' }
  | {
      type: 'edit'
      entry: MileageEntryDto | null
      series: MileageSeriesDto | null
      scope: MileageEditScope | null
    }

type ScopePrompt = {
  entry: MileageEntryDto
  mode: 'edit' | 'delete'
}

const LOAD_MORE_THRESHOLD = 360

function isNearBottom(event: NativeSyntheticEvent<NativeScrollEvent>) {
  const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent
  return (
    layoutMeasurement.height + contentOffset.y >= contentSize.height - LOAD_MORE_THRESHOLD
  )
}

function MileageTableHeader() {
  return (
    <XStack
      px="$3"
      py="$2.5"
      bg={MTD_TOKENS.cardInset}
      borderBottomWidth={1}
      borderColor={MTD_TOKENS.cardBorder}
      gap="$3"
    >
      <SizableText flex={1} fontSize={12} fontWeight="500" color={MTD_TOKENS.textMuted}>
        Date
      </SizableText>
      <SizableText
        flex={1}
        fontSize={12}
        fontWeight="500"
        color={MTD_TOKENS.textMuted}
        text="right"
      >
        Mileage
      </SizableText>
      <SizableText
        flex={1}
        fontSize={12}
        fontWeight="500"
        color={MTD_TOKENS.textMuted}
        text="right"
      >
        Rate
      </SizableText>
      <SizableText
        flex={1}
        fontSize={12}
        fontWeight="500"
        color={MTD_TOKENS.textMuted}
        text="right"
      >
        Claim
      </SizableText>
    </XStack>
  )
}

export function MileageScreen() {
  const insets = useSafeAreaInsets()
  const auth = useAuth()
  const userId = auth?.user?.id
  const { taxYearStart, quarterId } = useSubmissionPeriod()
  const { settings, isLoading: isSettingsLoading } = useBusinessSettings()
  const {
    entries,
    totalCount,
    totalClaimPounds,
    isLoading,
    isLoadingMore,
    error,
    refresh,
    loadMore,
    deleteEntry,
  } = useMileageEntries({ pageSize: MILEAGE_LIST_PAGE_SIZE })
  const { series, refresh: refreshSeries, deleteSeries, getSeries } = useMileageSeries()
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [scopePrompt, setScopePrompt] = useState<ScopePrompt | null>(null)
  const [viewingSeries, setViewingSeries] = useState<MileageSeriesDto | null>(null)

  const viewportHeightRef = useRef(0)

  const seriesById = useMemo(
    () => new Map(series.map((item) => [item.id, item])),
    [series],
  )

  const wizardMileageIds = useMemo(() => {
    if (!userId) return new Set<string>()
    return getReviewWizardMileageIds(userId, taxYearStart, quarterId)
  }, [entries, quarterId, userId, taxYearStart])

  const visibleEntries = useMemo(
    () => entries.filter((entry) => !wizardMileageIds.has(entry.id)),
    [entries, wizardMileageIds],
  )

  const refreshAll = () => {
    void refresh()
    void refreshSeries()
  }

  const handleDeleteEntry = async (entry: MileageEntryDto) => {
    if (entry.seriesId) {
      setScopePrompt({ entry, mode: 'delete' })
      return
    }
    await deleteEntry(entry.id)
    refreshAll()
  }

  const handleOpenEntry = (entry: MileageEntryDto) => {
    if (entry.seriesId) {
      setScopePrompt({ entry, mode: 'edit' })
      return
    }
    setEditor({ type: 'edit', entry, series: null, scope: null })
  }

  const handleScopeSelect = async (scope: MileageEditScope) => {
    if (!scopePrompt) return
    const { entry, mode } = scopePrompt
    const linked = entry.seriesId ? (seriesById.get(entry.seriesId) ?? null) : null
    setScopePrompt(null)

    if (mode === 'edit') {
      setEditor({ type: 'edit', entry, series: linked, scope })
      return
    }

    if (scope === 'this') {
      const confirmed = await confirmDeleteMileageEntry(entry)
      if (!confirmed) return
      await deleteEntry(entry.id)
      refreshAll()
      return
    }

    if (!linked) return

    if (scope === 'thisAndFuture') {
      await deleteSeries(linked.id, { type: 'thisAndFuture', fromDate: entry.date })
      refreshAll()
      return
    }

    const confirmed = await confirmStopMileageSeries()
    if (!confirmed) return
    await deleteSeries(linked.id, { type: 'entireSeries' })
    refreshAll()
  }

  if (!isSettingsLoading && settings?.vehicleClaimMethod !== 'mileage') {
    return <Redirect href={MTD_ROUTES.overview} />
  }

  const totalClaim = totalClaimPounds

  const content = (
    <ScrollView
      flex={1}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      onLayout={(event) => {
        viewportHeightRef.current = event.nativeEvent.layout.height
      }}
      onContentSizeChange={(_width, height) => {
        if (height <= viewportHeightRef.current + LOAD_MORE_THRESHOLD) {
          void loadMore()
        }
      }}
      onScroll={(event) => {
        if (isNearBottom(event)) void loadMore()
      }}
    >
      <YStack
        gap="$4"
        px="$4"
        pt="$5"
        pb={isWeb ? '$6' : insets.bottom + MTD_TAB_BAR_HEIGHT + 24}
        maxW={720}
        width="100%"
        mx="auto"
        $lg={{ px: '$6', pt: '$6' }}
      >
        <XStack items="center" justify="space-between" gap="$3" flexWrap="wrap">
          <YStack gap="$1" flex={1}>
            <SizableText fontSize={14} color={MTD_TOKENS.textMuted} lineHeight={21}>
              Record business journeys at 55p per mile for the first 10,000 miles each tax
              year, then 25p.
            </SizableText>
          </YStack>

          <MtdActionButton
            variant="secondary"
            icon={<PlusIcon size={18} color={MTD_TOKENS.text} />}
            onPress={() => setEditor({ type: 'create' })}
          >
            Add journey
          </MtdActionButton>
        </XStack>

        {isLoading || isSettingsLoading ? (
          <XStack py="$8" justify="center">
            <Spinner size="large" color={MTD_TOKENS.orange} />
          </XStack>
        ) : error ? (
          <SizableText fontSize={14} color={MTD_TOKENS.orange}>
            {error}
          </SizableText>
        ) : totalCount === 0 ? (
          <YStack
            bg={MTD_TOKENS.card}
            borderWidth={1}
            borderColor={MTD_TOKENS.cardBorder}
            rounded="$5"
            p="$5"
            gap="$2"
            items="center"
          >
            <SizableText fontSize={15} fontWeight="600" color={MTD_TOKENS.text}>
              No mileage recorded yet
            </SizableText>
            <SizableText fontSize={14} color={MTD_TOKENS.textMuted} text="center">
              Tap Add journey to record your first trip.
            </SizableText>
          </YStack>
        ) : (
          <YStack
            bg={MTD_TOKENS.card}
            borderWidth={1}
            borderColor={MTD_TOKENS.cardBorder}
            rounded="$5"
            overflow="hidden"
          >
            <MileageTableHeader />
            {visibleEntries.map((entry) => (
              <MileageSwipeableRow
                key={entry.id}
                entry={entry}
                fromLocation={
                  entry.seriesId
                    ? (seriesById.get(entry.seriesId)?.fromLocation ?? null)
                    : null
                }
                onPress={() => handleOpenEntry(entry)}
                onPressSeries={
                  entry.seriesId
                    ? () => {
                        const seriesId = entry.seriesId
                        if (!seriesId) return
                        const cached = seriesById.get(seriesId)
                        if (cached) setViewingSeries(cached)
                        void getSeries(seriesId).then(setViewingSeries)
                      }
                    : undefined
                }
                onDelete={handleDeleteEntry}
              />
            ))}
            {isLoadingMore ? (
              <XStack py="$3" justify="center">
                <Spinner size="small" color={MTD_TOKENS.orange} />
              </XStack>
            ) : null}
            <XStack
              px="$3"
              py="$3"
              justify="flex-end"
              bg={MTD_TOKENS.cardInset}
              borderTopWidth={1}
              borderColor={MTD_TOKENS.cardBorder}
            >
              <SizableText fontSize={14} fontWeight="600" color={MTD_TOKENS.text}>
                Total claim: {formatMileageClaimPounds(totalClaim)}
              </SizableText>
            </XStack>
          </YStack>
        )}
      </YStack>
    </ScrollView>
  )

  return (
    <YStack flex={1} bg={MTD_TOKENS.background}>
      {isWeb ? (
        <>
          <MtdDetailHeader backHref={MTD_ROUTES.records} title="Mileage" />
          <YStack flex={1} py="$2">
            {content}
          </YStack>
        </>
      ) : (
        <>
          <YStack pt={insets.top}>
            <MtdDetailHeader
              backHref={MTD_ROUTES.records}
              title="Mileage"
              rightActions={<YStack width={36} height={36} />}
            />
          </YStack>
          {content}
        </>
      )}

      {editor ? (
        <MileageEditScreen
          key={
            editor.type === 'create'
              ? 'mileage-create'
              : `${editor.entry?.id ?? editor.series?.id}-${editor.scope ?? 'single'}`
          }
          entry={editor.type === 'create' ? null : editor.entry}
          series={editor.type === 'create' ? null : editor.series}
          scope={editor.type === 'create' ? null : editor.scope}
          existingEntries={entries}
          onClose={() => setEditor(null)}
          onSaved={refreshAll}
          onDeleted={() => {
            refreshAll()
            setEditor(null)
          }}
        />
      ) : null}

      {scopePrompt ? (
        <MileageScopeScreen
          mode={scopePrompt.mode}
          entry={scopePrompt.entry}
          series={
            scopePrompt.entry.seriesId
              ? (seriesById.get(scopePrompt.entry.seriesId) ?? null)
              : null
          }
          onSelect={(scope) => void handleScopeSelect(scope)}
          onClose={() => setScopePrompt(null)}
        />
      ) : null}

      {viewingSeries ? (
        <MileageSeriesDetailsScreen
          series={viewingSeries}
          onClose={() => setViewingSeries(null)}
          onEdit={() => {
            setViewingSeries(null)
            setEditor({
              type: 'edit',
              entry: null,
              series: viewingSeries,
              scope: 'entireSeries',
            })
          }}
          onDelete={() => {
            void (async () => {
              const confirmed = await confirmStopMileageSeries()
              if (!confirmed) return
              await deleteSeries(viewingSeries.id, { type: 'entireSeries' })
              setViewingSeries(null)
              refreshAll()
            })()
          }}
        />
      ) : null}
    </YStack>
  )
}
