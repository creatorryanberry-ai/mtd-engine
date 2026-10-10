import { decryptSecret, encryptSecret } from '~/server/encryption'

import type { ConnectorCredentials } from '../../channels/ChannelConnector'

/** connector credentials are stored as one aes-256-gcm blob on engineConnection */
export function encryptCredentials(credentials: ConnectorCredentials) {
  return encryptSecret(JSON.stringify(credentials))
}

export function decryptCredentials(
  payload: string | null | undefined,
): ConnectorCredentials {
  if (!payload) return {}
  return JSON.parse(decryptSecret(payload)) as ConnectorCredentials
}

/** last 4 chars only, for display on the integrations screen */
export function maskSecret(value: string | undefined | null) {
  if (!value) return null
  return `…${value.slice(-4)}`
}
