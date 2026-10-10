import { hubspotConnector } from './hubspot/HubspotConnector'
import { stripeConnector } from './stripe/StripeConnector'
import { isRevenueConnector } from './ChannelConnector'

import type { AnyConnector } from './ChannelConnector'
import type { ConnectorInfoDto } from '../contract'

/** every connector the engine knows about, keyed by provider key */
export const CONNECTORS: Readonly<Record<string, AnyConnector>> = {
  [stripeConnector.key]: stripeConnector,
  [hubspotConnector.key]: hubspotConnector,
}

export function getConnector(key: string): AnyConnector | null {
  return Object.hasOwn(CONNECTORS, key) ? CONNECTORS[key]! : null
}

/** oauth providers implement completeConnect; everything else takes an api key */
export function connectorAuthKind(connector: AnyConnector): ConnectorInfoDto['authKind'] {
  return !isRevenueConnector(connector) && typeof connector.completeConnect === 'function'
    ? 'oauth'
    : 'api_key'
}

export function listConnectorInfo(): ConnectorInfoDto[] {
  return Object.values(CONNECTORS).map((connector) => ({
    key: connector.key,
    displayName: connector.displayName,
    kind: connector.kind,
    configured: connector.isConfigured(),
    authKind: connectorAuthKind(connector),
    scopes: 'scopes' in connector ? [...connector.scopes] : [],
  }))
}
