import Anthropic from '@anthropic-ai/sdk'
import { and, eq, gte, sql } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import { engineLlmCall, engineWorkspace } from '~/database/engineSchema'
import { server } from '~/env'
import { newId } from '~/features/engine/core/ids'

import { estimateCostMicros } from './pricing'

import type { LlmUsage } from './pricing'

/**
 * the single entry point for every model call in the engine. picks the model
 * per tier, enforces the workspace monthly budget, caches the system prompt,
 * and records an engineLlmCall row for every attempt (success or error).
 */

export type LlmTier = 'strategy' | 'fast'

export type RunLlmInput = {
  workspaceId: string
  /** strategist | copywriter | tagger | reflector | copilot | test */
  agent: string
  purpose: string
  tier: LlmTier
  system: string
  messages: Anthropic.MessageParam[]
  tools?: Anthropic.Tool[]
  /** when set the model must answer with json matching this schema */
  jsonSchema?: Record<string, unknown>
  maxTokens?: number
  /** user:<id> | system:<agent> */
  actor?: string
}

export type RunLlmResult = {
  id: string
  text: string
  json?: unknown
  stopReason: Anthropic.StopReason | null
  usage: Required<LlmUsage>
  costMicros: number
  model: string
}

export class LlmNotConfiguredError extends Error {
  constructor() {
    super('ANTHROPIC_API_KEY is not configured')
    this.name = 'LlmNotConfiguredError'
  }
}

export class LlmBudgetExceededError extends Error {
  constructor(
    public readonly workspaceId: string,
    public readonly spentMicros: number,
    public readonly budgetMicros: number,
  ) {
    super('Workspace monthly LLM budget exceeded')
    this.name = 'LlmBudgetExceededError'
  }
}

export class LlmRefusalError extends Error {
  constructor(
    public readonly llmCallId: string,
    public readonly category: string | null,
  ) {
    super('The model refused this request')
    this.name = 'LlmRefusalError'
  }
}

export class LlmOutputError extends Error {
  constructor(
    public readonly llmCallId: string,
    message: string,
  ) {
    super(message)
    this.name = 'LlmOutputError'
  }
}

const MICROS_PER_CENT = 10_000
const DEFAULT_MAX_TOKENS = 4096

export function isLlmConfigured() {
  return Boolean(server.ANTHROPIC_API_KEY)
}

export function modelForTier(tier: LlmTier) {
  return tier === 'strategy'
    ? server.ENGINE_LLM_STRATEGY_MODEL
    : server.ENGINE_LLM_FAST_MODEL
}

let client: Anthropic | null = null

function getClient() {
  if (!client) client = new Anthropic({ apiKey: server.ANTHROPIC_API_KEY })
  return client
}

export function monthStartIso(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
}

/** month-to-date spend for a workspace in usd micro-dollars */
export async function monthToDateSpendMicros(workspaceId: string, now = new Date()) {
  const [row] = await drizzle
    .select({ total: sql<string>`coalesce(sum(${engineLlmCall.costMicros}), 0)` })
    .from(engineLlmCall)
    .where(
      and(
        eq(engineLlmCall.workspaceId, workspaceId),
        gte(engineLlmCall.createdAt, monthStartIso(now)),
      ),
    )
  return Number(row?.total ?? 0)
}

async function assertWithinBudget(workspaceId: string) {
  const [workspace] = await drizzle
    .select({ llmBudgetMonthlyCents: engineWorkspace.llmBudgetMonthlyCents })
    .from(engineWorkspace)
    .where(eq(engineWorkspace.id, workspaceId))
    .limit(1)
  if (!workspace) throw new Error(`Workspace ${workspaceId} not found`)
  const budgetMicros = workspace.llmBudgetMonthlyCents * MICROS_PER_CENT
  const spentMicros = await monthToDateSpendMicros(workspaceId)
  if (spentMicros >= budgetMicros) {
    console.info('[engine:llm] budget exceeded', {
      workspaceId,
      spentMicros,
      budgetMicros,
    })
    throw new LlmBudgetExceededError(workspaceId, spentMicros, budgetMicros)
  }
}

function usageFromResponse(usage: Anthropic.Usage | undefined): Required<LlmUsage> {
  return {
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
    cacheReadTokens: usage?.cache_read_input_tokens ?? 0,
    cacheWriteTokens: usage?.cache_creation_input_tokens ?? 0,
  }
}

type CallRow = {
  id: string
  input: RunLlmInput
  model: string
  output: unknown
  stopReason: string | null
  usage: Required<LlmUsage>
  costMicros: number
  latencyMs: number
  error: string | null
}

/** never throws: a failed log line must not mask the call's own outcome */
async function recordCall(row: CallRow) {
  try {
    await drizzle.insert(engineLlmCall).values({
      id: row.id,
      workspaceId: row.input.workspaceId,
      agent: row.input.agent,
      tier: row.input.tier,
      model: row.model,
      purpose: row.input.purpose,
      system: row.input.system,
      messages: row.input.messages,
      tools: row.input.tools ?? null,
      output: row.output ?? null,
      stopReason: row.stopReason,
      inputTokens: row.usage.inputTokens,
      outputTokens: row.usage.outputTokens,
      cacheReadTokens: row.usage.cacheReadTokens,
      cacheWriteTokens: row.usage.cacheWriteTokens,
      costMicros: row.costMicros,
      latencyMs: row.latencyMs,
      error: row.error,
      actor: row.input.actor ?? null,
    })
  } catch (error) {
    console.error('[engine:llm] failed to record call', row.id, error)
  }
}

/** sdk errors carry request ids and status, never the api key */
function describeError(error: unknown) {
  if (error instanceof Anthropic.APIError)
    return `${error.status ?? 'api'}: ${error.message}`
  if (error instanceof Error) return error.message
  return String(error)
}

export async function runLlm(input: RunLlmInput): Promise<RunLlmResult> {
  if (!isLlmConfigured()) throw new LlmNotConfiguredError()
  await assertWithinBudget(input.workspaceId)

  const id = newId('llm')
  const model = modelForTier(input.tier)
  const emptyUsage = usageFromResponse(undefined)
  const startedAt = performance.now()

  let response: Anthropic.Message
  try {
    response = await getClient().messages.create({
      model,
      max_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
      system: [
        { type: 'text', text: input.system, cache_control: { type: 'ephemeral' } },
      ],
      messages: input.messages,
      ...(input.tools?.length
        ? { tools: input.tools, tool_choice: { type: 'auto' } }
        : {}),
      output_config: {
        effort: input.tier === 'strategy' ? 'high' : 'medium',
        ...(input.jsonSchema
          ? { format: { type: 'json_schema', schema: input.jsonSchema } }
          : {}),
      },
    })
  } catch (error) {
    await recordCall({
      id,
      input,
      model,
      output: null,
      stopReason: null,
      usage: emptyUsage,
      costMicros: 0,
      latencyMs: Math.round(performance.now() - startedAt),
      error: describeError(error),
    })
    throw error
  }

  const latencyMs = Math.round(performance.now() - startedAt)
  const usage = usageFromResponse(response.usage)
  const costMicros = estimateCostMicros(response.model || model, usage)
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')

  const base = {
    id,
    input,
    model: response.model || model,
    output: response.content,
    stopReason: response.stop_reason,
    usage,
    costMicros,
    latencyMs,
  }

  if (response.stop_reason === 'refusal') {
    await recordCall({ ...base, error: 'refusal' })
    throw new LlmRefusalError(id, response.stop_details?.category ?? null)
  }

  let json: unknown
  if (input.jsonSchema) {
    try {
      json = JSON.parse(text)
    } catch {
      await recordCall({ ...base, error: 'invalid_json' })
      throw new LlmOutputError(id, 'Model output was not valid json')
    }
  }

  await recordCall({ ...base, error: null })

  return {
    id,
    text,
    json,
    stopReason: response.stop_reason,
    usage,
    costMicros,
    model: base.model,
  }
}
