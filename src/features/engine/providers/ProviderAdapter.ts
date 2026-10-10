/**
 * ProviderAdapter: one interface for every content generation provider
 * (Higgsfield for video/image, ElevenLabs for voice, Runway/Veo fallback,
 * Canva for templates). Jobs are async: generate() returns a handle, callers
 * poll getStatus()/getResult() or a worker does it for them. Every call is
 * costed before it runs so the workspace media budget can refuse it.
 */

export type ProviderKind = 'image' | 'video' | 'audio' | 'copy' | 'document'

export type ProviderCapability = {
  kind: ProviderKind
  /** provider-specific model ids this adapter can route to */
  models: string[]
  /** supported output aspect ratios, e.g. '9:16' */
  aspects?: string[]
  /** max duration in ms for video/audio */
  maxDurationMs?: number
}

export type GenerateRequest = {
  workspaceId: string
  kind: ProviderKind
  /** provider model id; adapters pick a default when omitted */
  model?: string
  prompt: string
  negativePrompt?: string
  /** reference assets (storage refs or urls) e.g. product shots, brand logo */
  references?: { ref: string; role?: 'product' | 'logo' | 'style' | 'presenter' }[]
  aspect?: string
  width?: number
  height?: number
  durationMs?: number
  /** how many variants to produce in one job */
  count?: number
  /** brand kit constraints the provider should respect where it can */
  brand?: {
    colors?: string[]
    fonts?: string[]
    toneOfVoice?: string | null
    bannedWords?: string[]
  }
  /** passthrough for provider-specific options; never secrets */
  options?: Record<string, unknown>
  /** our idempotency key so retries do not double-bill */
  idempotencyKey?: string
}

export type CostEstimate = {
  /** usd cents, upper bound */
  cents: number
  currency: 'USD'
  /** which model the estimate assumed */
  model: string
  /** latency expectation in ms, if known */
  expectedLatencyMs?: number
}

export type ProviderJobStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled'

export type ProviderJobHandle = {
  provider: string
  externalJobId: string
  model: string
  estimatedCostCents: number
}

export type ProviderOutput = {
  /** remote url to download from (short-lived) or inline text for copy */
  url?: string
  text?: string
  mimeType: string
  width?: number
  height?: number
  durationMs?: number
  /** provider-reported seed/params for reproducibility */
  params?: Record<string, unknown>
}

export type ProviderResult = {
  status: ProviderJobStatus
  outputs: ProviderOutput[]
  actualCostCents?: number
  error?: string
  raw?: unknown
}

export interface ProviderAdapter {
  /** stable key stored on assets and jobs, e.g. 'higgsfield' */
  readonly key: string
  readonly displayName: string
  capabilities(): ProviderCapability[]
  /** true when credentials are configured for this process */
  isConfigured(): boolean
  estimateCost(request: GenerateRequest): Promise<CostEstimate>
  generate(request: GenerateRequest): Promise<ProviderJobHandle>
  getStatus(handle: ProviderJobHandle): Promise<ProviderJobStatus>
  getResult(handle: ProviderJobHandle): Promise<ProviderResult>
  cancel?(handle: ProviderJobHandle): Promise<void>
}

/** routing policy used by the creative director to pick an adapter per job */
export type ProviderRoutingPreference = 'cost' | 'quality' | 'latency'

export type ProviderRoute = {
  kind: ProviderKind
  preference: ProviderRoutingPreference
  /** adapters in order of preference; first configured one wins */
  adapters: string[]
}
