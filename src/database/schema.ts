import { privateTable } from '@mtd/database'
import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

import { sql } from 'drizzle-orm'
import type { InferSelectModel } from 'drizzle-orm'

const pgPrivateTable = privateTable(pgTable)

export type UserPrivate = InferSelectModel<typeof user>

export const user = pgPrivateTable('user', (t) => ({
  id: t.varchar('id').primaryKey(),
  username: t.varchar('username', { length: 200 }),
  name: t.varchar('name', { length: 200 }),
  email: t.varchar('email', { length: 200 }).notNull().unique(),
  normalizedEmail: t.varchar('normalizedEmail', { length: 200 }).unique(),
  updatedAt: t.timestamp('updatedAt', { mode: 'string' }).defaultNow(),
  emailVerified: t.boolean('emailVerified').default(false).notNull(),
  image: t.text('image'),
  createdAt: t.timestamp('createdAt', { mode: 'string' }).defaultNow(),
  role: t.varchar('role').default('user').notNull(),
  banned: t.boolean('banned').default(false).notNull(),
  banReason: t.varchar('banReason'),
  banExpires: t.bigint('banExpires', { mode: 'number' }),
}))

export const account = pgPrivateTable('account', (t) => ({
  id: t.text('id').primaryKey().notNull(),
  accountId: t.text('accountId').notNull(),
  providerId: t.text('providerId').notNull(),
  userId: t
    .text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: t.text('accessToken'),
  refreshToken: t.text('refreshToken'),
  idToken: t.text('idToken'),
  accessTokenExpiresAt: t.timestamp('accessTokenExpiresAt', { mode: 'string' }),
  refreshTokenExpiresAt: t.timestamp('refreshTokenExpiresAt', { mode: 'string' }),
  scope: t.text('scope'),
  password: t.text('password'),
  createdAt: t.timestamp('createdAt', { mode: 'string' }).notNull(),
  updatedAt: t.timestamp('updatedAt', { mode: 'string' }).notNull(),
}))

export const session = pgPrivateTable('session', (t) => ({
  id: t.text('id').primaryKey().notNull(),
  expiresAt: t.timestamp('expiresAt', { mode: 'string' }).notNull(),
  token: t.text('token').notNull(),
  createdAt: t.timestamp('createdAt', { mode: 'string' }).notNull(),
  updatedAt: t.timestamp('updatedAt', { mode: 'string' }).notNull(),
  ipAddress: t.text('ipAddress'),
  userAgent: t.text('userAgent'),
  userId: t
    .text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  impersonatedBy: t.varchar('impersonatedBy'),
}))

export const jwks = pgPrivateTable('jwks', (t) => ({
  id: t.text('id').primaryKey().notNull(),
  publicKey: t.text('publicKey').notNull(),
  privateKey: t.text('privateKey').notNull(),
  createdAt: t.timestamp('createdAt', { mode: 'string' }).notNull(),
}))

export const verification = pgPrivateTable('verification', (t) => ({
  id: t.text('id').primaryKey().notNull(),
  identifier: t.text('identifier').notNull(),
  value: t.text('value').notNull(),
  expiresAt: t.timestamp('expiresAt', { mode: 'string' }).notNull(),
  createdAt: t.timestamp('createdAt', { mode: 'string' }),
  updatedAt: t.timestamp('updatedAt', { mode: 'string' }),
}))

export const bankLinkItem = pgPrivateTable('bankLinkItem', (t) => ({
  id: t.text('id').primaryKey().notNull(),
  userId: t
    .text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  externalItemId: t.text('externalItemId').notNull().unique(),
  accessToken: t.text('accessToken').notNull(),
  institutionId: t.text('institutionId'),
  institutionName: t.text('institutionName'),
  transactionsCursor: t.text('transactionsCursor'),
  lastSyncedAt: t.timestamp('lastSyncedAt', { mode: 'string' }),
  createdAt: t.timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: t.timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
}))

export const bankAccount = pgPrivateTable(
  'bankAccount',
  (t) => ({
    id: t.text('id').primaryKey().notNull(),
    userId: t
      .text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    bankLinkItemId: t
      .text('bankLinkItemId')
      .notNull()
      .references(() => bankLinkItem.id, { onDelete: 'cascade' }),
    externalAccountId: t.text('externalAccountId').notNull(),
    institutionName: t.text('institutionName'),
    accountName: t.text('accountName'),
    sortCode: t.text('sortCode'),
    accountNumber: t.text('accountNumber'),
    accountType: t.text('accountType'),
    balance: t.real('balance'),
    currency: t.text('currency'),
    lastSyncedAt: t.timestamp('lastSyncedAt', { mode: 'string' }),
    syncError: t.text('syncError'),
    createdAt: t.timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: t.timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
  }),
  (table) => [
    index('bankAccount_userId_idx').on(table.userId),
    index('bankAccount_bankLinkItemId_idx').on(table.bankLinkItemId),
    uniqueIndex('bankAccount_user_external_account_idx').on(
      table.userId,
      table.externalAccountId,
    ),
  ],
)

// public tables (exposed via REST API)

export const userPublic = pgTable(
  'userPublic',
  {
    id: text('id').primaryKey(),
    name: text('name'),
    username: text('username'),
    image: text('image'),
    joinedAt: timestamp('joinedAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [index('userPublic_username_idx').on(table.username)],
)

export const userState = pgTable('userState', {
  userId: text('userId').primaryKey(),
  darkMode: boolean('darkMode').notNull().default(false),
  hasOnboarded: boolean('hasOnboarded').notNull().default(false),
})

export const businessSettings = pgPrivateTable('businessSettings', (t) => ({
  userId: t
    .text('userId')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  businessName: t.text('businessName'),
  businessStartDate: t.text('businessStartDate'),
  businessDescription: t.text('businessDescription'),
  businessType: t.text('businessType'),
  cisRegistered: t.boolean('cisRegistered'),
  vehicleClaimMethod: t.text('vehicleClaimMethod'),
  updatedAt: t.timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
}))

export const mtdTransaction = pgTable(
  'mtdTransaction',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    externalTransactionId: text('externalTransactionId').notNull(),
    merchantName: text('merchantName').notNull(),
    category: text('category').notNull().default('Uncategorised'),
    hmrcCategory: text('hmrcCategory').notNull().default('uncategorised'),
    categorySource: text('categorySource').notNull().default('uncategorised'),
    confidence: text('confidence').notNull().default('low'),
    reviewedAt: timestamp('reviewedAt', { mode: 'string' }),
    amount: real('amount').notNull(),
    date: text('date').notNull(),
    pending: boolean('pending').notNull().default(false),
    accountName: text('accountName'),
    attachmentUrl: text('attachmentUrl'),
    bankAccountId: text('bankAccountId').references(() => bankAccount.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('mtdTransaction_userId_idx').on(table.userId),
    index('mtdTransaction_bankAccountId_idx').on(table.bankAccountId),
    index('mtdTransaction_date_idx').on(table.date),
    index('mtdTransaction_review_idx').on(
      table.userId,
      table.confidence,
      table.reviewedAt,
    ),
    uniqueIndex('mtdTransaction_user_external_tx_idx').on(
      table.userId,
      table.externalTransactionId,
    ),
  ],
)

export const hmrcConnection = pgPrivateTable('hmrcConnection', (t) => ({
  id: t.text('id').primaryKey().notNull(),
  userId: t
    .text('userId')
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: 'cascade' }),
  nino: t.text('nino').notNull(),
  accessToken: t.text('accessToken').notNull(),
  refreshToken: t.text('refreshToken').notNull(),
  accessTokenExpiresAt: t.timestamp('accessTokenExpiresAt', { mode: 'string' }).notNull(),
  scope: t.text('scope'),
  businessId: t.text('businessId'),
  businessName: t.text('businessName'),
  connectedAt: t.timestamp('connectedAt', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: t.timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
}))

export const hmrcOAuthState = pgPrivateTable('hmrcOAuthState', (t) => ({
  id: t.text('id').primaryKey().notNull(),
  userId: t
    .text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  nino: t.text('nino').notNull(),
  codeVerifier: t.text('codeVerifier').notNull(),
  redirectUri: t.text('redirectUri').notNull(),
  returnTo: t.text('returnTo'),
  expiresAt: t.timestamp('expiresAt', { mode: 'string' }).notNull(),
  createdAt: t.timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
}))

export const mtdSubmission = pgTable(
  'mtdSubmission',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    quarterId: text('quarterId').notNull(),
    taxYearStart: text('taxYearStart').notNull(),
    periodEnd: text('periodEnd').notNull(),
    submittedAt: timestamp('submittedAt', { mode: 'string' }).notNull(),
    reference: text('reference').notNull(),
    incomeTotal: real('incomeTotal').notNull(),
    expenseTotal: real('expenseTotal').notNull(),
    taxableProfit: real('taxableProfit').notNull(),
    taxDue: real('taxDue').notNull(),
    payload: text('payload').notNull().default('[]'),
    source: text('source').notNull().default('mock'),
    hmrcPeriodId: text('hmrcPeriodId'),
  },
  (table) => [
    index('mtdSubmission_userId_idx').on(table.userId),
    uniqueIndex('mtdSubmission_user_quarter_tax_year_idx').on(
      table.userId,
      table.quarterId,
      table.taxYearStart,
    ),
  ],
)

export const mileageSeries = pgTable(
  'mileageSeries',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    fromLocation: text('fromLocation'),
    journeyDetails: text('journeyDetails').notNull(),
    milesPerJourney: real('milesPerJourney').notNull(),
    includesReturnJourney: boolean('includesReturnJourney').notNull().default(false),
    recurrenceType: text('recurrenceType').notNull(),
    selectedWeekdays: text('selectedWeekdays').notNull().default('[]'),
    startDate: text('startDate').notNull(),
    endDate: text('endDate').notNull(),
    excludedDates: text('excludedDates').notNull().default('[]'),
    deletedDates: text('deletedDates').notNull().default('[]'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [index('mileageSeries_userId_idx').on(table.userId)],
)

export const mileageEntry = pgTable(
  'mileageEntry',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    date: text('date').notNull(),
    journeyDetails: text('journeyDetails').notNull(),
    miles: real('miles').notNull(),
    seriesId: text('seriesId').references(() => mileageSeries.id, {
      onDelete: 'set null',
    }),
    seriesOverride: boolean('seriesOverride').notNull().default(false),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('mileageEntry_userId_idx').on(table.userId),
    index('mileageEntry_userId_date_idx').on(table.userId, table.date),
    index('mileageEntry_seriesId_idx').on(table.seriesId),
  ],
)

export const categorisationRule = pgTable(
  'categorisationRule',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    matchField: text('matchField').notNull().default('merchant'),
    matchType: text('matchType').notNull().default('contains'),
    matchValue: text('matchValue').notNull(),
    friendlyName: text('friendlyName'),
    hmrcCategory: text('hmrcCategory').notNull(),
    privateUsePercent: integer('privateUsePercent'),
    priority: real('priority').notNull().default(0),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('categorisationRule_userId_idx').on(table.userId),
    index('categorisationRule_priority_idx').on(table.userId, table.priority),
  ],
)

export const categorisationRuleBankAccount = pgTable(
  'categorisationRuleBankAccount',
  {
    ruleId: text('ruleId')
      .notNull()
      .references(() => categorisationRule.id, { onDelete: 'cascade' }),
    bankAccountId: text('bankAccountId').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.ruleId, table.bankAccountId] }),
    index('categorisationRuleBankAccount_bankAccountId_idx').on(table.bankAccountId),
  ],
)

export const device = pgTable(
  'device',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    name: text('name'),
    platform: text('platform').notNull(),
    platformVersion: text('platformVersion'),
    appVersion: text('appVersion'),
    pushToken: text('pushToken'),
    pushEnabled: boolean('pushEnabled').notNull().default(false),
    lastActiveAt: timestamp('lastActiveAt', { mode: 'string' }),
    createdAt: timestamp('createdAt', { mode: 'string' }).notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'string' }),
  },
  (table) => [
    index('device_userId_idx').on(table.userId),
    index('device_pushToken_idx').on(table.pushToken),
  ],
)

export const mtdSubmissionJob = pgTable(
  'mtdSubmissionJob',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    quarterId: text('quarterId').notNull(),
    taxYearStart: text('taxYearStart').notNull().default('2025-04-06'),
    status: text('status').notNull().default('pending'),
    error: text('error'),
    reference: text('reference'),
    submittedAt: timestamp('submittedAt', { mode: 'string' }),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('mtdSubmissionJob_userId_idx').on(table.userId),
    uniqueIndex('mtdSubmissionJob_user_quarter_tax_year_idx').on(
      table.userId,
      table.quarterId,
      table.taxYearStart,
    ),
  ],
)

export const notification = pgTable(
  'notification',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    actorId: text('actorId'),
    type: text('type').notNull(),
    title: text('title'),
    body: text('body'),
    data: text('data'),
    read: boolean('read').notNull().default(false),
    createdAt: timestamp('createdAt', { mode: 'string' }).notNull(),
  },
  (table) => [
    index('notification_userId_idx').on(table.userId),
    index('notification_userId_read_idx').on(table.userId, table.read),
    index('notification_userId_read_createdAt_idx').on(
      table.userId,
      table.read,
      table.createdAt,
    ),
    index('notification_actorId_idx').on(table.actorId),
    index('notification_createdAt_idx').on(table.createdAt),
  ],
)

export const inboundEmailAddress = pgTable(
  'inboundEmailAddress',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    token: text('token').notNull(),
    emailAddress: text('emailAddress').notNull(),
    isActive: boolean('isActive').notNull().default(true),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
    revokedAt: timestamp('revokedAt', { mode: 'string' }),
  },
  (table) => [
    uniqueIndex('inboundEmailAddress_token_idx').on(table.token),
    uniqueIndex('inboundEmailAddress_emailAddress_idx').on(table.emailAddress),
    index('inboundEmailAddress_userId_idx').on(table.userId),
    uniqueIndex('inboundEmailAddress_active_user_idx')
      .on(table.userId)
      .where(sql`${table.isActive} = true`),
  ],
)

export const inboundEmail = pgTable(
  'inboundEmail',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    inboundEmailAddressId: text('inboundEmailAddressId')
      .notNull()
      .references(() => inboundEmailAddress.id),
    provider: text('provider').notNull(),
    providerMessageId: text('providerMessageId').notNull(),
    fromAddress: text('fromAddress').notNull(),
    toAddress: text('toAddress').notNull(),
    subject: text('subject'),
    receivedAt: timestamp('receivedAt', { mode: 'string' }).notNull(),
    status: text('status').notNull(),
    errorMessage: text('errorMessage'),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('inboundEmail_userId_idx').on(table.userId),
    index('inboundEmail_inboundEmailAddressId_idx').on(table.inboundEmailAddressId),
    uniqueIndex('inboundEmail_provider_message_idx').on(
      table.provider,
      table.providerMessageId,
    ),
  ],
)

export const inboxDocument = pgTable(
  'inboxDocument',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    inboundEmailId: text('inboundEmailId').references(() => inboundEmail.id, {
      onDelete: 'set null',
    }),
    source: text('source').notNull(),
    originalFileName: text('originalFileName').notNull(),
    mimeType: text('mimeType').notNull(),
    fileSize: integer('fileSize').notNull(),
    storagePath: text('storagePath').notNull(),
    sha256Hash: text('sha256Hash').notNull(),
    status: text('status').notNull(),
    receivedAt: timestamp('receivedAt', { mode: 'string' }).notNull(),
    processedAt: timestamp('processedAt', { mode: 'string' }),
    mtdTransactionId: text('mtdTransactionId'),
    errorMessage: text('errorMessage'),
  },
  (table) => [
    index('inboxDocument_userId_idx').on(table.userId),
    index('inboxDocument_userId_status_idx').on(table.userId, table.status),
    index('inboxDocument_inboundEmailId_idx').on(table.inboundEmailId),
    index('inboxDocument_userId_hash_idx').on(table.userId, table.sha256Hash),
  ],
)

/** per-user merchant signals learned on OCR-backed saves */
export const merchantFingerprint = pgTable(
  'merchantFingerprint',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    signalType: text('signalType').notNull(),
    signalValue: text('signalValue').notNull(),
    canonicalName: text('canonicalName').notNull(),
    sourceSuggestedName: text('sourceSuggestedName'),
    /** receipt | invoice | cis | landlord — remembered process kind */
    processKind: text('processKind'),
    /** 1–99 when private use was selected on an expense save; null otherwise */
    privateUsePercent: integer('privateUsePercent'),
    hitCount: integer('hitCount').notNull().default(1),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('merchantFingerprint_userId_idx').on(table.userId),
    index('merchantFingerprint_user_signal_idx').on(
      table.userId,
      table.signalType,
      table.signalValue,
    ),
    uniqueIndex('merchantFingerprint_user_signal_unique').on(
      table.userId,
      table.signalType,
      table.signalValue,
    ),
  ],
)

export const taxEstimateProfile = pgTable(
  'taxEstimateProfile',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    taxYearStart: text('taxYearStart').notNull(),
    answersJson: text('answersJson').notNull().default('{}'),
    useProjection: boolean('useProjection').notNull().default(true),
    jurisdiction: text('jurisdiction').notNull().default('england'),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('taxEstimateProfile_userId_idx').on(table.userId),
    uniqueIndex('taxEstimateProfile_user_tax_year_idx').on(
      table.userId,
      table.taxYearStart,
    ),
  ],
)
