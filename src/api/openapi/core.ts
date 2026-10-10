import * as v from 'valibot'

import { registerRoute } from '~/api/registry'
import {
  businessSettingsSchema,
  businessTypeSchema,
  deviceSchema,
  errorResponseSchema,
  handshakeResponseSchema,
  listResponseSchema,
  mtdTransactionSchema,
  notificationSchema,
  userPublicSchema,
  userStateSchema,
  vehicleClaimMethodSchema,
} from '~/contract'

const unauthorizedErrorResponse = [
  { status: 401, description: 'Unauthorized', schema: errorResponseSchema },
]

registerRoute({
  method: 'GET',
  path: '/api/handshake',
  summary: 'App/API compatibility handshake',
  description:
    'Checks whether an app version is compatible with the current API contract. Supply the version with the x-app-version header or appVersion query parameter; when omitted, the current server app version is used.',
  tags: ['meta'],
  security: 'public',
  input: v.optional(
    v.object({
      appVersion: v.optional(v.string()),
    }),
  ),
  output: handshakeResponseSchema,
  examples: {
    response: {
      status: 'ok',
      apiContract: 1,
      minSupportedAppVersion: '0.0.0',
      currentAppVersion: '1.0.0',
    },
  },
})

registerRoute({
  method: 'GET',
  path: '/api/transactions',
  summary: 'List MTD transactions for the current user',
  description:
    'Returns MTD transactions owned by the authenticated user. Use limit to restrict the number of items returned.',
  tags: ['transactions'],
  security: 'bearer',
  input: v.object({
    limit: v.optional(v.string()),
  }),
  output: listResponseSchema(mtdTransactionSchema),
  examples: {
    response: {
      items: [
        {
          id: 'txn_01',
          userId: 'user_01',
          externalTransactionId: 'ext_txn_01',
          merchantName: 'Stationery Shop',
          category: 'Office supplies',
          hmrcCategory: 'office_costs',
          categorySource: 'manual',
          confidence: 'high',
          reviewedAt: '2026-07-29T09:30:00.000Z',
          amount: 24.5,
          date: '2026-07-28',
          pending: false,
          accountName: 'Business Current Account',
          createdAt: '2026-07-28T14:12:00.000Z',
        },
      ],
    },
  },
  errorResponses: unauthorizedErrorResponse,
})

const meOutputSchema = v.object({
  user: v.nullable(userPublicSchema),
  state: v.nullable(userStateSchema),
})

registerRoute({
  method: 'GET',
  path: '/api/users/me',
  summary: 'Get the current user profile',
  description:
    'Returns the public profile and application state for the authenticated user. Both values can be null when the corresponding records have not been created.',
  tags: ['users'],
  security: 'bearer',
  output: meOutputSchema,
  examples: {
    response: {
      user: {
        id: 'user_01',
        name: 'Alex Morgan',
        username: 'alexm',
        image: null,
        joinedAt: '2026-01-15T10:00:00.000Z',
      },
      state: {
        userId: 'user_01',
        darkMode: false,
        hasOnboarded: true,
      },
    },
  },
  errorResponses: unauthorizedErrorResponse,
})

registerRoute({
  method: 'PATCH',
  path: '/api/users/me',
  summary: 'Update the current user profile',
  description:
    'Updates the supplied public profile fields and onboarding state for the authenticated user. Omitted fields are left unchanged.',
  tags: ['users'],
  security: 'bearer',
  input: v.object({
    name: v.optional(v.string()),
    username: v.optional(v.string()),
    image: v.optional(v.nullable(v.string())),
    hasOnboarded: v.optional(v.boolean()),
  }),
  output: meOutputSchema,
  errorResponses: unauthorizedErrorResponse,
})

registerRoute({
  method: 'GET',
  path: '/api/users/username-available',
  summary: 'Check whether a username is available',
  description:
    'Checks whether a username is available to the authenticated user. A username already assigned to that same user is reported as available.',
  tags: ['users'],
  security: 'bearer',
  input: v.object({ username: v.string() }),
  output: v.object({ available: v.boolean() }),
  errorResponses: unauthorizedErrorResponse,
})

registerRoute({
  method: 'GET',
  path: '/api/users/business-settings',
  summary: 'Get business setup settings for the current user',
  description:
    'Returns the authenticated user’s business setup and vehicle claim settings. Unconfigured fields are returned as null.',
  tags: ['users'],
  security: 'bearer',
  output: businessSettingsSchema,
  examples: {
    response: {
      userId: 'user_01',
      businessName: 'Morgan Design',
      businessStartDate: '2025-04-06',
      businessDescription: 'Independent graphic design services',
      businessType: 'self-employed',
      cisRegistered: false,
      vehicleClaimMethod: 'mileage',
      updatedAt: '2026-07-29T10:00:00.000Z',
    },
  },
  errorResponses: unauthorizedErrorResponse,
})

registerRoute({
  method: 'PATCH',
  path: '/api/users/business-settings',
  summary: 'Update business setup settings for the current user',
  description:
    'Creates or replaces the authenticated user’s business setup settings. A successful update also marks onboarding as complete.',
  tags: ['users'],
  security: 'bearer',
  input: v.object({
    businessName: v.string(),
    businessStartDate: v.string(),
    businessDescription: v.string(),
    businessType: businessTypeSchema,
    cisRegistered: v.optional(v.nullable(v.boolean())),
    vehicleClaimMethod: vehicleClaimMethodSchema,
  }),
  output: businessSettingsSchema,
  errorResponses: unauthorizedErrorResponse,
})

registerRoute({
  method: 'GET',
  path: '/api/notifications',
  summary: 'List notifications for the current user',
  description:
    'Returns recent notifications owned by the authenticated user. Use pageSize to control the maximum number of items, which defaults to 50.',
  tags: ['notifications'],
  security: 'bearer',
  input: v.object({
    pageSize: v.optional(v.string()),
  }),
  output: listResponseSchema(notificationSchema),
  examples: {
    response: {
      items: [
        {
          id: 'notification_01',
          userId: 'user_01',
          actorId: null,
          type: 'submission',
          title: 'Submission queued',
          body: 'Your quarterly submission is being processed.',
          data: '{"jobId":"job_01"}',
          read: false,
          createdAt: '2026-07-29T11:00:00.000Z',
        },
      ],
    },
  },
  errorResponses: unauthorizedErrorResponse,
})

registerRoute({
  method: 'PATCH',
  path: '/api/notifications/{id}',
  summary: 'Update a notification',
  description:
    'Updates a notification owned by the authenticated user. The response item is null when no matching notification exists.',
  tags: ['notifications'],
  security: 'bearer',
  input: v.object({ read: v.optional(v.boolean()) }),
  output: v.object({ item: v.nullable(notificationSchema) }),
  errorResponses: unauthorizedErrorResponse,
})

registerRoute({
  method: 'PUT',
  path: '/api/devices',
  summary: 'Register or update a device',
  description:
    'Registers a device for the authenticated user or updates the existing device with the same id. Push configuration and client version metadata are stored for notifications and diagnostics.',
  tags: ['devices'],
  security: 'bearer',
  input: v.object({
    id: v.string(),
    name: v.optional(v.nullable(v.string())),
    platform: v.string(),
    platformVersion: v.optional(v.nullable(v.string())),
    appVersion: v.optional(v.nullable(v.string())),
    pushToken: v.optional(v.nullable(v.string())),
    pushEnabled: v.optional(v.boolean()),
  }),
  output: v.object({ item: deviceSchema }),
  examples: {
    response: {
      item: {
        id: 'device_01',
        userId: 'user_01',
        name: 'Alex’s iPhone',
        platform: 'ios',
        platformVersion: '26.0',
        appVersion: '1.0.0',
        pushToken: null,
        pushEnabled: false,
        lastActiveAt: '2026-07-29T12:00:00.000Z',
        createdAt: '2026-07-01T08:00:00.000Z',
        updatedAt: '2026-07-29T12:00:00.000Z',
      },
    },
  },
  errorResponses: unauthorizedErrorResponse,
})

registerRoute({
  method: 'POST',
  path: '/api/submissions/quarterly/jobs',
  summary: 'Enqueue a quarterly HMRC submission',
  description:
    'Queues an HMRC quarterly submission for the authenticated user and returns its background job id. quarterId is required by the handler, while taxYearStart defaults to the current tax year when omitted.',
  tags: ['submissions'],
  security: 'bearer',
  input: v.object({
    quarterId: v.string(),
    taxYearStart: v.optional(v.string()),
  }),
  output: v.object({
    jobId: v.string(),
    status: v.literal('pending'),
  }),
  examples: {
    response: {
      jobId: 'job_01',
      status: 'pending',
    },
  },
  errorResponses: unauthorizedErrorResponse,
})
