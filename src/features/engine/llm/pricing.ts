import { usdToMicros } from '~/features/engine/core/money'

/** usd per one million tokens */
export type ModelPrice = {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

export type LlmUsage = {
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
}

export const FALLBACK_PRICING_MODEL = 'claude-opus-5-5'

export const MODEL_PRICES: Record<string, ModelPrice> = {
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
}

const warnedModels = new Set<string>()

/** unknown models bill at opus rates so a typo never under-counts spend */
export function priceForModel(model: string): ModelPrice {
  const known = MODEL_PRICES[model]
  if (known) return known
  if (!warnedModels.has(model)) {
    warnedModels.add(model)
    console.warn(
      `[engine:llm] no pricing for model "${model}", using ${FALLBACK_PRICING_MODEL} rates`,
    )
  }
  return MODEL_PRICES[FALLBACK_PRICING_MODEL]!
}

export function isKnownPricingModel(model: string) {
  return model in MODEL_PRICES
}

/** usd micro-dollars (1e-6 usd) for a call's token usage */
export function estimateCostMicros(model: string, usage: LlmUsage) {
  const price = priceForModel(model)
  const usd =
    (usage.inputTokens * price.input +
      usage.outputTokens * price.output +
      (usage.cacheReadTokens ?? 0) * price.cacheRead +
      (usage.cacheWriteTokens ?? 0) * price.cacheWrite) /
    1_000_000
  return usdToMicros(usd)
}
