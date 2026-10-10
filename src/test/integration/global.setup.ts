import { test as setup } from '@playwright/test'

import { loginAsDemo } from './helpers'

// This setup is currently commented out in playwright.config.ts
// To enable: Uncomment the 'setup' project and 'chromium-with-auth' project in playwright.config.ts
// Then auth tests will run with demo pre-logged in

setup('setup', async ({ page }) => {
  await loginAsDemo(page)
  console.info('✅ Global setup complete')
})
