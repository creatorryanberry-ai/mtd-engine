import type { ExpoConfig } from 'expo/config'

import packageJson from './package.json' with { type: 'json' }

const appName = 'Straight Up Tax'
// URL scheme must be alphanumeric / . - + only (no spaces) — ITMS-90158
const appId = 'straightuptax'

const { APP_VARIANT } = process.env

if (APP_VARIANT !== 'production' && APP_VARIANT !== 'preview') {
  throw new Error(
    `APP_VARIANT must be preview or production (got ${APP_VARIANT ? `'${APP_VARIANT}'` : 'unset'}). Native builds use tax.straightup.preview or tax.straightup.app — there is no .dev identity. Example: APP_VARIANT=preview bun ios`,
  )
}

const getBundleId = () => {
  if (APP_VARIANT === 'preview') {
    return 'tax.straightup.preview'
  }
  return 'tax.straightup.app'
}

const getAppIcon = () => {
  return './assets/icon.png'
}

const version = packageJson.version

// stores silently drop uploads that reuse a build number. scripts/release
// queries each store for its latest and injects latest+1 per platform
// (independent sequences); dev builds default to 1.
const iosBuildNumber = process.env.IOS_BUILD_NUMBER || '1'
const androidVersionCode = Number(process.env.ANDROID_VERSION_CODE || '1')

export default {
  expo: {
    name: `${appName}${(() => {
      switch (APP_VARIANT) {
        case 'preview':
          return ' (Preview)'
        case 'production':
          return ''
      }
    })()}`,
    slug: 'straightuptax',
    scheme: appId,
    version,
    runtimeVersion: version, // must be set to use hot-updater "appVersion" update strategy
    platforms: ['ios', 'android', 'web'],
    userInterfaceStyle: 'automatic',
    icon: getAppIcon(),
    ios: {
      supportsTablet: true,
      buildNumber: iosBuildNumber,
      bundleIdentifier: getBundleId(),
      icon: getAppIcon(),
      config: {
        usesNonExemptEncryption: false,
      },
      infoPlist: {
        NSCameraUsageDescription:
          '$(PRODUCT_NAME) uses the camera to take profile photos and scan receipts for expense entry.',
        NSMicrophoneUsageDescription: 'Allow $(PRODUCT_NAME) to access your microphone',
        NSPhotoLibraryUsageDescription:
          '$(PRODUCT_NAME) accesses your photo library to let you select profile pictures and receipt photos for expense entry.',
        NSPhotoLibraryAddUsageDescription:
          '$(PRODUCT_NAME) saves photos to your photo library so you can keep and share them.',
        NSAppleMusicUsageDescription:
          'Allow $(PRODUCT_NAME) to access your music library',
        UIBackgroundModes: ['fetch', 'remote-notification'],
      },
    },
    android: {
      package: getBundleId().replaceAll('-', '_'),
      versionCode: androidVersionCode,
      icon: getAppIcon(),
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0A0A0A',
      },
      permissions: ['android.permission.RECORD_AUDIO'],
    },
    primaryColor: '#0A0A0A',
    plugins: [
      'vxrn/expo-plugin',
      '@mtd/cli/withFmtXcode26Fix',
      'expo-web-browser',
      'expo-font',
      'expo-document-picker',
      'react-native-bottom-tabs',
      [
        'expo-mlkit-ocr',
        {
          iosEngine: 'auto',
        },
      ],
      '@mtd/cli/withMlkitPodfileSanitize',
      [
        'expo-build-properties',
        {
          ios: {
            deploymentTarget: '17.0',
          },
        },
      ],
      [
        'react-native-permissions',
        {
          // Add setup_permissions to your Podfile (see iOS setup - steps 1, 2 and 3)
          iosPermissions: [
            // 'AppTrackingTransparency',
            // 'Bluetooth',
            // 'Calendars',
            // 'CalendarsWriteOnly',
            'Camera',
            // 'Contacts',
            'FaceID',
            // 'LocationAccuracy',
            // 'LocationAlways',
            // 'LocationWhenInUse',
            'MediaLibrary',
            'Microphone',
            // 'Motion',
            'Notifications',
            'PhotoLibrary',
            // 'PhotoLibraryAddOnly',
            // 'Reminders',
            // 'Siri',
            // 'SpeechRecognition',
            // 'StoreKit',
          ],
        },
      ],
      // Custom fonts
      // [
      //   'expo-font',
      //   {
      //     fonts: [
      //       './assets/fonts/Inter-Black.ttf',
      //       './assets/fonts/Inter-Bold.ttf',
      //       './assets/fonts/Inter-Light.ttf',
      //       './assets/fonts/Inter-Medium.ttf',
      //       './assets/fonts/Inter-Regular.ttf',
      //       './assets/fonts/Inter-SemiBold.ttf',
      //     ],
      //   },
      // ],
      [
        'expo-splash-screen',
        {
          // android 12+ Theme.SplashScreen requires windowSplashScreenAnimatedIcon
          // (@drawable/splashscreen_logo). without `image`, prebuild skips the
          // drawable and release builds fail linking. react splash still owns the zoom.
          backgroundColor: '#0A0A0A',
          image: './assets/splash-logo-square.png',
          imageWidth: 200,
        },
      ],
      // prebuild enables the App Groups capability but does not assign the group.
      // apple developer portal → each App ID (app + Live Activity) → App Groups
      // → select group.<bundleId>, then rebuild
      [
        'voltra',
        {
          groupIdentifier: `group.${getBundleId()}`,
          widgets: [
            {
              id: 'create_post',
              displayName: 'Create Post',
              description: 'Quickly create a new post',
              supportedFamilies: ['systemSmall'],
            },
          ],
        },
      ],
      // enable hot-updater here
      // [
      //   '@hot-updater/react-native',
      //   {
      //     channel: APP_VARIANT,
      //   },
      // ],
    ],
  } satisfies ExpoConfig,
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
}
