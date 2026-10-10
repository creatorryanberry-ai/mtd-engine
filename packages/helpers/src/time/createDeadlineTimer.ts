import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export type UseTimerReturn = {
  count: number
  start: (time: number, start: boolean) => void
  pause: () => void
  resume: () => void
  clear: () => void
}

/** countdown from a wall-clock deadline so backgrounding can't freeze the displayed seconds */
export function useDeadlineTimer(
  subscribeToForeground: (onForeground: () => void) => () => void,
): UseTimerReturn {
  const [timerCount, setTimer] = useState(30)
  const deadlineRef = useRef<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const runningRef = useRef(false)
  const countRef = useRef(30)

  const setCount = useCallback((value: number) => {
    countRef.current = value
    setTimer(value)
  }, [])

  const clearIntervalOnly = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const syncFromDeadline = useCallback(() => {
    const deadline = deadlineRef.current
    if (deadline == null) return

    const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
    setCount(remaining)

    if (remaining <= 0) {
      clearIntervalOnly()
      deadlineRef.current = null
      runningRef.current = false
    }
  }, [clearIntervalOnly, setCount])

  const ensureTicking = useCallback(() => {
    if (intervalRef.current || !runningRef.current || deadlineRef.current == null) return
    // sub-second ticks so resume after background corrects remaining time quickly
    intervalRef.current = setInterval(syncFromDeadline, 250)
  }, [syncFromDeadline])

  const clearTimer = useCallback(() => {
    clearIntervalOnly()
    deadlineRef.current = null
    runningRef.current = false
    setCount(0)
  }, [clearIntervalOnly, setCount])

  const resetTimer = useCallback(
    (time: number, start: boolean) => {
      clearIntervalOnly()
      setCount(time)
      if (start && time > 0) {
        deadlineRef.current = Date.now() + time * 1000
        runningRef.current = true
        ensureTicking()
      } else {
        deadlineRef.current = null
        runningRef.current = false
      }
    },
    [clearIntervalOnly, ensureTicking, setCount],
  )

  const pauseTimer = useCallback(() => {
    if (deadlineRef.current != null) {
      const remaining = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000))
      setCount(remaining)
    }
    clearIntervalOnly()
    deadlineRef.current = null
    runningRef.current = false
  }, [clearIntervalOnly, setCount])

  const resumeTimer = useCallback(() => {
    const remaining = countRef.current
    if (remaining <= 0 || runningRef.current) return
    deadlineRef.current = Date.now() + remaining * 1000
    runningRef.current = true
    ensureTicking()
  }, [ensureTicking])

  useEffect(() => {
    return subscribeToForeground(() => {
      if (!runningRef.current || deadlineRef.current == null) return
      syncFromDeadline()
      ensureTicking()
    })
  }, [ensureTicking, subscribeToForeground, syncFromDeadline])

  useEffect(() => {
    return () => {
      clearIntervalOnly()
    }
  }, [clearIntervalOnly])

  return useMemo(
    () => ({
      count: timerCount,
      start: resetTimer,
      pause: pauseTimer,
      resume: resumeTimer,
      clear: clearTimer,
    }),
    [timerCount, clearTimer, pauseTimer, resetTimer, resumeTimer],
  )
}
