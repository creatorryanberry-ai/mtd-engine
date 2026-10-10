import * as v from 'valibot'

import { registerRoute } from '~/api/registry'

const authUserSchema = v.object({
  id: v.optional(v.string()),
  name: v.optional(v.string()),
  email: v.optional(v.string()),
  emailVerified: v.optional(v.boolean()),
  image: v.optional(v.nullable(v.string())),
  createdAt: v.optional(v.string()),
  updatedAt: v.optional(v.string()),
})

const authSessionSchema = v.object({
  id: v.optional(v.string()),
  userId: v.optional(v.string()),
  token: v.optional(v.string()),
  expiresAt: v.optional(v.string()),
  ipAddress: v.optional(v.nullable(v.string())),
  userAgent: v.optional(v.nullable(v.string())),
  createdAt: v.optional(v.string()),
  updatedAt: v.optional(v.string()),
})

const authSuccessSchema = v.object({
  token: v.optional(v.string()),
  user: v.optional(authUserSchema),
  session: v.optional(authSessionSchema),
})

registerRoute({
  method: 'POST',
  path: '/api/auth/email-otp/send-verification-otp',
  summary: 'Send email OTP for sign-in',
  description:
    'Sends a one-time code to the email address. Use type `sign-in` for the product login flow. New users are created on successful OTP verification (no separate sign-up endpoint). On local/staging the code is also logged by the api process when email delivery is not configured.',
  tags: ['auth'],
  security: 'public',
  input: v.object({
    email: v.string(),
    type: v.picklist(['sign-in', 'email-verification', 'forget-password']),
  }),
  output: v.object({
    success: v.boolean(),
  }),
  examples: {
    request: {
      email: 'user@example.com',
      type: 'sign-in',
    },
    response: { success: true },
  },
  errorResponses: [
    { status: 400, description: 'Invalid email or request' },
    { status: 403, description: 'Sign-in is not available in this environment' },
  ],
})

registerRoute({
  method: 'POST',
  path: '/api/auth/sign-in/email-otp',
  summary: 'Sign in with email OTP',
  description:
    'Verifies the email OTP and creates a Better Auth session. Use the returned token as a Bearer token for API calls; browser clients can use the session cookie. If the email is not registered yet, Better Auth creates the account as part of this call.',
  tags: ['auth'],
  security: 'public',
  input: v.object({
    email: v.string(),
    otp: v.string(),
  }),
  output: authSuccessSchema,
  examples: {
    request: {
      email: 'user@example.com',
      otp: '123456',
    },
  },
  errorResponses: [
    { status: 400, description: 'Invalid or expired OTP' },
    { status: 403, description: 'Sign-in is not available in this environment' },
  ],
})

registerRoute({
  method: 'POST',
  path: '/api/auth/sign-out',
  summary: 'Sign out',
  description:
    'Invalidates the current Better Auth session and clears its session cookie.',
  tags: ['auth'],
  output: v.object({}),
})

registerRoute({
  method: 'GET',
  path: '/api/auth/get-session',
  summary: 'Get the current session',
  description:
    'Returns the current Better Auth session and user, or null when anonymous.',
  tags: ['auth'],
  security: 'public',
  output: v.nullable(
    v.object({
      session: v.optional(authSessionSchema),
      user: v.optional(authUserSchema),
    }),
  ),
})

registerRoute({
  method: 'POST',
  path: '/api/auth/validateToken',
  summary: 'Validate a JWT',
  description:
    "Verifies a JWT against this API's JWKS endpoint (/api/auth/jwks). Does not validate Better Auth session tokens from OTP sign-in; use those as Bearer tokens on authenticated routes instead.",
  tags: ['auth'],
  security: 'public',
  input: v.object({
    token: v.string(),
  }),
  output: v.object({
    valid: v.boolean(),
  }),
})
