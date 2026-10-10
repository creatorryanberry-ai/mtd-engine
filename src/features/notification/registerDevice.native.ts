import { apiFetch } from '~/features/api/client/apiFetch'

import { registerForPushNotificationsAsync } from './registerForPushNotificationsAsync'

type RegisterDeviceResult =
  | { success: true; deviceId: string }
  | { success: false; error: string }

export const registerDevice = async (userId: string): Promise<RegisterDeviceResult> => {
  if (!userId) {
    return { success: false, error: 'user-id-required' }
  }

  const result = await registerForPushNotificationsAsync()

  if (!result.success) {
    return { success: false, error: result.error }
  }

  const deviceId = `${userId}_${result.platform}`

  try {
    await apiFetch('/api/devices', {
      method: 'PUT',
      json: {
        id: deviceId,
        platform: result.platform,
        pushToken: result.pushToken,
        pushEnabled: true,
      },
    })
    console.info('[registerDevice] device upserted:', deviceId)

    return { success: true, deviceId }
  } catch (error) {
    console.error('[registerDevice] failed:', error)
    return { success: false, error: 'database-error' }
  }
}

export const disableDevicePush = async (userId: string, platform: 'ios' | 'android') => {
  const deviceId = `${userId}_${platform}`

  try {
    await apiFetch('/api/devices', {
      method: 'PUT',
      json: {
        id: deviceId,
        platform,
        pushEnabled: false,
      },
    })
    return { success: true }
  } catch {
    return { success: false }
  }
}
