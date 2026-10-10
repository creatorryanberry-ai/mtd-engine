/**
 * ChannelConnector: plugin interface for every place the engine can act
 * (paid, owned, organic, sales, partner, offline). Connectors are idempotent,
 * rate-limit aware and never see the LLM. Credentials arrive decrypted from
 * engineConnection only inside the connector call.
 *
 * RevenueConnector is the read-only cousin for revenue truth (Stripe, Shopify,
 * accounting): it only syncs orders and webhooks, it never publishes.
 */

export type ChannelKind =
  | 'paid'
  | 'owned'
  | 'organic'
  | 'sales'
  | 'revenue'
  | 'partner'
  | 'offline'

export type ConnectorCredentials = {
  accessToken?: string
  refreshToken?: string
  apiKey?: string
  /** iso timestamp */
  expiresAt?: string
  /** extra provider fields (account id, portal id, region) */
  [key: string]: string | undefined
}

export type ConnectorContext = {
  workspaceId: string
  connectionId: string
  credentials: ConnectorCredentials
  /** non-secret settings persisted on engineConnection.settings */
  settings: Record<string, unknown>
  /** persist updated settings (cursors, webhook ids) */
  saveSettings: (patch: Record<string, unknown>) => Promise<void>
  /** persist rotated credentials (refresh flows) */
  saveCredentials: (next: ConnectorCredentials) => Promise<void>
  /** structured log that lands in the audit trail */
  log: (message: string, data?: Record<string, unknown>) => void
}

export type ConnectResult = {
  /** redirect the user here to authorise (oauth); null for api-key providers */
  authorizeUrl: string | null
  /** id of the oauth state row to validate on callback */
  stateId?: string
}

export type SyncScope = 'contacts' | 'companies' | 'deals' | 'orders' | 'metrics' | 'all'

export type SyncResult = {
  scope: SyncScope
  created: number
  updated: number
  skipped: number
  /** cursor or watermark to resume from */
  cursor?: string | null
  errors: { message: string; externalId?: string }[]
  /** true when there is more to fetch (caller re-enqueues) */
  hasMore: boolean
}

export type PublishPayload = {
  campaignId: string
  /** connector-specific creative payload built by the deploy stage */
  creative: Record<string, unknown>
  /** spend caps enforced in code before the call; the connector also sets them remotely where supported */
  budgetDailyMinor?: number
  budgetTotalMinor?: number
  currency: string
  targeting?: Record<string, unknown>
  schedule?: { startsAt?: string; endsAt?: string }
  idempotencyKey: string
}

export type PublishResult = {
  externalId: string
  status: 'scheduled' | 'live' | 'pending_review' | 'rejected'
  url?: string
  raw?: unknown
}

export type MetricsWindow = { from: string; to: string }

export type ChannelMetricRow = {
  day: string
  externalId?: string
  spendMinor: number
  impressions: number
  clicks: number
  /** platform-reported conversions, kept separate from first-party outcomes */
  platformConversions: number
  platformRevenueMinor?: number
  currency: string
  extra?: Record<string, number>
}

export type ConnectorHealth = {
  ok: boolean
  checkedAt: string
  detail?: string
  tokenExpiresAt?: string | null
}

export interface ChannelConnector {
  readonly key: string
  readonly displayName: string
  readonly kind: ChannelKind
  /** scopes requested at connect time, surfaced on the integrations screen */
  readonly scopes: string[]
  isConfigured(): boolean
  /** start authorisation; oauth providers return a redirect url */
  connect(input: {
    workspaceId: string
    userId: string
    returnTo?: string | null
  }): Promise<ConnectResult>
  /** complete authorisation (oauth callback) and return credentials to encrypt */
  completeConnect?(input: {
    workspaceId: string
    stateId: string
    code: string
  }): Promise<{
    credentials: ConnectorCredentials
    externalAccountId: string
    displayName: string
  }>
  healthCheck(ctx: ConnectorContext): Promise<ConnectorHealth>
  sync(
    ctx: ConnectorContext,
    scope: SyncScope,
    cursor?: string | null,
  ): Promise<SyncResult>
  publish(ctx: ConnectorContext, payload: PublishPayload): Promise<PublishResult>
  pause(ctx: ConnectorContext, externalId: string): Promise<void>
  resume?(ctx: ConnectorContext, externalId: string): Promise<void>
  fetchMetrics(ctx: ConnectorContext, window: MetricsWindow): Promise<ChannelMetricRow[]>
  disconnect?(ctx: ConnectorContext): Promise<void>
}

export type RevenueOrder = {
  externalId: string
  status: 'paid' | 'refunded' | 'partially_refunded' | 'pending' | 'failed'
  currency: string
  revenueMinor: number
  costMinor: number
  feesMinor: number
  refundedMinor: number
  occurredAt: string
  customer: {
    externalId?: string
    email?: string | null
    name?: string | null
  }
  lineItems: { name: string; quantity: number; amountMinor: number; sku?: string }[]
  raw?: Record<string, unknown>
}

export interface RevenueConnector {
  readonly key: string
  readonly displayName: string
  readonly kind: 'revenue'
  isConfigured(): boolean
  connect(input: {
    workspaceId: string
    userId: string
    returnTo?: string | null
  }): Promise<ConnectResult>
  healthCheck(ctx: ConnectorContext): Promise<ConnectorHealth>
  /** page through historical orders; cursor is provider-specific */
  syncOrders(
    ctx: ConnectorContext,
    cursor?: string | null,
  ): Promise<{ orders: RevenueOrder[]; cursor: string | null; hasMore: boolean }>
  /** verify + normalise a webhook; returns null when the event is irrelevant */
  parseWebhook(input: {
    rawBody: string
    headers: Headers
  }): Promise<{ eventId: string; order: RevenueOrder | null; type: string } | null>
}

export type AnyConnector = ChannelConnector | RevenueConnector

export function isRevenueConnector(c: AnyConnector): c is RevenueConnector {
  return c.kind === 'revenue' && 'syncOrders' in c
}
