import { IS_ANDROID } from '~/constants/platform'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'

type PushNotificationsRegistrationResult =
  | {
      success: true
      platform: 'ios' | 'android'
      pushToken: string // APNs / FCM device token
      permissionStatus: Notifications.PermissionStatus
    }
  | {
      success: false
      error: 'unsupported-device' | 'permission-denied' | 'unknown'
      permissionStatus: Notifications.PermissionStatus
      errorMessage?: string
    }

export const registerForPushNotificationsAsync =
  async (): Promise<PushNotificationsRegistrationResult> => {
    // android requires notification channel
    if (IS_ANDROID) {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      })
    }

    // check if running on physical device
    if (!Device.isDevice) {
      return {
        success: false,
        permissionStatus: Notifications.PermissionStatus.UNDETERMINED,
        error: 'unsupported-device',
        errorMessage: 'Push notifications require a physical device.',
      }
    }

    // request permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus

    if (existingStatus !== Notifications.PermissionStatus.GRANTED) {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }

    if (finalStatus !== Notifications.PermissionStatus.GRANTED) {
      return {
        success: false,
        error: 'permission-denied',
        permissionStatus: finalStatus,
      }
    }

    try {
      const nativeTokenData = await Notifications.getDevicePushTokenAsync()

      return {
        success: true,
        platform: IS_ANDROID ? 'android' : 'ios',
        pushToken: nativeTokenData.data,
        permissionStatus: finalStatus,
      }
    } catch (error) {
      return {
        success: false,
        error: 'unknown',
        permissionStatus: finalStatus,
        errorMessage: error instanceof Error ? error.message : String(error),
      }
    }
  }
