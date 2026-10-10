import { SizableText, YStack } from 'tamagui'

import { MTD_TOKENS } from '~/features/mtd/mtdTokens'

import { VERDICT_COLOR, VERDICT_HELP, VERDICT_LABEL } from './VerdictPill'

import type { LiftVerdictValue } from '~/features/engine/contract'

const TRACK_HEIGHT = 28
const LINE = 2
const CAP_HEIGHT = 12

/** a scale that always includes zero, padded so whiskers never touch the edge */
export function ciDomain(values: (number | null | undefined)[]): [number, number] {
  const finite = values.filter((value): value is number => Number.isFinite(value))
  const min = Math.min(0, ...finite)
  const max = Math.max(0, ...finite)
  const span = max - min
  if (span === 0) return [-1, 1]
  const pad = span * 0.08
  return [min - pad, max + pad]
}

function toPercent(value: number, [min, max]: [number, number]) {
  const ratio = (value - min) / (max - min)
  return Math.min(Math.max(ratio, 0), 1) * 100
}

export function describeInterval({
  estimate,
  low,
  high,
  format,
}: {
  estimate: number | null
  low: number | null
  high: number | null
  format: (value: number) => string
}) {
  if (estimate == null) return 'No estimate yet'
  if (low == null || high == null) return `${format(estimate)} (no interval yet)`
  return `${format(estimate)} (95% CI ${format(low)} to ${format(high)})`
}

/**
 * horizontal 95% interval against a zero line: whiskers at the bounds, a dot at
 * the point estimate, coloured by verdict. pass a shared `domain` to compare rows.
 */
export function CiBar({
  estimate,
  low,
  high,
  verdict,
  format,
  label,
  domain,
  emphasis,
  showText = true,
}: {
  estimate: number | null
  low: number | null
  high: number | null
  verdict: LiftVerdictValue
  format: (value: number) => string
  label?: string
  domain?: [number, number]
  emphasis?: boolean
  showText?: boolean
}) {
  const scale = domain ?? ciDomain([estimate, low, high])
  const color = VERDICT_COLOR[verdict]
  const text = describeInterval({ estimate, low, high, format })
  const hasInterval = low != null && high != null
  const dotSize = emphasis ? 12 : 10
  const zero = toPercent(0, scale)
  const lowPct = hasInterval ? toPercent(Math.min(low, high), scale) : 0
  const highPct = hasInterval ? toPercent(Math.max(low, high), scale) : 0
  const description = `${label ? `${label}: ` : ''}${text}. Verdict ${VERDICT_LABEL[
    verdict
  ].toLowerCase()}: ${VERDICT_HELP[verdict]}`

  return (
    <YStack gap="$1" width="100%" minW={140}>
      <YStack
        position="relative"
        height={TRACK_HEIGHT}
        width="100%"
        role="img"
        aria-label={description}
      >
        <YStack
          position="absolute"
          t={TRACK_HEIGHT / 2}
          l={0}
          r={0}
          height={1}
          bg={MTD_TOKENS.cardInset}
        />
        <YStack
          position="absolute"
          t={2}
          b={2}
          l={`${zero}%`}
          width={1}
          ml={-0.5}
          bg={MTD_TOKENS.textSubtle}
        />
        {hasInterval ? (
          <>
            <YStack
              position="absolute"
              t={(TRACK_HEIGHT - LINE) / 2}
              l={`${lowPct}%`}
              width={`${Math.max(highPct - lowPct, 0)}%`}
              height={LINE}
              bg={color}
              opacity={verdict === 'collecting' ? 0.6 : 1}
            />
            <YStack
              position="absolute"
              t={(TRACK_HEIGHT - CAP_HEIGHT) / 2}
              l={`${lowPct}%`}
              ml={-LINE / 2}
              width={LINE}
              height={CAP_HEIGHT}
              bg={color}
            />
            <YStack
              position="absolute"
              t={(TRACK_HEIGHT - CAP_HEIGHT) / 2}
              l={`${highPct}%`}
              ml={-LINE / 2}
              width={LINE}
              height={CAP_HEIGHT}
              bg={color}
            />
          </>
        ) : null}
        {estimate != null ? (
          <YStack
            position="absolute"
            t={(TRACK_HEIGHT - dotSize) / 2}
            l={`${toPercent(estimate, scale)}%`}
            ml={-dotSize / 2}
            width={dotSize}
            height={dotSize}
            rounded={dotSize}
            bg={color}
            borderWidth={2}
            borderColor={MTD_TOKENS.card}
          />
        ) : null}
      </YStack>
      {showText ? (
        <SizableText
          fontSize={12}
          color={emphasis ? MTD_TOKENS.text : MTD_TOKENS.textMuted}
          fontWeight={emphasis ? '600' : '400'}
          lineHeight={16}
        >
          {text}
        </SizableText>
      ) : null}
    </YStack>
  )
}
