import { API_BASE_URL } from '~/constants/urls'
import { getAuthToken } from '~/features/auth/client/authFetch'

import { parseSseBlock } from './parseSseBlock'

function wait(signal: AbortSignal, ms: number) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms)
    const onAbort = () => {
      clearTimeout(timer)
      resolve()
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

export async function subscribeLiveEvents(input: {
  signal: AbortSignal
  onMessage: (data: string) => void
}) {
  while (!input.signal.aborted) {
    try {
      const token = getAuthToken()
      const response = await fetch(`${API_BASE_URL}/api/events`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
        signal: input.signal,
      })
      if (response.status === 401) return
      if (!response.ok || !response.body) {
        await wait(input.signal, 2000)
        continue
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (!input.signal.aborted) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''
        for (const part of parts) {
          for (const payload of parseSseBlock(part)) {
            if (payload) input.onMessage(payload)
          }
        }
      }
    } catch {
      if (input.signal.aborted) return
    }
    await wait(input.signal, 2000)
  }
}
