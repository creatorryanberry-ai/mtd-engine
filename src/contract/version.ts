import { APP_VERSION } from '~/constants/app'

/** Bump when REST request/response shapes change incompatibly. */
export const API_CONTRACT_VERSION = 1

export const COMPATIBILITY = {
  minSupportedAppVersion: '0.0.0',
  deprecatedBelow: '0.0.0',
  currentAppVersion: APP_VERSION,
} as const

export type HandshakeStatus = 'ok' | 'deprecated' | 'blocked'

export function classifyAppVersion(appVersion: string): HandshakeStatus {
  const parse = (v: string) => v.split('.').map((n) => Number.parseInt(n, 10) || 0)
  const [aMaj, aMin, aPatch] = parse(appVersion)
  const [minMaj, minMin, minPatch] = parse(COMPATIBILITY.minSupportedAppVersion)
  const [depMaj, depMin, depPatch] = parse(COMPATIBILITY.deprecatedBelow)

  const cmp = (
    maj: number,
    min: number,
    patch: number,
    bMaj: number,
    bMin: number,
    bPatch: number,
  ) => {
    if (maj !== bMaj) return maj - bMaj
    if (min !== bMin) return min - bMin
    return patch - bPatch
  }

  if (cmp(aMaj, aMin, aPatch, minMaj, minMin, minPatch) < 0) return 'blocked'
  if (cmp(aMaj, aMin, aPatch, depMaj, depMin, depPatch) < 0) return 'deprecated'
  return 'ok'
}
