import { useCallback, useEffect, useRef } from 'react'
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollView } from 'react-native'
import { isWeb } from 'tamagui'

import {
  getBankAccountsScrollOffsetY,
  setBankAccountsScrollOffsetY,
} from '../utils/bankAccountsScrollOffset'

type UseBankAccountsScrollRestorationOptions = {
  ready: boolean
}

function scrollToOffset(scrollRef: ScrollView | null, y: number) {
  if (!scrollRef || y <= 0) return
  scrollRef.scrollTo({ y, animated: false })
}

export function useBankAccountsScrollRestoration({
  ready,
}: UseBankAccountsScrollRestorationOptions) {
  const scrollRef = useRef<ScrollView | null>(null)
  const hasRestoredRef = useRef(false)

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setBankAccountsScrollOffsetY(event.nativeEvent.contentOffset.y)
  }, [])

  const tryRestoreScroll = useCallback(() => {
    if (!isWeb || hasRestoredRef.current || !ready) return

    const y = getBankAccountsScrollOffsetY()
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
    initialContentOffset: { x: 0, y: isWeb ? getBankAccountsScrollOffsetY() : 0 },
  }
}
