import { useDeadlineTimer, type UseTimerReturn } from './createDeadlineTimer'

export type { UseTimerReturn }

/** web: resync when the tab is visible again (email apps / alt tabs stall intervals) */
function subscribeToForeground(onForeground: () => void): () => void {
  if (typeof document === 'undefined') return () => {}

  const onVisibility = () => {
    if (document.visibilityState === 'visible') onForeground()
  }
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('focus', onForeground)
  return () => {
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('focus', onForeground)
  }
}

export const useTimer = (): UseTimerReturn => useDeadlineTimer(subscribeToForeground)
