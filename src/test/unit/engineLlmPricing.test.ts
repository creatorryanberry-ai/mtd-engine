import { describe, expect, it, vi } from 'vitest'

import {
  estimateCostMicros,
  FALLBACK_PRICING_MODEL,
  isKnownPricingModel,
  MODEL_PRICES,
  priceForModel,
} from '~/features/engine/llm/pricing'

describe('engine llm pricing', () => {
  it('bills opus at $4 in / $20 out per million tokens', () => {
    expect(
      estimateCostMicros('claude-opus-5-5', { inputTokens: 1_000_000, outputTokens: 0 }),
    ).toBe(4_000_000)
    expect(
      estimateCostMicros('claude-opus-5-5', { inputTokens: 0, outputTokens: 1_000_000 }),
    ).toBe(20_000_000)
  })

  it('bills haiku at $0.10 in / $0.50 out per million tokens', () => {
    expect(
      estimateCostMicros('claude-haiku-5-5', {
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
      }),
    ).toBe(600_000)
  })

  it('prices cache reads and writes separately', () => {
    const cost = estimateCostMicros('claude-opus-5-5', {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 1_000_000,
      cacheWriteTokens: 1_000_000,
    })
    expect(cost).toBe(200_000 + 5_000_000)
  })

  it('keeps precision on tiny calls', () => {
    // 1000 in + 200 out on haiku = $0.0001 + $0.0001 = 200 micro-dollars
    expect(
      estimateCostMicros('claude-haiku-5-5', { inputTokens: 1000, outputTokens: 200 }),
    ).toBe(200)
    expect(
      estimateCostMicros('claude-haiku-5-5', { inputTokens: 0, outputTokens: 0 }),
    ).toBe(0)
  })

  it('falls back to opus pricing for unknown models and warns once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const model = `claude-unknown-${Date.now()}`
      expect(isKnownPricingModel(model)).toBe(false)
      expect(priceForModel(model)).toEqual(MODEL_PRICES[FALLBACK_PRICING_MODEL])
      estimateCostMicros(model, { inputTokens: 10, outputTokens: 10 })
      estimateCostMicros(model, { inputTokens: 10, outputTokens: 10 })
      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn.mock.calls[0]?.[0]).toContain(model)
    } finally {
      warn.mockRestore()
    }
  })
})
