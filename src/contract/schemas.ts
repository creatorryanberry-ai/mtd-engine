import * as v from 'valibot'

export const errorResponseSchema = v.object({
  error: v.string(),
})

export const handshakeResponseSchema = v.object({
  status: v.picklist(['ok', 'deprecated', 'blocked']),
  apiContract: v.number(),
  minSupportedAppVersion: v.string(),
  currentAppVersion: v.string(),
})

export const userPublicSchema = v.object({
  id: v.string(),
  name: v.nullable(v.string()),
  username: v.nullable(v.string()),
  image: v.nullable(v.string()),
  joinedAt: v.string(),
})

export const userStateSchema = v.object({
  userId: v.string(),
  darkMode: v.boolean(),
  hasOnboarded: v.boolean(),
})

export const businessTypeSchema = v.picklist(['self-employed', 'landlord'])
export const vehicleClaimMethodSchema = v.picklist(['mileage', 'actual'])

export const businessSettingsSchema = v.object({
  userId: v.string(),
  businessName: v.nullable(v.string()),
  businessStartDate: v.nullable(v.string()),
  businessDescription: v.nullable(v.string()),
  businessType: v.nullable(businessTypeSchema),
  cisRegistered: v.nullable(v.boolean()),
  vehicleClaimMethod: v.nullable(vehicleClaimMethodSchema),
  updatedAt: v.string(),
})

export const mtdTransactionSchema = v.object({
  id: v.string(),
  userId: v.string(),
  externalTransactionId: v.string(),
  merchantName: v.string(),
  category: v.string(),
  hmrcCategory: v.string(),
  categorySource: v.string(),
  confidence: v.string(),
  reviewedAt: v.nullable(v.string()),
  amount: v.number(),
  date: v.string(),
  pending: v.boolean(),
  accountName: v.nullable(v.string()),
  createdAt: v.string(),
})

export const notificationSchema = v.object({
  id: v.string(),
  userId: v.string(),
  actorId: v.nullable(v.string()),
  type: v.string(),
  title: v.nullable(v.string()),
  body: v.nullable(v.string()),
  data: v.nullable(v.string()),
  read: v.boolean(),
  createdAt: v.string(),
})

export const deviceSchema = v.object({
  id: v.string(),
  userId: v.string(),
  name: v.nullable(v.string()),
  platform: v.string(),
  platformVersion: v.nullable(v.string()),
  appVersion: v.nullable(v.string()),
  pushToken: v.nullable(v.string()),
  pushEnabled: v.boolean(),
  lastActiveAt: v.nullable(v.string()),
  createdAt: v.string(),
  updatedAt: v.nullable(v.string()),
})

export const listResponseSchema = <
  T extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
>(
  item: T,
) =>
  v.object({
    items: v.array(item),
  })
