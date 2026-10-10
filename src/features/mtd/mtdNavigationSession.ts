import { normalizeMtdPathname } from '~/features/mtd/mtdTabHelpers'
import { MTD_ROUTES } from '~/features/mtd/constants'

let settingsNavigationAllowed = false
let nativeForTests: boolean | undefined

export function allowSettingsNavigation() {
  settingsNavigationAllowed = true
}

export function resetSettingsNavigationForTests() {
  settingsNavigationAllowed = false
  nativeForTests = undefined
}

export function setNativeForTests(value: boolean) {
  nativeForTests = value
}

function isNativeEnvironment() {
  if (nativeForTests !== undefined) return nativeForTests
  return Boolean(process.env.VITE_NATIVE)
}

export function shouldBlockNativeSettingsLanding(pathname: string) {
  if (!isNativeEnvironment() || settingsNavigationAllowed) {
    return false
  }

  const path = normalizeMtdPathname(pathname)
  return (
    path === MTD_ROUTES.settings || path === '/home' || path.startsWith('/home/settings/')
  )
}

/** allow settings landing, then navigate — call from press handlers (not Link onPress alone). */
export function openSettings(push: (href: string) => void) {
  allowSettingsNavigation()
  push(MTD_ROUTES.settings)
}
