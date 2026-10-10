import { prettyPrintResponse } from '@mtd/helpers'

import { DEMO_EMAIL } from '~/constants/app'

import { isDemoAuthAllowed } from './isDemoAuthAllowed'
import { isPublicAuthAllowed } from './isPublicAuthAllowed'
import { authServer } from './authServer'

const SESSION_MAINTENANCE_PATHS = ['/get-session', '/sign-out', '/jwks'] as const

const DEMO_AUTH_PATHS = [
  '/api/auth/sign-in/email-otp',
  '/api/auth/email-otp/send-verification-otp',
] as const

function isSessionMaintenancePath(pathname: string) {
  return SESSION_MAINTENANCE_PATHS.some((segment) => pathname.includes(segment))
}

function rejectAdminAuthRoutes(req: Request): Response | null {
  const url = new URL(req.url)
  if (!url.pathname.includes('/api/auth/admin')) return null
  return Response.json(
    { message: 'Admin auth routes are disabled (impersonation deferred)' },
    { status: 403 },
  )
}

function rejectPublicAuthIfDisabled(req: Request): Response | null {
  if (isPublicAuthAllowed()) return null

  const url = new URL(req.url)
  if (!url.pathname.startsWith('/api/auth')) return null
  if (isSessionMaintenancePath(url.pathname)) return null

  return Response.json({ message: 'Sign in is not available' }, { status: 403 })
}

async function rejectDemoAuthIfDisabled(req: Request): Promise<Response | null> {
  if (isDemoAuthAllowed()) return null
  const url = new URL(req.url)
  if (!DEMO_AUTH_PATHS.some((path) => url.pathname.includes(path))) {
    return null
  }
  const body = await req
    .clone()
    .json()
    .catch(() => null)
  const email = body && typeof body.email === 'string' ? body.email : ''
  if (email.toLowerCase() !== DEMO_EMAIL.toLowerCase()) return null
  return Response.json({ message: 'Demo login is disabled' }, { status: 403 })
}

export function authAPIHandler(method: 'GET' | 'POST') {
  return async (req: Request) => {
    const adminBlocked = rejectAdminAuthRoutes(req)
    if (adminBlocked) return adminBlocked

    const publicAuthBlocked = rejectPublicAuthIfDisabled(req)
    if (publicAuthBlocked) return publicAuthBlocked

    const demoBlocked = await rejectDemoAuthIfDisabled(req)
    if (demoBlocked) return demoBlocked

    const res = await authServer.handler(req)

    if (process.env.DEBUG || res.status >= 400) {
      console.info(`[auth] ${method} ${res.status}`, req.url)
      prettyPrintResponse(res)
    }

    return res
  }
}
