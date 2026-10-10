import '~/helpers/crypto/polyfill.native' // `better-auth/client/plugins` uses `@better-auth/utils` which requires `crypto` in globalThis

import { expoClient } from '@better-auth/expo/client'
import * as WebBrowser from 'expo-web-browser'

import { APP_SCHEME } from '../constants'
import { createExpoAuthStorage } from './expoAuthStorage'

// better-auth's expo plugin dynamically imports this; metro only includes it
// if something on the native auth path statically imports the module.
WebBrowser.maybeCompleteAuthSession()

export function platformClient() {
  return expoClient({
    scheme: APP_SCHEME,
    storagePrefix: APP_SCHEME,
    storage: createExpoAuthStorage(),
    webBrowserOptions: {
      // android chrome custom tabs default to a new task (looks like a new page
      // in recents). keep the session in this activity so it overlays the app.
      createTask: false,
      useProxyActivity: false,
      showInRecents: false,
      toolbarColor: '#0A0A0A',
    },
  })
}
