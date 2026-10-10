import { createStorageValue } from '@mtd/helpers'

export type PendingOtpChallenge = {
  method: 'email'
  value: string
}

const pendingOtpChallenge = createStorageValue<PendingOtpChallenge>('auth-pending-otp')

export function savePendingOtpChallenge(challenge: PendingOtpChallenge) {
  pendingOtpChallenge.set(challenge)
}

export function loadPendingOtpChallenge(): PendingOtpChallenge | undefined {
  return pendingOtpChallenge.get()
}

export function clearPendingOtpChallenge() {
  pendingOtpChallenge.remove()
}
