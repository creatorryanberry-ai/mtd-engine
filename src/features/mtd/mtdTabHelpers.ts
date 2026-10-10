import { MTD_ROUTES } from './constants'

export function normalizeMtdPathname(pathname: string) {
  const trimmed =
    pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname

  if (trimmed.startsWith('/home')) return trimmed
  if (trimmed.startsWith('/')) return `/home${trimmed}`
  if (trimmed.length === 0) return '/home'
  return `/home/${trimmed}`
}

export function getMtdActiveTab(pathname: string) {
  const path = normalizeMtdPathname(pathname)

  if (path.startsWith('/home/settings')) return 'more'
  if (
    path.startsWith('/home/records') ||
    path.startsWith('/home/bank-accounts') ||
    path.startsWith('/home/download-transactions') ||
    path.startsWith('/home/mileage') ||
    path.startsWith('/home/inbox')
  ) {
    return 'records'
  }
  if (
    path.startsWith('/home/categorise-transactions') ||
    path.startsWith('/home/categorisation-rules')
  ) {
    return null
  }
  if (path.startsWith('/home/submissions') || path.startsWith('/home/submit-to-hmrc')) {
    return 'submissions'
  }
  if (path.startsWith('/home/estimated-tax')) {
    return 'home'
  }
  return 'home'
}

export function getMtdTabHref(tabId: string) {
  const tabRoutes = {
    home: MTD_ROUTES.overview,
    records: MTD_ROUTES.records,
    submissions: MTD_ROUTES.submissions,
    more: MTD_ROUTES.settings,
  } as const

  return tabRoutes[tabId as keyof typeof tabRoutes] ?? MTD_ROUTES.overview
}
