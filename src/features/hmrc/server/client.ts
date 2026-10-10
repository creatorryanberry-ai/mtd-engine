import { eq } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import { hmrcConnection } from '~/database/schema'
import { server } from '~/env'

import { decryptHmrcToken, decryptNino, encryptHmrcToken } from './crypto'
import { getHmrcUrls, requireHmrcConfigured } from './config'
import { buildHmrcFraudHeaders } from './fraudHeaders'

import type { HmrcFraudHeadersInput } from '../types'

type HmrcTokenResponse = {
  access_token: string
  refresh_token: string
  expires_in: number
  scope?: string
  token_type?: string
}

type HmrcRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  accessToken: string
  accept?: string
  body?: unknown
  fraudHeaders?: HmrcFraudHeadersInput
  request?: Request
  govTestScenario?: string
}

export class HmrcApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'HmrcApiError'
    this.status = status
    this.code = code
  }
}

export async function exchangeAuthorizationCode(input: {
  code: string
  redirectUri: string
  codeVerifier: string
}) {
  requireHmrcConfigured()
  const { tokenUrl } = getHmrcUrls()

  const body = new URLSearchParams({
    client_secret: server.HMRC_CLIENT_SECRET,
    client_id: server.HMRC_CLIENT_ID,
    grant_type: 'authorization_code',
    redirect_uri: input.redirectUri,
    code: input.code,
    code_verifier: input.codeVerifier,
  })

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`HMRC token exchange failed: ${text}`)
  }

  return (await response.json()) as HmrcTokenResponse
}

export async function refreshHmrcAccessToken(refreshToken: string) {
  requireHmrcConfigured()
  const { tokenUrl } = getHmrcUrls()

  const body = new URLSearchParams({
    client_secret: server.HMRC_CLIENT_SECRET,
    client_id: server.HMRC_CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`HMRC token refresh failed: ${text}`)
  }

  return (await response.json()) as HmrcTokenResponse
}

export async function hmrcApiRequest<T>(options: HmrcRequestOptions): Promise<T> {
  const { apiBaseUrl } = getHmrcUrls()
  const headers: Record<string, string> = {
    Authorization: `Bearer ${options.accessToken}`,
    Accept: options.accept ?? 'application/vnd.hmrc.5.0+json',
  }

  if (options.body !== undefined) {
    headers['content-type'] = 'application/json'
  }

  if (options.govTestScenario) {
    headers['Gov-Test-Scenario'] = options.govTestScenario
  }

  if (options.request) {
    Object.assign(
      headers,
      buildHmrcFraudHeaders(options.fraudHeaders ?? {}, options.request),
    )
  }

  const response = await fetch(`${apiBaseUrl}${options.path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  if (response.status === 204) {
    return undefined as T
  }

  const text = await response.text()
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : null

  if (!response.ok) {
    const code = typeof data?.code === 'string' ? data.code : undefined
    const message =
      typeof data?.message === 'string'
        ? data.message
        : `HMRC request failed (${response.status})`
    throw new HmrcApiError(message, response.status, code)
  }

  return data as T
}

export async function getValidHmrcAccessToken(userId: string) {
  const [row] = await drizzle
    .select()
    .from(hmrcConnection)
    .where(eq(hmrcConnection.userId, userId))
    .limit(1)

  if (!row) {
    throw new Error('HMRC is not connected')
  }

  const expiresAt = new Date(row.accessTokenExpiresAt).getTime()
  const refreshBufferMs = 60_000

  const connection = {
    ...row,
    nino: decryptNino(row.nino),
  }

  if (Date.now() < expiresAt - refreshBufferMs) {
    return {
      accessToken: decryptHmrcToken(row.accessToken),
      connection,
    }
  }

  const refreshed = await refreshHmrcAccessToken(decryptHmrcToken(row.refreshToken))
  const accessTokenExpiresAt = new Date(
    Date.now() + refreshed.expires_in * 1000,
  ).toISOString()

  await drizzle
    .update(hmrcConnection)
    .set({
      accessToken: encryptHmrcToken(refreshed.access_token),
      refreshToken: encryptHmrcToken(refreshed.refresh_token),
      accessTokenExpiresAt,
      scope: refreshed.scope ?? row.scope,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(hmrcConnection.userId, userId))

  return {
    accessToken: refreshed.access_token,
    connection: {
      ...connection,
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
      accessTokenExpiresAt,
      scope: refreshed.scope ?? row.scope,
    },
  }
}
