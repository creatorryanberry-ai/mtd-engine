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

function consumeBuffer(raw: string, onMessage: (data: string) => void) {
  const parts = raw.split('\n\n')
  const rest = parts.pop() ?? ''
  for (const part of parts) {
    for (const payload of parseSseBlock(part)) {
      if (payload) onMessage(payload)
    }
  }
  return rest
}

export async function subscribeLiveEvents(input: {
  signal: AbortSignal
  onMessage: (data: string) => void
}) {
  while (!input.signal.aborted) {
    const token = getAuthToken()
    await new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest()
      let processed = 0
      let pending = ''
      xhr.open('GET', `${API_BASE_URL}/api/events`)
      xhr.setRequestHeader('Accept', 'text/event-stream')
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      xhr.onprogress = () => {
        const chunk = xhr.responseText.slice(processed)
        processed = xhr.responseText.length
        pending = consumeBuffer(pending + chunk, input.onMessage)
      }
      xhr.onload = () => resolve()
      xhr.onerror = () => resolve()
      xhr.onabort = () => resolve()
      const onAbort = () => xhr.abort()
      input.signal.addEventListener('abort', onAbort, { once: true })
      xhr.send()
    })
    if (input.signal.aborted) return
    await wait(input.signal, 2000)
  }
}
