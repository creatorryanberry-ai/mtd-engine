import { MTD_ROUTES } from '~/features/mtd/constants'

function normalizeSettingsPath(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1)
  }
  return pathname
}

export function getSettingsBackHref(
  pathname: string,
): (typeof MTD_ROUTES)[keyof typeof MTD_ROUTES] {
  const normalized = normalizeSettingsPath(pathname)
  if (normalized === MTD_ROUTES.settings) {
    return MTD_ROUTES.overview
  }
  if (/^\/home\/settings\/bank-accounts\/[^/]+$/.test(normalized)) {
    return MTD_ROUTES.settingsBankAccounts
  }
  return MTD_ROUTES.settings
}

export function getSettingsTitle(pathname: string): string {
  const normalized = normalizeSettingsPath(pathname)

  if (normalized === MTD_ROUTES.settings) return 'Settings'
  if (normalized === MTD_ROUTES.settingsBankAccounts) return 'Bank Accounts'
  if (/^\/home\/settings\/bank-accounts\/[^/]+$/.test(normalized)) {
    return 'Edit account'
  }
  if (normalized === MTD_ROUTES.settingsBusinessSetup) return 'Business setup'
  if (normalized === MTD_ROUTES.settingsMtdEmail) return 'Your MTD email'
  if (normalized.endsWith('/edit-profile')) return 'Edit profile'

  return 'Settings'
}
