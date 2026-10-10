import * as v from 'valibot'

import { defineRoute } from '~/api/defineRoute'
import { requireApiAuth } from '~/api/requireAuth'
import { subscribeUserEvents } from '~/api/events/pgListen'
import {
  API_CONTRACT_VERSION,
  classifyAppVersion,
  COMPATIBILITY,
  handshakeResponseSchema,
} from '~/contract'

import type { Endpoint } from 'one'

export const handshakeHandler = defineRoute({
  method: 'GET',
  path: '/api/handshake',
  summary: 'App/API compatibility handshake',
  tags: ['meta'],
  security: 'public',
  input: v.optional(
    v.object({
      appVersion: v.optional(v.string()),
    }),
  ),
  output: handshakeResponseSchema,
  handler: async (_input, { request }) => {
    const appVersion =
      request.headers.get('x-app-version') ??
      new URL(request.url).searchParams.get('appVersion') ??
      COMPATIBILITY.currentAppVersion

    return {
      status: classifyAppVersion(appVersion),
      apiContract: API_CONTRACT_VERSION,
      minSupportedAppVersion: COMPATIBILITY.minSupportedAppVersion,
      currentAppVersion: COMPATIBILITY.currentAppVersion,
    }
  },
})

export const GET: Endpoint = handshakeHandler

export const eventsHandler: Endpoint = async (request) => {
  const auth = await requireApiAuth(request)

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      const send = (data: string) => {
        controller.enqueue(encoder.encode(`data: ${data}\n\n`))
      }

      send(JSON.stringify({ type: 'connected' }))

      let unsubscribe: (() => Promise<void>) | null = null
      try {
        unsubscribe = await subscribeUserEvents(auth.id, (payload) => {
          send(payload)
        })
      } catch (error) {
        console.error('[api] sse subscribe error', error)
        send(JSON.stringify({ type: 'error', message: 'subscribe_failed' }))
      }

      const heartbeat = setInterval(() => {
        send(JSON.stringify({ type: 'heartbeat', at: Date.now() }))
      }, 25000)

      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat)
        void unsubscribe?.()
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  })
}
