import './root.css'

import { LoadProgressBar, Slot } from 'one'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { SiteRootLayout } from '~/features/site/ui/SiteRootLayout'
import { HomeBackground } from '~/interface/landing/HomeBackground'
import { PlatformSpecificRootProvider } from '~/interface/platform/PlatformSpecificRootProvider'
import { GlobalTooltipProvider } from '~/interface/tooltip/Tooltip'
import { TamaguiRootProvider } from '~/tamagui/TamaguiRootProvider'

/**
 * web root layout — marketing site, help, legal, and the web app shell.
 * native uses `_layout.native.tsx` (app routes only).
 */
export function Layout() {
  // One lets you use html like this only in your root layout, and strips
  // it out on native. kept here for the web tree only.
  return (
    <html lang="en-US">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta property="twitter:card" content="summary_large_image" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=5.0"
        />
        <link rel="icon" href="/favicon.png" />
      </head>

      <body>
        <div style={{ display: 'contents' }} data-testid="app-container">
          <PlatformSpecificRootProvider>
            <TamaguiRootProvider>
              <GlobalTooltipProvider>
                <SafeAreaProvider>
                  <LoadProgressBar startDelay={800} />
                  <HomeBackground />
                  <SiteRootLayout>
                    <Slot />
                  </SiteRootLayout>
                </SafeAreaProvider>
              </GlobalTooltipProvider>
            </TamaguiRootProvider>
          </PlatformSpecificRootProvider>
        </div>
      </body>
    </html>
  )
}
