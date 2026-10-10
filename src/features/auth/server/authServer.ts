import { expo } from '@better-auth/expo'
import { time } from '@mtd/helpers'
import { betterAuth } from 'better-auth'
import { admin, bearer, emailOTP } from 'better-auth/plugins'

import { APP_NAME, DEMO_EMAIL, DEMO_OTP, DOMAIN } from '~/constants/app'
import { db } from '~/database/db'
import { ports, server } from '~/env'
import { isEmailConfigured, sendEmail } from '~/features/email/server/sendEmail'

import { APP_SCHEME } from '../constants'
import { afterCreateUser } from './afterCreateUser'
import { generateAppleClientSecret } from './appleClientSecret'
import { resolveSocialProviderCredentials } from './buildSocialProviders'
import { isDemoAuthAllowed } from './isDemoAuthAllowed'
import { storeOTP } from './lastOTP'

const socialCredentials = resolveSocialProviderCredentials({
  GOOGLE_CLIENT_ID: server.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: server.GOOGLE_CLIENT_SECRET,
  APPLE_CLIENT_ID: server.APPLE_CLIENT_ID,
  APPLE_TEAM_ID: server.APPLE_TEAM_ID,
  APPLE_KEY_ID: server.APPLE_KEY_ID,
  APPLE_PRIVATE_KEY: server.APPLE_PRIVATE_KEY,
})

const apple = socialCredentials.apple
const socialProviders = {
  ...(socialCredentials.google
    ? {
        google: {
          clientId: socialCredentials.google.clientId,
          clientSecret: socialCredentials.google.clientSecret,
        },
      }
    : {}),
  ...(apple
    ? {
        apple: async () => ({
          clientId: apple.clientId,
          clientSecret: await generateAppleClientSecret({
            clientId: apple.clientId,
            teamId: apple.teamId,
            keyId: apple.keyId,
            privateKey: apple.privateKey,
          }),
        }),
      }
    : {}),
}

// prod subdomains (apex/api/app) + the single-level staging api host
const productionOrigins = ['', 'api.', 'app.', 'staging-api.'].map(
  (prefix) => `https://${prefix}${DOMAIN}`,
)

const trustedOrigins = [
  // match dev, prod, tauri
  ...productionOrigins,
  `http://localhost:${ports.web}`,
  `http://host.docker.internal:${ports.web}`,
  `${APP_SCHEME}://`,
  // sootsim shell renders the app bundle from its own origin and the bundle's
  // location.origin is the shell, not the One server. trust it in dev so the
  // shell-proxied /api/auth calls aren't 403'd as INVALID_ORIGIN.
  'http://localhost:5173',
  'https://appleid.apple.com',
]

export const authServer = betterAuth({
  // vite SSR skips createEnv.apply(), so process.env.BETTER_AUTH_URL is unset
  baseURL: server.BETTER_AUTH_URL,

  database: db.pool,

  rateLimit: {
    enabled: process.env.NODE_ENV === 'production' && !process.env.IS_TESTING,
    window: 60,
    max: 30, // per minute per IP
    customRules: {
      // stricter limits on auth endpoints (better-auth paths)
      '/sign-in/email-otp': { window: 60, max: 5 },
      '/email-otp/send-verification-otp': { window: 60, max: 3 },
    },
  },

  // cloudflare IP header + cross-subdomain cookies across app/api subdomains
  advanced: {
    ...(server.BETTER_AUTH_URL.includes(DOMAIN) && {
      crossSubDomainCookies: {
        enabled: true,
        domain: `.${DOMAIN}`,
      },
    }),
    ipAddress: {
      ipAddressHeaders: ['cf-connecting-ip', 'x-forwarded-for'],
    },
  },

  session: {
    freshAge: time.minute.days(2),
    storeSessionInDatabase: true,
  },

  emailAndPassword: {
    enabled: false,
  },

  trustedOrigins,

  socialProviders,

  databaseHooks: {
    user: {
      create: {
        async after(user) {
          // how we nicely move private user => public user for zero:
          await afterCreateUser(user)
        },
      },
    },
  },

  plugins: [
    // optional JWT flows, useful for tauri, but not necessary as RN uses sessions
    // jwt({
    //   jwt: {
    //     expirationTime: '1d',
    //   },

    //   jwks: {
    //     // compat with zero
    //     keyPairConfig: { alg: 'EdDSA', crv: 'Ed25519' },
    //   },
    // }),

    bearer(),

    // To support better-auth/client in React Native
    expo(),

    // role column / schema only — HTTP /api/auth/admin/* is denied in apiHandler
    // (impersonation deferred; re-enable later with a real non-zero duration).
    admin({
      adminRoles: ['admin'],
      adminUserIds: [],
    }),

    emailOTP({
      generateOTP({ email }) {
        if (isDemoAuthAllowed() && email.toLowerCase() === DEMO_EMAIL.toLowerCase()) {
          return DEMO_OTP
        }
      },
      async sendVerificationOTP({ email, otp }) {
        if (process.env.NODE_ENV === 'production') {
          console.info(`OTP issued for ${email}`)
        } else {
          console.info(`\n${'='.repeat(60)}`)
          console.info(`📧 OTP CODE for ${email}: ${otp}`)
          console.info(`${'='.repeat(60)}\n`)
        }

        storeOTP(email, otp)

        // the demo code is fixed and known, so there is nothing to deliver
        if (isDemoAuthAllowed() && email.toLowerCase() === DEMO_EMAIL.toLowerCase())
          return

        if (!isEmailConfigured()) {
          if (process.env.NODE_ENV === 'production' && !process.env.IS_TESTING) {
            throw new Error('Email is not configured (set POSTMARK_SERVER_TOKEN)')
          }
          console.info('OTP email not sent: Postmark is not configured')
          return
        }

        try {
          await sendEmail({
            to: email,
            subject: `${APP_NAME} verification code`,
            textBody: [
              `Your ${APP_NAME} code is ${otp}.`,
              '',
              'This code expires soon. If you did not request it, you can ignore this email.',
            ].join('\n'),
          })
        } catch (error) {
          console.error('OTP email failed to send', error)
          throw error
        }
      },
    }),
  ],

  logger: {
    level: 'warn',
  },

  account: {
    // native google/apple callbacks run in ASWebAuthenticationSession, which
    // does not send the signed better-auth.state cookie. PKCE still binds the
    // code to this flow; the db verification record is still required.
    skipStateCookieCheck: true,
    accountLinking: {
      allowDifferentEmails: true,
    },
  },
})
