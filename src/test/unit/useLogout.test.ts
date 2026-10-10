import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchMock, clearAllAuth, queryClear, dialogConfirm, showError, routerReplace } =
  vi.hoisted(() => ({
    fetchMock: vi.fn(),
    clearAllAuth: vi.fn(),
    queryClear: vi.fn(),
    dialogConfirm: vi.fn(),
    showError: vi.fn(),
    routerReplace: vi.fn(),
  }))

vi.mock('~/features/auth/client/authClient', () => ({
  authClient: {
    $fetch: (...args: unknown[]) => fetchMock(...args),
  },
  clearAllAuth: (...args: unknown[]) => clearAllAuth(...args),
}))

vi.mock('~/features/api/client/queryClient', () => ({
  queryClient: {
    clear: () => queryClear(),
    cancelQueries: vi.fn(async () => {}),
  },
}))

vi.mock('~/interface/dialogs/actions', () => ({
  dialogConfirm: (...args: unknown[]) => dialogConfirm(...args),
  showError: (...args: unknown[]) => showError(...args),
}))

vi.mock('~/interface/alert/controller', () => ({
  alertController: {
    confirmAsync: vi.fn(async () => false),
  },
}))

vi.mock('one', () => ({
  useRouter: () => ({ replace: routerReplace }),
}))

import { useLogout } from '~/features/auth/useLogout'

describe('useLogout', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    clearAllAuth.mockReset()
    queryClear.mockReset()
    dialogConfirm.mockReset()
    showError.mockReset()
    routerReplace.mockReset()
    fetchMock.mockResolvedValue({})
  })

  it('signs out on the server before clearing local auth', async () => {
    const order: string[] = []
    fetchMock.mockImplementation(async () => {
      order.push('sign-out')
      return {}
    })
    clearAllAuth.mockImplementation(() => {
      order.push('clearAllAuth')
    })
    queryClear.mockImplementation(() => {
      order.push('queryClient.clear')
    })

    const { logout } = useLogout()
    await expect(logout({ skipConfirm: true })).resolves.toBe(true)

    expect(fetchMock).toHaveBeenCalledWith('/sign-out', { method: 'POST' })
    expect(order).toEqual(['sign-out', 'clearAllAuth', 'queryClient.clear'])
  })

  it('still clears local auth when the server sign-out request fails', async () => {
    fetchMock.mockRejectedValue(new Error('network'))

    const { logout } = useLogout()
    await expect(logout({ skipConfirm: true })).resolves.toBe(true)

    expect(clearAllAuth).toHaveBeenCalledOnce()
    expect(queryClear).toHaveBeenCalledOnce()
  })

  it('still clears local auth when the server sign-out request never resolves', async () => {
    fetchMock.mockImplementation(() => new Promise(() => {}))

    const { logout } = useLogout()
    await expect(logout({ skipConfirm: true })).resolves.toBe(true)

    expect(fetchMock).toHaveBeenCalledWith('/sign-out', { method: 'POST' })
    expect(clearAllAuth).toHaveBeenCalledOnce()
    expect(queryClear).toHaveBeenCalledOnce()
  })

  it('does not sign out when the user cancels confirmation', async () => {
    dialogConfirm.mockResolvedValue(false)

    const { logout } = useLogout()
    await expect(logout()).resolves.toBe(false)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(clearAllAuth).not.toHaveBeenCalled()
    expect(routerReplace).not.toHaveBeenCalled()
  })

  it('replaces to login after auth layouts can commit logged-out', async () => {
    vi.useFakeTimers()
    try {
      const { logout } = useLogout()
      const done = logout({ skipConfirm: true })

      expect(clearAllAuth).toHaveBeenCalledOnce()
      expect(routerReplace).not.toHaveBeenCalled()

      vi.runAllTimers()
      await expect(done).resolves.toBe(true)
      expect(routerReplace).toHaveBeenCalledWith('/auth/login')
    } finally {
      vi.useRealTimers()
    }
  })
})
