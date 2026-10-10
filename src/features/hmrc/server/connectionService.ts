import { and, eq, sql } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import { hmrcConnection, hmrcOAuthState } from '~/database/schema'
import { server } from '~/env'
import { HMRC_SCOPES } from '~/features/hmrc/constants'

import { exchangeAuthorizationCode } from './client'
import {
  createOAuthState,
  createPkcePair,
  decryptNino,
  encryptHmrcToken,
  encryptNino,
  isValidNino,
  ninoLast4,
  normalizeNino,
} from './crypto'
import {
  getHmrcRedirectUri,
  getHmrcUrls,
  isHmrcConfigured,
  requireHmrcConfigured,
  getHmrcEnvironment,
} from './config'

import type { HmrcConnectionStatus } from '../types'

export async function createHmrcAuthorizationRequest(input: {
  userId: string
  nino: string
  platform: 'web' | 'native'
  returnTo?: string
}) {
  requireHmrcConfigured()

  const normalizedNino = normalizeNino(input.nino)
  if (!isValidNino(normalizedNino)) {
    throw new Error('Enter a valid National Insurance number')
  }

  const { codeVerifier, codeChallenge } = createPkcePair()
  const state = createOAuthState()
  const redirectUri = getHmrcRedirectUri(input.platform)
  const now = new Date().toISOString()

  // one active OAuth flow per user — avoids callback hitting an old expired state
  await drizzle.delete(hmrcOAuthState).where(eq(hmrcOAuthState.userId, input.userId))

  await drizzle.insert(hmrcOAuthState).values({
    id: state,
    userId: input.userId,
    nino: encryptNino(normalizedNino),
    codeVerifier,
    redirectUri,
    returnTo: input.returnTo ?? null,
    expiresAt: sql`NOW() + INTERVAL '30 minutes'`,
    createdAt: now,
  })

  const { authorizeUrl } = getHmrcUrls()
  const url = new URL(authorizeUrl)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', server.HMRC_CLIENT_ID)
  url.searchParams.set('scope', HMRC_SCOPES)
  url.searchParams.set('state', state)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('code_challenge', codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')

  return {
    authorizationUrl: url.toString(),
    state,
    redirectUri,
    nino: normalizedNino,
  }
}

export async function completeHmrcAuthorization(input: {
  userId: string
  state: string
  code: string
}) {
  const [oauthState] = await drizzle
    .select()
    .from(hmrcOAuthState)
    .where(
      and(
        eq(hmrcOAuthState.id, input.state),
        eq(hmrcOAuthState.userId, input.userId),
        sql`${hmrcOAuthState.expiresAt} > NOW()`,
      ),
    )
    .limit(1)

  if (!oauthState) {
    throw new Error('OAuth state expired')
  }

  const normalizedNino = decryptNino(oauthState.nino)

  const token = await exchangeAuthorizationCode({
    code: input.code,
    redirectUri: oauthState.redirectUri,
    codeVerifier: oauthState.codeVerifier,
  })

  const now = new Date().toISOString()
  const accessTokenExpiresAt = new Date(
    Date.now() + token.expires_in * 1000,
  ).toISOString()
  const id = crypto.randomUUID()
  const encryptedNino = encryptNino(normalizedNino)

  await drizzle
    .insert(hmrcConnection)
    .values({
      id,
      userId: input.userId,
      nino: encryptedNino,
      accessToken: encryptHmrcToken(token.access_token),
      refreshToken: encryptHmrcToken(token.refresh_token),
      accessTokenExpiresAt,
      scope: token.scope ?? HMRC_SCOPES,
      connectedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: hmrcConnection.userId,
      set: {
        nino: encryptedNino,
        accessToken: encryptHmrcToken(token.access_token),
        refreshToken: encryptHmrcToken(token.refresh_token),
        accessTokenExpiresAt,
        scope: token.scope ?? HMRC_SCOPES,
        businessId: null,
        businessName: null,
        updatedAt: now,
      },
    })

  await drizzle.delete(hmrcOAuthState).where(eq(hmrcOAuthState.id, input.state))

  return {
    returnTo: oauthState.returnTo,
    nino: normalizedNino,
  }
}

export async function disconnectHmrc(userId: string) {
  await drizzle.delete(hmrcConnection).where(eq(hmrcConnection.userId, userId))
}

export async function getHmrcConnectionStatus(
  userId: string,
): Promise<HmrcConnectionStatus> {
  const environment = getHmrcEnvironment()

  if (!isHmrcConfigured()) {
    return {
      configured: false,
      connected: false,
      environment,
      nino: null,
      businessId: null,
      businessName: null,
      connectedAt: null,
      tokenExpiresAt: null,
    }
  }

  const [row] = await drizzle
    .select()
    .from(hmrcConnection)
    .where(eq(hmrcConnection.userId, userId))
    .limit(1)

  if (!row) {
    return {
      configured: true,
      connected: false,
      environment,
      nino: null,
      businessId: null,
      businessName: null,
      connectedAt: null,
      tokenExpiresAt: null,
    }
  }

  return {
    configured: true,
    connected: true,
    environment,
    // API never returns a full NINO — only last 4 for display
    nino: ninoLast4(decryptNino(row.nino)),
    businessId: row.businessId,
    businessName: row.businessName,
    connectedAt: row.connectedAt,
    tokenExpiresAt: row.accessTokenExpiresAt,
  }
}

export async function setHmrcBusiness(
  userId: string,
  businessId: string,
  businessName: string | null,
) {
  const [updated] = await drizzle
    .update(hmrcConnection)
    .set({
      businessId,
      businessName,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(hmrcConnection.userId, userId))
    .returning()

  if (!updated) {
    throw new Error('HMRC is not connected')
  }

  return updated
}
