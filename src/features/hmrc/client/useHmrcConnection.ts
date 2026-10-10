import { useCallback, useEffect, useState } from 'react'
import { isWeb } from 'tamagui'
import * as WebBrowser from 'expo-web-browser'

import { authFetch } from '~/features/auth/client/authFetch'
import { useAuth } from '~/features/auth/client/authClient'
import { useEmitter } from '@mtd/helpers'

import { getHmrcFraudHeaderRecord } from './collectFraudHeaders'
import { hmrcConnectionEmitter, notifyHmrcConnectionChanged } from './hmrcEmitter'

import type { HmrcConnectionStatus } from '../types'

type AuthorizeResponse = {
  authorizationUrl: string
  state: string
  redirectUri: string
  nino: string
}

const defaultStatus: HmrcConnectionStatus = {
  configured: false,
  connected: false,
  environment: 'sandbox',
  nino: null,
  businessId: null,
  businessName: null,
  connectedAt: null,
  tokenExpiresAt: null,
}

export function useHmrcConnection() {
  const auth = useAuth()
  const userId = auth?.user?.id

  const [status, setStatus] = useState<HmrcConnectionStatus>(defaultStatus)
  const [isLoading, setIsLoading] = useState(true)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!userId) {
      setIsLoading(false)
      return
    }

    const response = await authFetch<HmrcConnectionStatus>('/api/hmrc/status', {
      headers: getHmrcFraudHeaderRecord(),
    })

    if (!response.error && response.data) {
      setStatus(response.data)
    }

    setIsLoading(false)
  }, [userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!isWeb || typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)
    const hmrc = params.get('hmrc')
    const message = params.get('message')

    if (hmrc === 'connected') {
      notifyHmrcConnectionChanged()
      void refresh()
      return
    }

    if (hmrc === 'error' && message) {
      setError(message.replace(/_/g, ' '))
    }
  }, [refresh])

  useEmitter(hmrcConnectionEmitter, () => {
    void refresh()
  })

  const connect = useCallback(
    async (nino: string) => {
      if (!userId || isConnecting) return

      setIsConnecting(true)
      setError(null)

      try {
        const response = await authFetch<AuthorizeResponse>('/api/hmrc/authorize', {
          method: 'POST',
          headers: getHmrcFraudHeaderRecord(),
          body: { nino, platform: isWeb ? 'web' : 'native', returnTo: '/home/settings' },
        })

        if (response.error || !response.data?.authorizationUrl) {
          throw new Error(response.error?.message || 'Failed to start HMRC authorisation')
        }

        if (isWeb) {
          window.location.assign(response.data.authorizationUrl)
          return
        }

        const result = await WebBrowser.openAuthSessionAsync(
          response.data.authorizationUrl,
          response.data.redirectUri,
        )

        if (result.type !== 'success' || !result.url) {
          throw new Error('HMRC authorisation was cancelled')
        }

        const callbackUrl = new URL(result.url)
        const code = callbackUrl.searchParams.get('code')
        const state = callbackUrl.searchParams.get('state')

        if (!code || !state) {
          throw new Error('HMRC authorisation did not return a code')
        }

        const exchange = await authFetch<{ connected: boolean }>('/api/hmrc/callback', {
          method: 'POST',
          headers: getHmrcFraudHeaderRecord(),
          body: { code, state },
        })

        if (exchange.error) {
          throw new Error(
            exchange.error.message || 'Failed to complete HMRC authorisation',
          )
        }

        notifyHmrcConnectionChanged()
        await refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to connect HMRC')
      } finally {
        setIsConnecting(false)
      }
    },
    [isConnecting, refresh, userId],
  )

  const disconnect = useCallback(async () => {
    const response = await authFetch('/api/hmrc/disconnect', {
      method: 'DELETE',
      headers: getHmrcFraudHeaderRecord(),
    })

    if (response.error) {
      throw new Error(response.error.message || 'Failed to disconnect HMRC')
    }

    notifyHmrcConnectionChanged()
    await refresh()
  }, [refresh])

  return {
    status,
    isLoading,
    isConnecting,
    error,
    connect,
    disconnect,
    refresh,
  }
}
