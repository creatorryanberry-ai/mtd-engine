import { AppState, type AppStateStatus } from 'react-native'

import { useDeadlineTimer, type UseTimerReturn } from './createDeadlineTimer'

export type { UseTimerReturn }

/** native: resync when returning from mail / background (setInterval is unreliable) */
function subscribeToForeground(onForeground: () => void): () => void {
  const onChange = (state: AppStateStatus) => {
    if (state === 'active') onForeground()
  }
  const sub = AppState.addEventListener('change', onChange)
  return () => sub.remove()
}

export const useTimer = (): UseTimerReturn => useDeadlineTimer(subscribeToForeground)
