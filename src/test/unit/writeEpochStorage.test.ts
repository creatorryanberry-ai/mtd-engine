import { describe, expect, it } from 'vitest'

import { createWriteEpochStorage } from '~/features/auth/client/writeEpochStorage'

function memoryInner() {
  const store = new Map<string, string>()
  return {
    store,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    clear: () => {
      store.clear()
    },
  }
}

describe('createWriteEpochStorage', () => {
  it('ignores writes from an adapter created before invalidate', () => {
    const inner = memoryInner()
    const epochStorage = createWriteEpochStorage(inner)
    const stale = epochStorage.fork()

    stale.setItem('straightuptax_cookie', 'session')
    expect(inner.getItem('straightuptax_cookie')).toBe('session')

    epochStorage.invalidate()
    stale.setItem('straightuptax_cookie', 'stale-session')

    expect(inner.getItem('straightuptax_cookie')).toBeNull()
  })

  it('accepts writes from an adapter created after invalidate', () => {
    const inner = memoryInner()
    const epochStorage = createWriteEpochStorage(inner)
    const stale = epochStorage.fork()
    stale.setItem('straightuptax_cookie', 'old')

    epochStorage.invalidate()
    const fresh = epochStorage.fork()
    fresh.setItem('straightuptax_cookie', 'new')

    expect(inner.getItem('straightuptax_cookie')).toBe('new')
    stale.setItem('straightuptax_cookie', 'old-again')
    expect(inner.getItem('straightuptax_cookie')).toBe('new')
  })
})
