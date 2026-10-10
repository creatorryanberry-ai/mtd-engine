import { beforeEach, describe, expect, it, vi } from 'vitest'

import { setStorageDriver } from '@mtd/helpers'

type SessionPayload = {
  data?: {
    session?: { id: string; token: string; userId: string }
    user?: { id: string; email?: string }
  }
  isPending: boolean
  error?: unknown
}

type SessionCallback = (props: SessionPayload) => void | Promise<void>

const { subscribers, createAuthClientMock } = vi.hoisted(() => {
  const subscribers = new Set<SessionCallback>()

  const createAuthClientMock = vi.fn(() => ({
    useSession: {
      subscribe: (cb: SessionCallback) => {
        subscribers.add(cb)
        return () => {
          subscribers.delete(cb)
        }
      },
    },
    $fetch: vi.fn(async () => ({ data: { token: 'jwt-token' }, error: null })),
    signOut: vi.fn(),
  }))

  return { subscribers, createAuthClientMock }
})

vi.mock('better-auth/client', () => ({
  createAuthClient: createAuthClientMock,
}))

import { createBetterAuthClient } from './createAuthClient'

const demoSession: SessionPayload = {
  data: {
    session: { id: 'sess-1', token: 'tok-1', userId: 'user-1' },
    user: { id: 'user-1', email: 'demo@test.com' },
  },
  isPending: false,
}

async function emitSession(props: SessionPayload) {
  await Promise.all([...subscribers].map((cb) => cb(props)))
}

function memoryDriver() {
  const store = new Map<string, string>()
  setStorageDriver({
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value)
    },
    removeItem: (key) => {
      store.delete(key)
    },
    getAllKeys: () => [...store.keys()],
  })
}

let clientSeq = 0

function makeClient(options?: { onClearAuth?: () => void }) {
  clientSeq += 1
  return createBetterAuthClient({
    baseURL: 'http://auth.test',
    storagePrefix: `sign-out-${clientSeq}`,
    onClearAuth: options?.onClearAuth,
  })
}

describe('createBetterAuthClient sign-out', () => {
  beforeEach(() => {
    subscribers.clear()
    createAuthClientMock.mockClear()
    memoryDriver()
  })

  it('ignores a stale session update after clearAllAuth', async () => {
    const client = makeClient()
    await emitSession(demoSession)
    expect(client.getAuth().state).toBe('logged-in')

    const staleCallbacks = [...subscribers]
    client.clearAllAuth()
    expect(client.getAuth().state).toBe('logged-out')

    await Promise.all(staleCallbacks.map((cb) => cb(demoSession)))
    expect(client.getAuth().state).toBe('logged-out')
    expect(client.getAuth().user).toBeNull()
    expect(client.getAuth().session).toBeNull()
  })

  it('runs onClearAuth after dropping the old session listener and before a new one', async () => {
    const order: string[] = []
    const client = makeClient({
      onClearAuth: () => {
        order.push(`clear:${subscribers.size}`)
      },
    })
    await emitSession(demoSession)

    client.clearAllAuth()

    expect(order).toEqual(['clear:0'])
    expect(subscribers.size).toBe(1)
    expect(client.getAuth().state).toBe('logged-out')
  })

  it('recreates the auth client so a later session fetch cannot reuse the old instance', async () => {
    const client = makeClient()
    await emitSession(demoSession)
    const clientsBefore = createAuthClientMock.mock.results.length

    client.clearAllAuth()

    expect(createAuthClientMock.mock.results.length).toBe(clientsBefore + 1)
    expect(client.getAuth().state).toBe('logged-out')
  })

  it('does not apply a jwt fetched for a session that was signed out', async () => {
    let resolveToken:
      | ((value: { data: { token: string }; error: null }) => void)
      | undefined
    createAuthClientMock.mockImplementation(() => ({
      useSession: {
        subscribe: (cb: SessionCallback) => {
          subscribers.add(cb)
          return () => {
            subscribers.delete(cb)
          }
        },
      },
      $fetch: vi.fn(
        () =>
          new Promise((resolve) => {
            resolveToken = resolve
          }),
      ),
      signOut: vi.fn(),
    }))

    const client = createBetterAuthClient({
      baseURL: 'http://auth.test',
      storagePrefix: `sign-out-jwt-${++clientSeq}`,
      useJWT: true,
    })

    await emitSession(demoSession)
    client.clearAllAuth()
    expect(client.getAuth().token).toBeNull()

    resolveToken?.({ data: { token: 'stale-jwt' }, error: null })
    await Promise.resolve()
    await Promise.resolve()

    expect(client.getAuth().state).toBe('logged-out')
    expect(client.getAuth().token).toBeNull()
  })
})
