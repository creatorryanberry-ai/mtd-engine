export type SocialEnv = {
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  APPLE_CLIENT_ID: string
  APPLE_TEAM_ID: string
  APPLE_KEY_ID: string
  APPLE_PRIVATE_KEY: string
}

export function isGoogleSocialConfigured(
  env: Pick<SocialEnv, 'GOOGLE_CLIENT_ID' | 'GOOGLE_CLIENT_SECRET'>,
) {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)
}

export function isAppleSocialConfigured(
  env: Pick<
    SocialEnv,
    'APPLE_CLIENT_ID' | 'APPLE_TEAM_ID' | 'APPLE_KEY_ID' | 'APPLE_PRIVATE_KEY'
  >,
) {
  return Boolean(
    env.APPLE_CLIENT_ID && env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY,
  )
}

export function resolveSocialProviderCredentials(env: SocialEnv) {
  const out: {
    google?: { clientId: string; clientSecret: string }
    apple?: {
      clientId: string
      teamId: string
      keyId: string
      privateKey: string
    }
  } = {}

  if (isGoogleSocialConfigured(env)) {
    out.google = {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    }
  }

  if (isAppleSocialConfigured(env)) {
    out.apple = {
      clientId: env.APPLE_CLIENT_ID,
      teamId: env.APPLE_TEAM_ID,
      keyId: env.APPLE_KEY_ID,
      privateKey: env.APPLE_PRIVATE_KEY,
    }
  }

  return out
}
