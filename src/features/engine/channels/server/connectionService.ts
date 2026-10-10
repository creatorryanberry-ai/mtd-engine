import { and, eq, ne, sql } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import {
  engineChannel,
  engineConnection,
  engineOAuthState,
} from '~/database/engineSchema'
import { getBoss, JOB_NAMES } from '~/jobs/boss'

import { newId } from '../../core/ids'
import { userActor, writeAudit } from '../../core/server/audit'
import { decryptCredentials, encryptCredentials } from '../../core/server/credentials'
import { upsertOrderFromRevenue } from '../../sense/server/orders'
import { isRevenueConnector } from '../ChannelConnector'
import { connectorAuthKind, getConnector } from '../registry'

import type { EngineConnection } from '~/database/engineSchema'
import type { EngineConnectionDto } from '../../contract'
import type {
  ConnectorContext,
  ConnectorCredentials,
  SyncScope,
} from '../ChannelConnector'

/** pages per job before we re-enqueue so one connection cannot hog a worker */
export const SYNC_PAGE_CAP = 20

export type SyncJobData = { connectionId: string; scope: SyncScope }

export type ConnectionSyncSummary = {
  connectionId: string
  workspaceId: string
  provider: string
  scope: SyncScope
  pages: number
  created: number
  updated: number
  skipped: number
  errors: { message: string; externalId?: string }[]
  hasMore: boolean
  /** job id of the follow-up when hasMore */
  requeuedJobId: string | null
  /** set when the connection was skipped (disconnected, unknown provider) */
  skippedReason?: string
}

function notFound(message: string, status = 404) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** never includes credentialsEncrypted or settings */
export function toConnectionDto(row: EngineConnection): EngineConnectionDto {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    provider: row.provider,
    kind: getConnector(row.provider)?.kind ?? 'unknown',
    externalAccountId: row.externalAccountId,
    displayName: row.displayName,
    status: row.status,
    scopes: row.scopes,
    tokenExpiresAt: row.tokenExpiresAt,
    lastSyncAt: row.lastSyncAt,
    lastSyncError: row.lastSyncError,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function listConnections(workspaceId: string) {
  const rows = await drizzle
    .select()
    .from(engineConnection)
    .where(eq(engineConnection.workspaceId, workspaceId))
    .orderBy(engineConnection.createdAt)
  return rows.map(toConnectionDto)
}

export async function getConnection(connectionId: string) {
  const [row] = await drizzle
    .select()
    .from(engineConnection)
    .where(eq(engineConnection.id, connectionId))
    .limit(1)
  return row ?? null
}

async function channelIdFor(workspaceId: string, key: string) {
  const [row] = await drizzle
    .select({ id: engineChannel.id })
    .from(engineChannel)
    .where(and(eq(engineChannel.workspaceId, workspaceId), eq(engineChannel.key, key)))
    .limit(1)
  return row?.id ?? null
}

async function activeConnection(workspaceId: string, provider: string) {
  const [row] = await drizzle
    .select()
    .from(engineConnection)
    .where(
      and(
        eq(engineConnection.workspaceId, workspaceId),
        eq(engineConnection.provider, provider),
        ne(engineConnection.status, 'disconnected'),
      ),
    )
    .limit(1)
  return row ?? null
}

/**
 * api-key providers: encrypt the key, probe the provider once and record the
 * result as the connection status. reconnecting an active connection rotates
 * its key in place so webhook urls keep working.
 */
export async function createApiKeyConnection(input: {
  workspaceId: string
  userId: string
  provider: string
  apiKey: string
  webhookSecret?: string | null
  ipAddress?: string | null
}) {
  const connector = getConnector(input.provider)
  if (!connector) throw notFound(`Unknown connector ${input.provider}`)
  if (connectorAuthKind(connector) !== 'api_key') {
    throw notFound(`${connector.displayName} connects with OAuth`, 400)
  }
  const apiKey = input.apiKey.trim()
  if (!apiKey) throw notFound('apiKey is required', 400)

  const credentials: ConnectorCredentials = { apiKey }
  if (input.webhookSecret?.trim()) credentials.webhookSecret = input.webhookSecret.trim()
  const now = new Date().toISOString()

  const existing = await activeConnection(input.workspaceId, input.provider)
  let row: EngineConnection
  if (existing) {
    const [updated] = await drizzle
      .update(engineConnection)
      .set({
        credentialsEncrypted: encryptCredentials(credentials),
        status: 'pending',
        lastSyncError: null,
        connectedBy: input.userId,
        updatedAt: now,
      })
      .where(eq(engineConnection.id, existing.id))
      .returning()
    row = updated!
  } else {
    const [created] = await drizzle
      .insert(engineConnection)
      .values({
        id: newId('cn'),
        workspaceId: input.workspaceId,
        channelId: await channelIdFor(input.workspaceId, input.provider),
        provider: input.provider,
        displayName: connector.displayName,
        status: 'pending',
        credentialsEncrypted: encryptCredentials(credentials),
        scopes: 'scopes' in connector ? [...connector.scopes] : [],
        connectedBy: input.userId,
      })
      .returning()
    row = created!
  }

  const { ctx } = await buildConnectorContext(row.id)
  const health = await connector.healthCheck(ctx)
  const [final] = await drizzle
    .update(engineConnection)
    .set({
      status: health.ok ? 'connected' : 'error',
      lastSyncError: health.ok ? null : (health.detail ?? 'health check failed'),
      tokenExpiresAt: health.tokenExpiresAt ?? null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(engineConnection.id, row.id))
    .returning()

  await writeAudit({
    workspaceId: input.workspaceId,
    actor: userActor(input.userId),
    action: existing ? 'connection.rotate' : 'connection.create',
    entityType: 'connection',
    entityId: row.id,
    before: existing ? { status: existing.status } : null,
    after: {
      provider: input.provider,
      status: final!.status,
      health: health.detail ?? null,
    },
    reasoning: `${connector.displayName} connected with an api key`,
    ipAddress: input.ipAddress ?? null,
  })

  return { connection: toConnectionDto(final!), health }
}

export async function startOAuthConnection(input: {
  workspaceId: string
  userId: string
  provider: string
  returnTo?: string | null
  ipAddress?: string | null
}) {
  const connector = getConnector(input.provider)
  if (!connector) throw notFound(`Unknown connector ${input.provider}`)
  if (connectorAuthKind(connector) !== 'oauth') {
    throw notFound(`${connector.displayName} connects with an api key`, 400)
  }
  if (!connector.isConfigured()) {
    throw notFound(`${connector.displayName} is not configured on this server`, 400)
  }
  const result = await connector.connect({
    workspaceId: input.workspaceId,
    userId: input.userId,
    returnTo: input.returnTo ?? null,
  })
  await writeAudit({
    workspaceId: input.workspaceId,
    actor: userActor(input.userId),
    action: 'connection.oauth.start',
    entityType: 'oauth_state',
    entityId: result.stateId,
    after: { provider: input.provider },
    ipAddress: input.ipAddress ?? null,
  })
  return result
}

/** oauth callback: validate the state row, exchange the code, store the tokens */
export async function completeOAuthConnection(stateId: string, code: string) {
  const [state] = await drizzle
    .select()
    .from(engineOAuthState)
    .where(
      and(eq(engineOAuthState.id, stateId), sql`${engineOAuthState.expiresAt} > NOW()`),
    )
    .limit(1)
  if (!state) throw new Error('OAuth state expired or unknown')

  const connector = getConnector(state.provider)
  if (!connector || isRevenueConnector(connector) || !connector.completeConnect) {
    throw new Error(`Connector ${state.provider} cannot complete OAuth`)
  }

  const completed = await connector.completeConnect({
    workspaceId: state.workspaceId,
    stateId: state.id,
    code,
  })
  const now = new Date().toISOString()
  const values = {
    displayName: completed.displayName,
    status: 'connected',
    credentialsEncrypted: encryptCredentials(completed.credentials),
    scopes: [...connector.scopes],
    tokenExpiresAt: completed.credentials.expiresAt ?? null,
    lastSyncError: null,
    connectedBy: state.userId,
    updatedAt: now,
  }
  const [row] = await drizzle
    .insert(engineConnection)
    .values({
      id: newId('cn'),
      workspaceId: state.workspaceId,
      channelId: await channelIdFor(state.workspaceId, state.provider),
      provider: state.provider,
      externalAccountId: completed.externalAccountId,
      ...values,
    })
    .onConflictDoUpdate({
      target: [
        engineConnection.workspaceId,
        engineConnection.provider,
        engineConnection.externalAccountId,
      ],
      targetWhere: sql`${engineConnection.externalAccountId} IS NOT NULL`,
      set: values,
    })
    .returning()

  await drizzle.delete(engineOAuthState).where(eq(engineOAuthState.id, state.id))

  await writeAudit({
    workspaceId: state.workspaceId,
    actor: userActor(state.userId),
    action: 'connection.oauth.complete',
    entityType: 'connection',
    entityId: row!.id,
    after: {
      provider: state.provider,
      externalAccountId: completed.externalAccountId,
      displayName: completed.displayName,
    },
  })

  return {
    workspaceId: state.workspaceId,
    connectionId: row!.id,
    returnTo: state.returnTo,
    connection: toConnectionDto(row!),
  }
}

export type BuiltConnectorContext = {
  ctx: ConnectorContext
  connection: EngineConnection
  /** everything the connector logged during this context's life */
  logs: { message: string; data?: Record<string, unknown>; at: string }[]
}

/** decrypts credentials and wires the persistence callbacks a connector may call */
export async function buildConnectorContext(
  connectionId: string,
): Promise<BuiltConnectorContext> {
  const connection = await getConnection(connectionId)
  if (!connection) throw new Error(`Connection ${connectionId} not found`)

  const logs: BuiltConnectorContext['logs'] = []
  let settings = { ...connection.settings }

  const ctx: ConnectorContext = {
    workspaceId: connection.workspaceId,
    connectionId: connection.id,
    credentials: decryptCredentials(connection.credentialsEncrypted),
    settings,
    saveSettings: async (patch) => {
      settings = { ...settings, ...patch }
      ctx.settings = settings
      await drizzle
        .update(engineConnection)
        .set({ settings, updatedAt: new Date().toISOString() })
        .where(eq(engineConnection.id, connection.id))
    },
    saveCredentials: async (next) => {
      ctx.credentials = next
      await drizzle
        .update(engineConnection)
        .set({
          credentialsEncrypted: encryptCredentials(next),
          tokenExpiresAt: next.expiresAt ?? null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(engineConnection.id, connection.id))
    },
    log: (message, data) => {
      logs.push({ message, data, at: new Date().toISOString() })
      console.info(
        `[engine:${connection.provider}:${connection.id}] ${message}`,
        data ?? '',
      )
    },
  }
  return { ctx, connection, logs }
}

export async function disconnectConnection(input: {
  workspaceId: string
  connectionId: string
  userId: string
  ipAddress?: string | null
}) {
  const connection = await getConnection(input.connectionId)
  if (!connection || connection.workspaceId !== input.workspaceId) {
    throw notFound('Connection not found')
  }
  const connector = getConnector(connection.provider)
  if (connector && !isRevenueConnector(connector) && connector.disconnect) {
    try {
      const { ctx } = await buildConnectorContext(connection.id)
      await connector.disconnect(ctx)
    } catch (error) {
      console.error('[engine:connection] provider disconnect failed', error)
    }
  }
  await drizzle
    .update(engineConnection)
    .set({
      status: 'disconnected',
      credentialsEncrypted: null,
      tokenExpiresAt: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(engineConnection.id, connection.id))

  await writeAudit({
    workspaceId: input.workspaceId,
    actor: userActor(input.userId),
    action: 'connection.disconnect',
    entityType: 'connection',
    entityId: connection.id,
    before: { status: connection.status },
    after: { status: 'disconnected' },
    ipAddress: input.ipAddress ?? null,
  })
  return { ok: true as const }
}

export function defaultScopeFor(provider: string): SyncScope {
  const connector = getConnector(provider)
  return connector && isRevenueConnector(connector) ? 'orders' : 'all'
}

export async function enqueueSync(input: {
  workspaceId: string
  connectionId: string
  scope?: SyncScope | null
  userId?: string | null
  ipAddress?: string | null
}) {
  const connection = await getConnection(input.connectionId)
  if (!connection || connection.workspaceId !== input.workspaceId) {
    throw notFound('Connection not found')
  }
  if (connection.status !== 'connected') {
    throw notFound(`Connection is ${connection.status}`, 409)
  }
  const scope = input.scope ?? defaultScopeFor(connection.provider)
  const boss = await getBoss()
  const data: SyncJobData = { connectionId: connection.id, scope }
  const jobId = await boss.send(JOB_NAMES.engineConnectionSync, data, {
    retryLimit: 2,
    retryDelay: 30,
    expireInSeconds: 60 * 20,
  })
  if (input.userId) {
    await writeAudit({
      workspaceId: input.workspaceId,
      actor: userActor(input.userId),
      action: 'connection.sync.enqueue',
      entityType: 'connection',
      entityId: connection.id,
      after: { scope, jobId },
      ipAddress: input.ipAddress ?? null,
    })
  }
  return { queued: jobId !== null, jobId, scope }
}

function cursorKey(scope: SyncScope) {
  return `cursor:${scope}`
}

/**
 * runs inside the worker. revenue connectors page syncOrders into
 * upsertOrderFromRevenue; channel connectors page sync(scope). the cursor is
 * kept on the connection so a re-enqueued job resumes where this one stopped.
 */
export async function runConnectionSync(
  connectionId: string,
  scope: SyncScope,
): Promise<ConnectionSyncSummary> {
  const { ctx, connection, logs } = await buildConnectorContext(connectionId)
  const summary: ConnectionSyncSummary = {
    connectionId,
    workspaceId: connection.workspaceId,
    provider: connection.provider,
    scope,
    pages: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    hasMore: false,
    requeuedJobId: null,
  }

  const connector = getConnector(connection.provider)
  if (!connector) {
    summary.skippedReason = `unknown connector ${connection.provider}`
    return summary
  }
  if (connection.status !== 'connected') {
    summary.skippedReason = `connection is ${connection.status}`
    return summary
  }

  const key = cursorKey(scope)
  const stored = ctx.settings[key]
  let cursor: string | null = typeof stored === 'string' && stored ? stored : null
  let hasMore = true

  try {
    while (hasMore && summary.pages < SYNC_PAGE_CAP) {
      summary.pages += 1
      if (isRevenueConnector(connector)) {
        const page = await connector.syncOrders(ctx, cursor)
        for (const order of page.orders) {
          try {
            const result = await upsertOrderFromRevenue(
              connection.workspaceId,
              connector.key,
              order,
            )
            if (result.created) summary.created += 1
            else summary.updated += 1
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            summary.errors.push({ message, externalId: order.externalId })
          }
        }
        cursor = page.cursor
        hasMore = page.hasMore
      } else {
        const page = await connector.sync(ctx, scope, cursor)
        summary.created += page.created
        summary.updated += page.updated
        summary.skipped += page.skipped
        summary.errors.push(...page.errors)
        cursor = page.cursor ?? null
        hasMore = page.hasMore
      }
      await ctx.saveSettings({ [key]: hasMore ? cursor : null })
    }

    summary.hasMore = hasMore
    if (hasMore) {
      const boss = await getBoss()
      summary.requeuedJobId = await boss.send(JOB_NAMES.engineConnectionSync, {
        connectionId,
        scope,
      } satisfies SyncJobData)
    }

    await drizzle
      .update(engineConnection)
      .set({
        lastSyncAt: new Date().toISOString(),
        lastSyncError: summary.errors.length
          ? `${summary.errors.length} rows failed: ${summary.errors[0]!.message}`
          : null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(engineConnection.id, connectionId))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await drizzle
      .update(engineConnection)
      .set({ lastSyncError: message, updatedAt: new Date().toISOString() })
      .where(eq(engineConnection.id, connectionId))
    throw error
  }

  ctx.log('sync finished', {
    scope,
    pages: summary.pages,
    created: summary.created,
    updated: summary.updated,
    skipped: summary.skipped,
    errors: summary.errors.length,
    hasMore: summary.hasMore,
    logged: logs.length,
  })
  return summary
}
