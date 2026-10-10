import { useCallback, useLayoutEffect, useState, type RefObject } from 'react'
import { type View } from 'react-native'
import { YStack } from 'tamagui'
import { Path, Svg } from 'react-native-svg'

import { useMtdThemeColors } from '~/features/mtd/useMtdThemeColors'

type Point = { x: number; y: number }

type ArrowGeometry = {
  width: number
  height: number
  start: Point
  end: Point
}

function buildStraightPath(start: Point, end: Point) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy) || 1
  const pull = 18
  const tip = {
    x: end.x - (dx / length) * pull,
    y: end.y - (dy / length) * pull,
  }
  return `M ${start.x} ${start.y} L ${tip.x} ${tip.y}`
}

function buildArrowHead(start: Point, end: Point) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy) || 1
  const ux = dx / length
  const uy = dy / length
  const px = -uy
  const py = ux

  const headLength = 20
  const headHalfWidth = 12
  const tip = end
  const base = {
    x: tip.x - ux * headLength,
    y: tip.y - uy * headLength,
  }
  const left = {
    x: base.x + px * headHalfWidth,
    y: base.y + py * headHalfWidth,
  }
  const right = {
    x: base.x - px * headHalfWidth,
    y: base.y - py * headHalfWidth,
  }

  return `M ${tip.x} ${tip.y} L ${left.x} ${left.y} L ${right.x} ${right.y} Z`
}

type PrivateUseHintArrowProps = {
  visible: boolean
  containerRef: RefObject<View | null>
  /** "?" text — used for horizontal start */
  originRef: RefObject<View | null>
  /** hint card — arrow starts at its bottom edge so it never paints over the box */
  boxRef: RefObject<View | null>
  targetRef: RefObject<View | null>
}

/** straight diagonal from under the hint box → Yes */
export function PrivateUseHintArrow({
  visible,
  containerRef,
  originRef,
  boxRef,
  targetRef,
}: PrivateUseHintArrowProps) {
  const colors = useMtdThemeColors()
  const [geometry, setGeometry] = useState<ArrowGeometry | null>(null)

  const measure = useCallback(() => {
    const container = containerRef.current
    const origin = originRef.current
    const box = boxRef.current
    const target = targetRef.current
    if (!visible || !container || !origin || !box || !target) {
      setGeometry(null)
      return
    }

    container.measureInWindow((cx, cy, cw, ch) => {
      origin.measureInWindow((ox, oy, ow) => {
        box.measureInWindow((_bx, by, _bw, bh) => {
          target.measureInWindow((tx, ty, tw) => {
            // x under the "?", y at the bottom edge of the hint card
            const start = {
              x: ox - cx + ow - 3,
              y: by - cy + bh,
            }
            const end = {
              x: tx - cx + tw * 0.35,
              y: ty - cy - 5,
            }

            if (end.y - start.y < 40) {
              setGeometry(null)
              return
            }

            setGeometry({
              width: Math.max(cw, end.x + 28, start.x + 28),
              height: Math.max(ch, end.y + 28),
              start,
              end,
            })
          })
        })
      })
    })
  }, [boxRef, containerRef, originRef, targetRef, visible])

  useLayoutEffect(() => {
    if (!visible) {
      setGeometry(null)
      return
    }

    const frame = requestAnimationFrame(() => measure())
    const timer = setTimeout(measure, 120)

    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
  }, [measure, visible])

  if (!visible || !geometry) return null

  return (
    <YStack
      position="absolute"
      t={0}
      l={0}
      width={geometry.width}
      height={geometry.height}
      pointerEvents="none"
      z={1}
    >
      <Svg width={geometry.width} height={geometry.height}>
        <Path
          d={buildStraightPath(geometry.start, geometry.end)}
          stroke={colors.accent}
          strokeWidth={4}
          strokeLinecap="butt"
          fill="none"
        />
        <Path d={buildArrowHead(geometry.start, geometry.end)} fill={colors.accent} />
      </Svg>
    </YStack>
  )
}
