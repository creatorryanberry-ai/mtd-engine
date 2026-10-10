import packageJson from '../../package.json' with { type: 'json' }

// Brand
export const APP_NAME = 'Straight Up Tax'
export const APP_NAME_LOWERCASE = 'straightuptax'
export const APP_VERSION = packageJson.version

// Domain
export const DOMAIN = 'straightup.tax'

// Paths
export const HELP_REQUESTS_PATH = '/requests'
export const HELP_ROADMAP_PATH = '/roadmap'
export const TERMS_OF_SERVICE_PATH = '/terms-of-service'
export const PRIVACY_POLICY_PATH = '/privacy-policy'
export const EULA_PATH = '/eula'

// URLs (constructed from domains + paths)
export const HELP_REQUESTS_URL = `https://${DOMAIN}${HELP_REQUESTS_PATH}`
export const HELP_ROADMAP_URL = `https://${DOMAIN}${HELP_ROADMAP_PATH}`
export const TERMS_OF_SERVICE_URL = `https://${DOMAIN}${TERMS_OF_SERVICE_PATH}`
export const PRIVACY_POLICY_URL = `https://${DOMAIN}${PRIVACY_POLICY_PATH}`
export const EULA_URL = `https://${DOMAIN}${EULA_PATH}`

// Social (landing page)
export const TWITTER_URL = 'https://x.com/straightuptax'
export const GITHUB_URL = 'https://github.com/curator-org-uk/mtd'
export const DISCORD_INVITE_URL = ''

// Email
export const ADMIN_EMAIL = `admin@${DOMAIN}`

// Demo user (dev/CI only — blocked server-side in production)
export const DEMO_EMAIL = `demo@${DOMAIN}`
/** Fixed OTP when ALLOW_DEMO_AUTH=1 — never used in production. */
export const DEMO_OTP = '000000'
