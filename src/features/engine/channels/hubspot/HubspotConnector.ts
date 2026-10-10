import { and, eq, sql } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import {
  engineCompany,
  engineDeal,
  engineIdentity,
  engineOAuthState,
  engineWorkspace,
} from '~/database/engineSchema'
import { server } from '~/env'

import { newId } from '../../core/ids'
import { resolveContact } from '../../sense/server/identity'
import { ConnectorHttpError, NotSupportedError } from '../errors'
import {
  firstAssociationId,
  HUBSPOT_PROPERTIES,
  mapDealStatus,
  mapLifecycleStage,
  nextAllCursor,
  parseAllCursor,
  sizeBandFromEmployees,
  toIso,
  toMinor,
  toProbability,
  type HubspotObject,
  type HubspotObjectType,
  type HubspotPage,
} from './mapping'

import type {
  ChannelConnector,
  ChannelMetricRow,
  ConnectorContext,
  ConnectorCredentials,
  ConnectorHealth,
  ConnectResult,
  MetricsWindow,
  PublishPayload,
  PublishResult,
  SyncResult,
  SyncScope,
} from '../ChannelConnector'

const AUTHORIZE_URL = 'https://app.hubspot.com/oauth/authorize'
const API = 'https://api.hubapi.com'
const SCOPES = [
  'crm.objects.contacts.read',
  'crm.objects.companies.read',
  'crm.objects.deals.read',
  'oauth',
]
const PAGE_SIZE = 100
const STATE_TTL_MS = 30 * 60 * 1000
/** refresh when the token has less than this left */
const REFRESH_WINDOW_MS = 2 * 60 * 1000

type TokenResponse = {
  access_token: string
  refresh_token: string
  expires_in: number
}

type TokenInfo = {
  hub_id: number
  hub_domain?: string
  user?: string
  scopes?: string[]
}

type PageStats = {
  created: number
  updated: number
  skipped: number
  errors: SyncResult['errors']
}

function emptyStats(): PageStats {
  return { created: 0, updated: 0, skipped: 0, errors: [] }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function retryAfterMs(response: Response) {
  const header = response.headers.get('retry-after')
  const seconds = header ? Number(header) : Number.NaN
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 1000
}

async function hubspotFetch<T>(
  accessToken: string,
  path: string,
  init?: RequestInit,
  retried = false,
): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      authorization: `Bearer ${accessToken}`,
      accept: 'application/json',
    },
  })
  if (response.status === 429 && !retried) {
    await sleep(retryAfterMs(response))
    return hubspotFetch<T>(accessToken, path, init, true)
  }
  const text = await response.text()
  if (!response.ok) throw new ConnectorHttpError('hubspot', response.status, text)
  return text ? (JSON.parse(text) as T) : (undefined as T)
}

async function exchangeToken(body: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(`${API}/oauth/v1/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: server.HUBSPOT_CLIENT_ID,
      client_secret: server.HUBSPOT_CLIENT_SECRET,
      ...body,
    }).toString(),
  })
  const text = await response.text()
  if (!response.ok) throw new ConnectorHttpError('hubspot', response.status, text)
  return JSON.parse(text) as TokenResponse
}

function credentialsFromToken(token: TokenResponse, previous?: ConnectorCredentials) {
  const credentials: ConnectorCredentials = {
    ...previous,
    accessToken: token.access_token,
    refreshToken: token.refresh_token || previous?.refreshToken,
    expiresAt: new Date(Date.now() + token.expires_in * 1000).toISOString(),
  }
  return credentials
}

export class HubspotConnector implements ChannelConnector {
  readonly key = 'hubspot'
  readonly displayName = 'HubSpot'
  readonly kind = 'sales' as const
  readonly scopes = SCOPES

  isConfigured() {
    return !!(
      server.HUBSPOT_CLIENT_ID &&
      server.HUBSPOT_CLIENT_SECRET &&
      server.HUBSPOT_REDIRECT_URI
    )
  }

  async connect(input: {
    workspaceId: string
    userId: string
    returnTo?: string | null
  }): Promise<ConnectResult> {
    if (!this.isConfigured()) throw new Error('HubSpot is not configured on this server')
    const stateId = newId('oas')
    await drizzle.insert(engineOAuthState).values({
      id: stateId,
      workspaceId: input.workspaceId,
      userId: input.userId,
      provider: this.key,
      redirectUri: server.HUBSPOT_REDIRECT_URI,
      returnTo: input.returnTo ?? null,
      expiresAt: new Date(Date.now() + STATE_TTL_MS).toISOString(),
    })

    const url = new URL(AUTHORIZE_URL)
    url.searchParams.set('client_id', server.HUBSPOT_CLIENT_ID)
    url.searchParams.set('redirect_uri', server.HUBSPOT_REDIRECT_URI)
    url.searchParams.set('scope', SCOPES.join(' '))
    url.searchParams.set('state', stateId)
    return { authorizeUrl: url.toString(), stateId }
  }

  async completeConnect(input: { workspaceId: string; stateId: string; code: string }) {
    const [state] = await drizzle
      .select()
      .from(engineOAuthState)
      .where(
        and(
          eq(engineOAuthState.id, input.stateId),
          eq(engineOAuthState.workspaceId, input.workspaceId),
          eq(engineOAuthState.provider, this.key),
        ),
      )
      .limit(1)
    if (!state) throw new Error('OAuth state not found')

    const token = await exchangeToken({
      grant_type: 'authorization_code',
      redirect_uri: state.redirectUri,
      code: input.code,
    })
    const info = await hubspotFetch<TokenInfo>(
      token.access_token,
      `/oauth/v1/access-tokens/${encodeURIComponent(token.access_token)}`,
    )
    const credentials = credentialsFromToken(token)
    credentials.hubId = String(info.hub_id)
    if (info.hub_domain) credentials.hubDomain = info.hub_domain
    return {
      credentials,
      externalAccountId: String(info.hub_id),
      displayName: info.hub_domain ?? `HubSpot ${info.hub_id}`,
    }
  }

  /** refresh when the access token is about to expire; persists via ctx */
  async ensureAccessToken(ctx: ConnectorContext) {
    const { accessToken, refreshToken, expiresAt } = ctx.credentials
    const expiresInMs = expiresAt ? new Date(expiresAt).getTime() - Date.now() : 0
    if (accessToken && expiresInMs > REFRESH_WINDOW_MS) return accessToken
    if (!refreshToken) throw new Error('HubSpot connection has no refresh token')

    const token = await exchangeToken({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    })
    const next = credentialsFromToken(token, ctx.credentials)
    await ctx.saveCredentials(next)
    ctx.credentials = next
    ctx.log('hubspot token refreshed', { expiresAt: next.expiresAt })
    return next.accessToken!
  }

  async healthCheck(ctx: ConnectorContext): Promise<ConnectorHealth> {
    const checkedAt = new Date().toISOString()
    try {
      const accessToken = await this.ensureAccessToken(ctx)
      const info = await hubspotFetch<TokenInfo>(
        accessToken,
        `/oauth/v1/access-tokens/${encodeURIComponent(accessToken)}`,
      )
      return {
        ok: true,
        checkedAt,
        detail: info.hub_domain ? `portal ${info.hub_domain}` : `portal ${info.hub_id}`,
        tokenExpiresAt: ctx.credentials.expiresAt ?? null,
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      return {
        ok: false,
        checkedAt,
        detail,
        tokenExpiresAt: ctx.credentials.expiresAt ?? null,
      }
    }
  }

  async sync(
    ctx: ConnectorContext,
    scope: SyncScope,
    cursor?: string | null,
  ): Promise<SyncResult> {
    if (scope === 'orders' || scope === 'metrics') {
      return {
        scope,
        created: 0,
        updated: 0,
        skipped: 0,
        cursor: null,
        errors: [],
        hasMore: false,
      }
    }
    const accessToken = await this.ensureAccessToken(ctx)
    const currency = await workspaceCurrency(ctx.workspaceId)

    const target =
      scope === 'all' ? parseAllCursor(cursor) : { object: scope, after: cursor ?? null }
    const page = await this.fetchPage(accessToken, target.object, target.after)
    const stats = await this.upsertPage(ctx, target.object, page.results, currency)
    const nextAfter = page.paging?.next?.after ?? null

    const nextCursor =
      scope === 'all' ? nextAllCursor(target.object, nextAfter) : nextAfter
    return {
      scope,
      ...stats,
      cursor: nextCursor,
      hasMore: nextCursor !== null,
    }
  }

  private async fetchPage(
    accessToken: string,
    object: HubspotObjectType,
    after: string | null,
  ) {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) })
    params.set('properties', HUBSPOT_PROPERTIES[object].join(','))
    if (object === 'deals') params.set('associations', 'contacts,companies')
    if (object === 'contacts') params.set('associations', 'companies')
    if (after) params.set('after', after)
    return hubspotFetch<HubspotPage>(
      accessToken,
      `/crm/v3/objects/${object}?${params.toString()}`,
    )
  }

  private async upsertPage(
    ctx: ConnectorContext,
    object: HubspotObjectType,
    rows: HubspotObject[],
    currency: string,
  ) {
    const stats = emptyStats()
    for (const row of rows) {
      try {
        if (row.archived) {
          stats.skipped += 1
          continue
        }
        const created =
          object === 'companies'
            ? await upsertCompany(ctx.workspaceId, row)
            : object === 'contacts'
              ? await upsertContact(ctx.workspaceId, row)
              : await upsertDeal(ctx.workspaceId, row, currency)
        if (created === null) stats.skipped += 1
        else if (created) stats.created += 1
        else stats.updated += 1
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        stats.errors.push({ message, externalId: row.id })
      }
    }
    ctx.log(`hubspot ${object} page`, {
      count: rows.length,
      ...stats,
      errors: stats.errors.length,
    })
    return stats
  }

  async publish(
    _ctx: ConnectorContext,
    _payload: PublishPayload,
  ): Promise<PublishResult> {
    throw new NotSupportedError(this.key, 'publish')
  }

  async pause(_ctx: ConnectorContext, _externalId: string): Promise<void> {
    throw new NotSupportedError(this.key, 'pause')
  }

  async fetchMetrics(
    _ctx: ConnectorContext,
    _window: MetricsWindow,
  ): Promise<ChannelMetricRow[]> {
    return []
  }
}

async function workspaceCurrency(workspaceId: string) {
  const [row] = await drizzle
    .select({ currency: engineWorkspace.currency })
    .from(engineWorkspace)
    .where(eq(engineWorkspace.id, workspaceId))
    .limit(1)
  return row?.currency ?? 'GBP'
}

async function findCompanyIdByHubspotId(workspaceId: string, hubspotId: string) {
  const [row] = await drizzle
    .select({ id: engineCompany.id })
    .from(engineCompany)
    .where(
      and(
        eq(engineCompany.workspaceId, workspaceId),
        sql`${engineCompany.externalIds}->>'hubspot' = ${hubspotId}`,
      ),
    )
    .limit(1)
  return row?.id ?? null
}

/** returns true when created, false when updated, null when skipped */
async function upsertCompany(
  workspaceId: string,
  row: HubspotObject,
): Promise<boolean | null> {
  const p = row.properties
  const name = p.name?.trim() || p.domain?.trim()
  if (!name) return null
  const now = new Date().toISOString()
  const values = {
    name,
    domain: p.domain?.trim().toLowerCase() || null,
    industry: p.industry || null,
    country: p.country || null,
    sizeBand: sizeBandFromEmployees(p.numberofemployees),
    updatedAt: now,
  }
  const existingId = await findCompanyIdByHubspotId(workspaceId, row.id)
  if (existingId) {
    await drizzle
      .update(engineCompany)
      .set(values)
      .where(eq(engineCompany.id, existingId))
    return false
  }
  await drizzle.insert(engineCompany).values({
    id: newId('co'),
    workspaceId,
    ...values,
    source: 'hubspot',
    externalIds: { hubspot: row.id },
    createdAt: toIso(p.createdate) ?? now,
  })
  return true
}

async function upsertContact(
  workspaceId: string,
  row: HubspotObject,
): Promise<boolean | null> {
  const p = row.properties
  const email = p.email?.trim() || null
  if (!email && !p.firstname && !p.lastname) return null

  const [knownIdentity] = await drizzle
    .select({ id: engineIdentity.id })
    .from(engineIdentity)
    .where(
      and(
        eq(engineIdentity.workspaceId, workspaceId),
        eq(engineIdentity.kind, 'crm_id'),
        eq(engineIdentity.provider, 'hubspot'),
        eq(engineIdentity.value, row.id),
      ),
    )
    .limit(1)

  const companyHubspotId =
    firstAssociationId(row, 'companies') ?? p.associatedcompanyid ?? null
  const companyId = companyHubspotId
    ? await findCompanyIdByHubspotId(workspaceId, companyHubspotId)
    : null

  await resolveContact({
    workspaceId,
    email,
    phone: p.phone || null,
    firstName: p.firstname || null,
    lastName: p.lastname || null,
    jobTitle: p.jobtitle || null,
    country: p.country || null,
    companyId,
    source: 'hubspot',
    identities: [{ kind: 'crm_id', provider: 'hubspot', value: row.id }],
    externalIds: { hubspot: row.id },
    lifecycleStage: mapLifecycleStage(p.lifecyclestage),
    activityAt: toIso(p.lastmodifieddate) ?? toIso(row.updatedAt),
  })
  return !knownIdentity
}

async function upsertDeal(
  workspaceId: string,
  row: HubspotObject,
  fallbackCurrency: string,
): Promise<boolean | null> {
  const p = row.properties
  const name = p.dealname?.trim()
  if (!name) return null
  const now = new Date().toISOString()
  const status = mapDealStatus(p)

  const contactHubspotId = firstAssociationId(row, 'contacts')
  const companyHubspotId = firstAssociationId(row, 'companies')
  const [contact] = contactHubspotId
    ? await drizzle
        .select({ contactId: engineIdentity.contactId })
        .from(engineIdentity)
        .where(
          and(
            eq(engineIdentity.workspaceId, workspaceId),
            eq(engineIdentity.kind, 'crm_id'),
            eq(engineIdentity.provider, 'hubspot'),
            eq(engineIdentity.value, contactHubspotId),
          ),
        )
        .limit(1)
    : []
  const companyId = companyHubspotId
    ? await findCompanyIdByHubspotId(workspaceId, companyHubspotId)
    : null

  const values = {
    contactId: contact?.contactId ?? null,
    companyId,
    name,
    stage: p.dealstage || 'unknown',
    status,
    amountMinor: toMinor(p.amount),
    currency: p.deal_currency_code?.toUpperCase() || fallbackCurrency,
    probability: toProbability(p.hs_deal_stage_probability),
    ownerName: p.hubspot_owner_id || null,
    expectedCloseAt: status === 'open' ? toIso(p.closedate) : null,
    closedAt: status === 'open' ? null : toIso(p.closedate),
    updatedAt: now,
  }

  const [result] = await drizzle
    .insert(engineDeal)
    .values({
      id: newId('dl'),
      workspaceId,
      source: 'hubspot',
      externalId: row.id,
      ...values,
      createdAt: toIso(p.createdate) ?? now,
    })
    .onConflictDoUpdate({
      target: [engineDeal.workspaceId, engineDeal.source, engineDeal.externalId],
      targetWhere: sql`${engineDeal.externalId} IS NOT NULL`,
      set: values,
    })
    .returning({ inserted: sql<boolean>`(xmax = 0)` })
  return result?.inserted ?? false
}

export const hubspotConnector = new HubspotConnector()
