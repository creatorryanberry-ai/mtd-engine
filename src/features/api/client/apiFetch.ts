import { API_BASE_URL } from '~/constants/urls'
import { getAuthToken } from '~/features/auth/client/authFetch'

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, headers, ...rest } = init
  const token = getAuthToken()
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
    credentials: 'include',
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error((err as { error?: string }).error ?? 'Request failed')
  }

  return response.json() as Promise<T>
}
