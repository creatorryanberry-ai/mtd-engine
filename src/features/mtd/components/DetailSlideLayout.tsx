import { createContext, useContext, type ReactNode } from 'react'
import { Slot } from 'one'

import { SlideFromRightScreen } from './SlideFromRightScreen'

export type DetailSlideRequestClose = (afterClose: () => void) => void

const DetailSlideCloseContext = createContext<DetailSlideRequestClose | null>(null)

export function useDetailSlideRequestClose() {
  return useContext(DetailSlideCloseContext)
}

export function DetailSlideCloseProvider({
  requestClose,
  children,
}: {
  requestClose: DetailSlideRequestClose
  children: ReactNode
}) {
  return (
    <DetailSlideCloseContext.Provider value={requestClose}>
      {children}
    </DetailSlideCloseContext.Provider>
  )
}

/** Wrap detail routes so they slide in from the right without changing the tabs Slot. */
export function DetailSlideLayout() {
  return (
    <SlideFromRightScreen>
      {(requestClose) => (
        <DetailSlideCloseProvider requestClose={requestClose}>
          <Slot />
        </DetailSlideCloseProvider>
      )}
    </SlideFromRightScreen>
  )
}
