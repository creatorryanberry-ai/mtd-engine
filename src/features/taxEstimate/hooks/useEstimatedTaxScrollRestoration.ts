import { useCallback, useEffect, useRef } from 'react'
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollView } from 'react-native'

import {
  getEstimatedTaxScrollOffsetY,
  setEstimatedTaxScrollOffsetY,
} from '~/features/taxEstimate/utils/estimatedTaxScrollOffset'

type UseEstimatedTaxScrollRestorationOptions = {
  ready: boolean
}

function scrollToOffset(scrollRef: ScrollView | null, y: number) {
  if (!scrollRef || y <= 0) return
  scrollRef.scrollTo({ y, animated: false })
}

export function useEstimatedTaxScrollRestoration({
  ready,
}: UseEstimatedTaxScrollRestorationOptions) {
  const scrollRef = useRef<ScrollView | null>(null)
  const hasRestoredRef = useRef(false)

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setEstimatedTaxScrollOffsetY(event.nativeEvent.contentOffset.y)
  }, [])

  const tryRestoreScroll = useCallback(() => {
    if (hasRestoredRef.current || !ready) return

    const y = getEstimatedTaxScrollOffsetY()
    if (y <= 0) {
      hasRestoredRef.current = true
      return
    }

    scrollToOffset(scrollRef.current, y)

    requestAnimationFrame(() => {
      scrollToOffset(scrollRef.current, y)
      hasRestoredRef.current = true
    })
  }, [ready])

  useEffect(() => {
    tryRestoreScroll()
  }, [tryRestoreScroll])

  const handleContentSizeChange = useCallback(() => {
    tryRestoreScroll()
  }, [tryRestoreScroll])

  return {
    scrollRef,
    handleScroll,
    handleContentSizeChange,
    initialContentOffset: { x: 0, y: getEstimatedTaxScrollOffsetY() },
  }
}
