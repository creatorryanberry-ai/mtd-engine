import { useEffect, useRef, useState } from 'react'

import { EstimatePoundsText } from '~/features/taxEstimate/components/EstimatePoundsText'

export function EstimateAnimatedAmount({
  pounds,
  fontSize = 20,
  fontWeight = '700',
}: {
  pounds: number
  fontSize?: number
  fontWeight?: '600' | '700'
}) {
  const [display, setDisplay] = useState(pounds)
  const displayRef = useRef(pounds)

  useEffect(() => {
    const from = displayRef.current
    const to = pounds
    if (from === to) return

    const durationMs = 380
    const startedAt = Date.now()
    let frame = 0

    const tick = () => {
      const progress = Math.min(1, (Date.now() - startedAt) / durationMs)
      const eased = 1 - (1 - progress) ** 3
      const next = from + (to - from) * eased
      displayRef.current = next
      setDisplay(next)
      if (progress < 1) {
        frame = requestAnimationFrame(tick)
      } else {
        displayRef.current = to
        setDisplay(to)
      }
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [pounds])

  return (
    <EstimatePoundsText pounds={display} fontSize={fontSize} fontWeight={fontWeight} />
  )
}
