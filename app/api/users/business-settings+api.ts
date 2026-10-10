import * as v from 'valibot'

import { defineRoute } from '~/api/defineRoute'
import { notifyUser } from '~/api/notify'
import { requireApiAuth } from '~/api/requireAuth'
import {
  businessSettingsSchema,
  businessTypeSchema,
  vehicleClaimMethodSchema,
} from '~/contract'
import {
  getBusinessSettings,
  upsertBusinessSettings,
} from '~/features/api/server/businessSettings'
import { updateUserState } from '~/features/api/server/users'

import type { Endpoint } from 'one'

const emptyBusinessSettings = (userId: string) => ({
  userId,
  businessName: null,
  businessStartDate: null,
  businessDescription: null,
  businessType: null,
  cisRegistered: null,
  vehicleClaimMethod: null,
  updatedAt: new Date().toISOString(),
})

export const GET: Endpoint = defineRoute({
  method: 'GET',
  path: '/api/users/business-settings',
  summary: 'Get business setup settings for the current user',
  tags: ['users'],
  output: businessSettingsSchema,
  handler: async (_input, { request }) => {
    const auth = await requireApiAuth(request)
    const settings = await getBusinessSettings(auth.id)
    return settings ?? emptyBusinessSettings(auth.id)
  },
})

const patchSchema = v.object({
  businessName: v.string(),
  businessStartDate: v.string(),
  businessDescription: v.string(),
  businessType: businessTypeSchema,
  cisRegistered: v.optional(v.nullable(v.boolean())),
  vehicleClaimMethod: vehicleClaimMethodSchema,
})

export const PATCH: Endpoint = defineRoute({
  method: 'PATCH',
  path: '/api/users/business-settings',
  summary: 'Update business setup settings for the current user',
  tags: ['users'],
  input: patchSchema,
  output: businessSettingsSchema,
  handler: async (input, { request }) => {
    const auth = await requireApiAuth(request)
    const settings = await upsertBusinessSettings(auth.id, input)
    await updateUserState(auth.id, { hasOnboarded: true })
    await notifyUser(auth.id, { entity: 'userState' })
    return settings
  },
})
