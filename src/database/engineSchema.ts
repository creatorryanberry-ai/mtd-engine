import { privateTable } from '@mtd/database'
import { sql } from 'drizzle-orm'
import { index, pgTable, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

import { user } from './schema'

/**
 * engine: autonomous sales & marketing operating system.
 * every table is scoped by workspaceId (multi-tenant) and protected by RLS
 * via membership (see migrations/*-enable-engine-rls.ts).
 * money is integer minor units + currency; never floats.
 */

const pgPrivateTable = privateTable(pgTable)

const ts = (name: string) => timestamp(name, { mode: 'string', withTimezone: true })
const createdAt = () => ts('createdAt').defaultNow().notNull()
const updatedAt = () => ts('updatedAt').defaultNow().notNull()

export const ENGINE_ROLES = ['owner', 'admin', 'marketer', 'approver', 'viewer'] as const
export type EngineRole = (typeof ENGINE_ROLES)[number]

export const ENGINE_AUTONOMY_LEVELS = [0, 1, 2, 3, 4] as const

export const ENGINE_EVIDENCE_GRADES = ['A', 'B', 'C'] as const

// --- tenancy -----------------------------------------------------------------

export const engineWorkspace = pgPrivateTable(
  'engineWorkspace',
  (t) => ({
    id: t.text('id').primaryKey(),
    name: t.text('name').notNull(),
    slug: t.text('slug').notNull(),
    currency: t.text('currency').notNull().default('GBP'),
    timezone: t.text('timezone').notNull().default('Europe/London'),
    dataRegion: t.text('dataRegion').notNull().default('uk'),
    /** monthly LLM spend cap in USD cents; gateway refuses calls past it */
    llmBudgetMonthlyCents: t.integer('llmBudgetMonthlyCents').notNull().default(5000),
    /** monthly media generation cap in USD cents */
    mediaBudgetMonthlyCents: t.integer('mediaBudgetMonthlyCents').notNull().default(5000),
    /** global kill switch: when true no autonomous action may run */
    killSwitch: t.boolean('killSwitch').notNull().default(false),
    /**
     * permanent workspace holdout: contacts whose hashBucket falls below
     * rate * 10000 are never touched by automated programmes, so the
     * workspace always knows its true lift. 0..0.5
     */
    globalHoldoutRate: t.real('globalHoldoutRate').notNull().default(0.05),
    createdBy: t
      .text('createdBy')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  }),
  (table) => [uniqueIndex('engineWorkspace_slug_idx').on(table.slug)],
)

export const engineMembership = pgPrivateTable(
  'engineMembership',
  (t) => ({
    id: t.text('id').primaryKey(),
    workspaceId: t
      .text('workspaceId')
      .notNull()
      .references(() => engineWorkspace.id, { onDelete: 'cascade' }),
    userId: t
      .text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: t.text('role').$type<EngineRole>().notNull().default('viewer'),
    invitedBy: t.text('invitedBy'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  }),
  (table) => [
    uniqueIndex('engineMembership_workspace_user_idx').on(
      table.workspaceId,
      table.userId,
    ),
    index('engineMembership_userId_idx').on(table.userId),
  ],
)

export const engineBrand = pgPrivateTable(
  'engineBrand',
  (t) => ({
    id: t.text('id').primaryKey(),
    workspaceId: t
      .text('workspaceId')
      .notNull()
      .references(() => engineWorkspace.id, { onDelete: 'cascade' }),
    name: t.text('name').notNull(),
    websiteUrl: t.text('websiteUrl'),
    industry: t.text('industry'),
    /** b2b | b2c | both — drives PECR corporate-subscriber handling */
    market: t.text('market').notNull().default('b2b'),
    isDefault: t.boolean('isDefault').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  }),
  (table) => [index('engineBrand_workspaceId_idx').on(table.workspaceId)],
)

export type BrandKitColors = { name: string; hex: string; role?: string }[]
export type BrandKitPersona = {
  id: string
  name: string
  summary: string
  painPoints: string[]
  goals: string[]
  /** 0..1 how well this persona predicted real outcomes; starts null */
  accuracy?: number | null
}

export const engineBrandKit = pgPrivateTable(
  'engineBrandKit',
  (t) => ({
    id: t.text('id').primaryKey(),
    workspaceId: t
      .text('workspaceId')
      .notNull()
      .references(() => engineWorkspace.id, { onDelete: 'cascade' }),
    brandId: t
      .text('brandId')
      .notNull()
      .references(() => engineBrand.id, { onDelete: 'cascade' }),
    version: t.integer('version').notNull().default(1),
    logoUrl: t.text('logoUrl'),
    colors: t.jsonb('colors').$type<BrandKitColors>().notNull().default([]),
    fonts: t
      .jsonb('fonts')
      .$type<{ heading?: string; body?: string }>()
      .notNull()
      .default({}),
    toneOfVoice: t.text('toneOfVoice'),
    bannedWords: t.jsonb('bannedWords').$type<string[]>().notNull().default([]),
    /** claims the brand is allowed to make, each with evidence */
    claims: t
      .jsonb('claims')
      .$type<{ claim: string; evidence: string; approved: boolean }[]>()
      .notNull()
      .default([]),
    proofPoints: t.jsonb('proofPoints').$type<string[]>().notNull().default([]),
    personas: t.jsonb('personas').$type<BrandKitPersona[]>().notNull().default([]),
    /** ai disclosure policy for generated content: none | subtle | explicit */
    aiDisclosure: t.text('aiDisclosure').notNull().default('subtle'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  }),
  (table) => [
    index('engineBrandKit_workspaceId_idx').on(table.workspaceId),
    uniqueIndex('engineBrandKit_brand_version_idx').on(table.brandId, table.version),
  ],
)

// --- sense: customers, revenue, identity ------------------------------------

export const engineCompany = pgPrivateTable(
  'engineCompany',
  (t) => ({
    id: t.text('id').primaryKey(),
    workspaceId: t
      .text('workspaceId')
      .notNull()
      .references(() => engineWorkspace.id, { onDelete: 'cascade' }),
    name: t.text('name').notNull(),
    domain: t.text('domain'),
    industry: t.text('industry'),
    sizeBand: t.text('sizeBand'),
    country: t.text('country'),
    /** corporate subscriber vs sole trader matters for PECR */
    legalForm: t.text('legalForm'),
    source: t.text('source'),
    externalIds: t
      .jsonb('externalIds')
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  }),
  (table) => [
    index('engineCompany_workspaceId_idx').on(table.workspaceId),
    index('engineCompany_domain_idx').on(table.workspaceId, table.domain),
  ],
)

export const engineContact = pgPrivateTable(
  'engineContact',
  (t) => ({
    id: t.text('id').primaryKey(),
    workspaceId: t
      .text('workspaceId')
      .notNull()
      .references(() => engineWorkspace.id, { onDelete: 'cascade' }),
    companyId: t.text('companyId').references(() => engineCompany.id, {
      onDelete: 'set null',
    }),
    email: t.text('email'),
    emailNormalized: t.text('emailNormalized'),
    phone: t.text('phone'),
    firstName: t.text('firstName'),
    lastName: t.text('lastName'),
    jobTitle: t.text('jobTitle'),
    country: t.text('country'),
    /** lead | mql | sql | opportunity | customer | churned */
    lifecycleStage: t.text('lifecycleStage').notNull().default('lead'),
    /** uplift class, written by the targeting engine in phase 6 */
    upliftClass: t.text('upliftClass'),
    upliftScore: t.real('upliftScore'),
    leadScore: t.real('leadScore'),
    /** stable hash bucket (0..9999) used for holdout assignment */
    hashBucket: t.integer('hashBucket').notNull().default(0),
    source: t.text('source'),
    externalIds: t
      .jsonb('externalIds')
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    attributes: t
      .jsonb('attributes')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    firstSeenAt: ts('firstSeenAt'),
    lastActivityAt: ts('lastActivityAt'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  }),
  (table) => [
    index('engineContact_workspaceId_idx').on(table.workspaceId),
    uniqueIndex('engineContact_workspace_email_idx')
      .on(table.workspaceId, table.emailNormalized)
      .where(sql`${table.emailNormalized} IS NOT NULL`),
    index('engineContact_companyId_idx').on(table.companyId),
    index('engineContact_lifecycle_idx').on(table.workspaceId, table.lifecycleStage),
  ],
)

/** identity resolution: every known identifier for a contact */
export const engineIdentity = pgPrivateTable(
  'engineIdentity',
  (t) => ({
    id: t.text('id').primaryKey(),
    workspaceId: t
      .text('workspaceId')
      .notNull()
      .references(() => engineWorkspace.id, { onDelete: 'cascade' }),
    contactId: t
      .text('contactId')
      .notNull()
      .references(() => engineContact.id, { onDelete: 'cascade' }),
    /** email | phone | cookie | click_id | crm_id | stripe_customer | device */
    kind: t.text('kind').notNull(),
    /** for click ids / crm ids: which provider (gclid, fbclid, hubspot, stripe) */
    provider: t.text('provider'),
    value: t.text('value').notNull(),
    confidence: t.real('confidence').notNull().default(1),
    createdAt: createdAt(),
  }),
  (table) => [
    uniqueIndex('engineIdentity_workspace_kind_provider_value_idx').on(
      table.workspaceId,
      table.kind,
      table.provider,
      table.value,
    ),
    index('engineIdentity_contactId_idx').on(table.contactId),
  ],
)

export const engineConsent = pgPrivateTable(
  'engineConsent',
  (t) => ({
    id: t.text('id').primaryKey(),
    workspaceId: t
      .text('workspaceId')
      .notNull()
      .references(() => engineWorkspace.id, { onDelete: 'cascade' }),
    contactId: t
      .text('contactId')
      .notNull()
      .references(() => engineContact.id, { onDelete: 'cascade' }),
    /** email | sms | whatsapp | phone | post | tracking */
    channel: t.text('channel').notNull(),
    /** granted | withdrawn | unknown | soft_optin | corporate_subscriber */
    status: t.text('status').notNull().default('unknown'),
    /** uk_gdpr | pecr | can_spam | platform */
    lawfulBasis: t.text('lawfulBasis'),
    source: t.text('source'),
    evidence: t.jsonb('evidence').$type<Record<string, unknown>>().notNull().default({}),
    recordedAt: ts('recordedAt').defaultNow().notNull(),
    expiresAt: ts('expiresAt'),
    createdAt: createdAt(),
  }),
  (table) => [
    uniqueIndex('engineConsent_contact_channel_idx').on(table.contactId, table.channel),
    index('engineConsent_workspaceId_idx').on(table.workspaceId),
  ],
)

export const engineSegment = pgPrivateTable(
  'engineSegment',
  (t) => ({
    id: t.text('id').primaryKey(),
    workspaceId: t
      .text('workspaceId')
      .notNull()
      .references(() => engineWorkspace.id, { onDelete: 'cascade' }),
    name: t.text('name').notNull(),
    description: t.text('description'),
    /** declarative filter evaluated server-side */
    definition: t
      .jsonb('definition')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    isDynamic: t.boolean('isDynamic').notNull().default(true),
    memberCount: t.integer('memberCount').notNull().default(0),
    lastEvaluatedAt: ts('lastEvaluatedAt'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  }),
  (table) => [index('engineSegment_workspaceId_idx').on(table.workspaceId)],
)

export const engineProduct = pgPrivateTable(
  'engineProduct',
  (t) => ({
    id: t.text('id').primaryKey(),
    workspaceId: t
      .text('workspaceId')
      .notNull()
      .references(() => engineWorkspace.id, { onDelete: 'cascade' }),
    brandId: t.text('brandId').references(() => engineBrand.id, { onDelete: 'set null' }),
    name: t.text('name').notNull(),
    sku: t.text('sku'),
    priceMinor: t.integer('priceMinor'),
    /** unit cost used to derive gross profit when a source has no margin */
    unitCostMinor: t.integer('unitCostMinor'),
    /** fallback margin 0..1 when unit cost unknown */
    grossMarginRate: t.real('grossMarginRate'),
    currency: t.text('currency').notNull().default('GBP'),
    source: t.text('source'),
    externalIds: t
      .jsonb('externalIds')
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    active: t.boolean('active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  }),
  (table) => [index('engineProduct_workspaceId_idx').on(table.workspaceId)],
)

export const engineDeal = pgPrivateTable(
  'engineDeal',
  (t) => ({
    id: t.text('id').primaryKey(),
    workspaceId: t
      .text('workspaceId')
      .notNull()
      .references(() => engineWorkspace.id, { onDelete: 'cascade' }),
    contactId: t.text('contactId').references(() => engineContact.id, {
      onDelete: 'set null',
    }),
    companyId: t.text('companyId').references(() => engineCompany.id, {
      onDelete: 'set null',
    }),
    name: t.text('name').notNull(),
    stage: t.text('stage').notNull(),
    /** open | won | lost */
    status: t.text('status').notNull().default('open'),
    amountMinor: t.integer('amountMinor'),
    currency: t.text('currency').notNull().default('GBP'),
    probability: t.real('probability'),
    source: t.text('source'),
    externalId: t.text('externalId'),
    ownerName: t.text('ownerName'),
    expectedCloseAt: ts('expectedCloseAt'),
    closedAt: ts('closedAt'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  }),
  (table) => [
    index('engineDeal_workspaceId_idx').on(table.workspaceId),
    uniqueIndex('engineDeal_workspace_source_external_idx')
      .on(table.workspaceId, table.source, table.externalId)
      .where(sql`${table.externalId} IS NOT NULL`),
    index('engineDeal_status_idx').on(table.workspaceId, table.status),
  ],
)

/** revenue truth: one row per order / invoice / closed-won, with gross profit */
export const engineOrder = pgPrivateTable(
  'engineOrder',
  (t) => ({
    id: t.text('id').primaryKey(),
    workspaceId: t
      .text('workspaceId')
      .notNull()
      .references(() => engineWorkspace.id, { onDelete: 'cascade' }),
    contactId: t.text('contactId').references(() => engineContact.id, {
      onDelete: 'set null',
    }),
    dealId: t.text('dealId').references(() => engineDeal.id, { onDelete: 'set null' }),
    /** stripe | shopify | crm | manual */
    source: t.text('source').notNull(),
    externalId: t.text('externalId').notNull(),
    /** paid | refunded | partially_refunded | pending | failed */
    status: t.text('status').notNull().default('paid'),
    currency: t.text('currency').notNull(),
    revenueMinor: t.integer('revenueMinor').notNull(),
    costMinor: t.integer('costMinor').notNull().default(0),
    feesMinor: t.integer('feesMinor').notNull().default(0),
    refundedMinor: t.integer('refundedMinor').notNull().default(0),
    /** revenue - cost - fees - refunded; recomputed on every write */
    grossProfitMinor: t.integer('grossProfitMinor').notNull(),
    isFirstOrder: t.boolean('isFirstOrder').notNull().default(false),
    lineItems: t
      .jsonb('lineItems')
      .$type<
        { productId?: string; name: string; quantity: number; amountMinor: number }[]
      >()
      .notNull()
      .default([]),
    occurredAt: ts('occurredAt').notNull(),
    raw: t.jsonb('raw').$type<Record<string, unknown>>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  }),
  (table) => [
    uniqueIndex('engineOrder_workspace_source_external_idx').on(
      table.workspaceId,
      table.source,
      table.externalId,
    ),
    index('engineOrder_workspace_occurred_idx').on(table.workspaceId, table.occurredAt),
    index('engineOrder_contactId_idx').on(table.contactId),
  ],
)

// --- deploy: channels, connections, campaigns, journeys -----------------------

/** a channel definition per workspace (meta, google_ads, email, linkedin_organic, ...) */
export const engineChannel = pgPrivateTable(
  'engineChannel',
  (t) => ({
    id: t.text('id').primaryKey(),
    workspaceId: t
      .text('workspaceId')
      .notNull()
      .references(() => engineWorkspace.id, { onDelete: 'cascade' }),
    /** connector key, e.g. meta_ads, google_ads, email, hubspot, stripe */
    key: t.text('key').notNull(),
    /** paid | owned | organic | sales | revenue | partner | offline */
    kind: t.text('kind').notNull(),
    displayName: t.text('displayName').notNull(),
    enabled: t.boolean('enabled').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  }),
  (table) => [
    uniqueIndex('engineChannel_workspace_key_idx').on(table.workspaceId, table.key),
  ],
)

/** an authorised connection to an external provider (tokens encrypted) */
export const engineConnection = pgPrivateTable(
  'engineConnection',
  (t) => ({
    id: t.text('id').primaryKey(),
    workspaceId: t
      .text('workspaceId')
      .notNull()
      .references(() => engineWorkspace.id, { onDelete: 'cascade' }),
    channelId: t.text('channelId').references(() => engineChannel.id, {
      onDelete: 'set null',
    }),
    /** provider key, e.g. stripe, hubspot, meta_ads, higgsfield */
    provider: t.text('provider').notNull(),
    /** external account / portal id for display and dedupe */
    externalAccountId: t.text('externalAccountId'),
    displayName: t.text('displayName'),
    /** pending | connected | error | disconnected */
    status: t.text('status').notNull().default('pending'),
    /** aes-256-gcm encrypted json credentials (oauth tokens, api keys) */
    credentialsEncrypted: t.text('credentialsEncrypted'),
    scopes: t.jsonb('scopes').$type<string[]>().notNull().default([]),
    tokenExpiresAt: ts('tokenExpiresAt'),
    /** provider-specific non-secret settings (webhook ids, cursors) */
    settings: t.jsonb('settings').$type<Record<string, unknown>>().notNull().default({}),
    lastSyncAt: ts('lastSyncAt'),
    lastSyncError: t.text('lastSyncError'),
    connectedBy: t.text('connectedBy'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  }),
  (table) => [
    index('engineConnection_workspaceId_idx').on(table.workspaceId),
    uniqueIndex('engineConnection_workspace_provider_account_idx')
      .on(table.workspaceId, table.provider, table.externalAccountId)
      .where(sql`${table.externalAccountId} IS NOT NULL`),
  ],
)

/** short-lived oauth state for connector authorisation flows */
export const engineOAuthState = pgPrivateTable(
  'engineOAuthState',
  (t) => ({
    id: t.text('id').primaryKey(),
    workspaceId: t
      .text('workspaceId')
      .notNull()
      .references(() => engineWorkspace.id, { onDelete: 'cascade' }),
    userId: t.text('userId').notNull(),
    provider: t.text('provider').notNull(),
    codeVerifier: t.text('codeVerifier'),
    redirectUri: t.text('redirectUri').notNull(),
    returnTo: t.text('returnTo'),
    expiresAt: ts('expiresAt').notNull(),
    createdAt: createdAt(),
  }),
  (table) => [index('engineOAuthState_workspaceId_idx').on(table.workspaceId)],
)

export const engineCampaign = pgPrivateTable(
  'engineCampaign',
  (t) => ({
    id: t.text('id').primaryKey(),
    workspaceId: t
      .text('workspaceId')
      .notNull()
      .references(() => engineWorkspace.id, { onDelete: 'cascade' }),
    brandId: t.text('brandId').references(() => engineBrand.id, { onDelete: 'set null' }),
    channelId: t.text('channelId').references(() => engineChannel.id, {
      onDelete: 'set null',
    }),
    hypothesisId: t.text('hypothesisId'),
    experimentId: t.text('experimentId'),
    name: t.text('name').notNull(),
    objective: t.text('objective').notNull().default('incremental_gross_profit'),
    /** draft | pending_approval | scheduled | live | paused | ended | killed */
    status: t.text('status').notNull().default('draft'),
    budgetDailyMinor: t.integer('budgetDailyMinor'),
    budgetTotalMinor: t.integer('budgetTotalMinor'),
    currency: t.text('currency').notNull().default('GBP'),
    /** 0..1 share of eligible audience held out from this campaign */
    holdoutRate: t.real('holdoutRate').notNull().default(0.1),
    /** level the campaign was launched under */
    autonomyLevel: t.integer('autonomyLevel').notNull().default(1),
    externalId: t.text('externalId'),
    targeting: t
      .jsonb('targeting')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    startsAt: ts('startsAt'),
    endsAt: ts('endsAt'),
    createdBy: t.text('createdBy').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  }),
  (table) => [
    index('engineCampaign_workspaceId_idx').on(table.workspaceId),
    index('engineCampaign_status_idx').on(table.workspaceId, table.status),
  ],
)

export const engineJourney = pgPrivateTable(
  'engineJourney',
  (t) => ({
    id: t.text('id').primaryKey(),
    workspaceId: t
      .text('workspaceId')
      .notNull()
      .references(() => engineWorkspace.id, { onDelete: 'cascade' }),
    campaignId: t.text('campaignId').references(() => engineCampaign.id, {
      onDelete: 'set null',
    }),
    name: t.text('name').notNull(),
    /** draft | live | paused | archived */
    status: t.text('status').notNull().default('draft'),
    /** event or segment entry rule */
    trigger: t.jsonb('trigger').$type<Record<string, unknown>>().notNull().default({}),
    holdoutRate: t.real('holdoutRate').notNull().default(0.1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  }),
  (table) => [index('engineJourney_workspaceId_idx').on(table.workspaceId)],
)

export const engineJourneyStep = pgPrivateTable(
  'engineJourneyStep',
  (t) => ({
    id: t.text('id').primaryKey(),
    workspaceId: t
      .text('workspaceId')
      .notNull()
      .references(() => engineWorkspace.id, { onDelete: 'cascade' }),
    journeyId: t
      .text('journeyId')
      .notNull()
      .references(() => engineJourney.id, { onDelete: 'cascade' }),
    /** trigger | wait | branch | channel | holdout | exit */
    kind: t.text('kind').notNull(),
    position: t.integer('position').notNull().default(0),
    parentStepId: t.text('parentStepId'),
    channelId: t.text('channelId'),
    assetVariantId: t.text('assetVariantId'),
    config: t.jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  }),
  (table) => [index('engineJourneyStep_journeyId_idx').on(table.journeyId)],
)

// --- create: assets ---------------------------------------------------------

export const engineAsset = pgPrivateTable(
  'engineAsset',
  (t) => ({
    id: t.text('id').primaryKey(),
    workspaceId: t
      .text('workspaceId')
      .notNull()
      .references(() => engineWorkspace.id, { onDelete: 'cascade' }),
    brandId: t.text('brandId').references(() => engineBrand.id, { onDelete: 'set null' }),
    campaignId: t.text('campaignId').references(() => engineCampaign.id, {
      onDelete: 'set null',
    }),
    hypothesisId: t.text('hypothesisId'),
    /** copy | image | video | audio | document | landing_page */
    kind: t.text('kind').notNull(),
    title: t.text('title').notNull(),
    /** the brief that produced the variants, including hypothesis under test */
    brief: t.jsonb('brief').$type<Record<string, unknown>>().notNull().default({}),
    /** draft | review | approved | rejected | retired */
    status: t.text('status').notNull().default('draft'),
    usageRights: t.text('usageRights'),
    expiresAt: ts('expiresAt'),
    createdBy: t.text('createdBy').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  }),
  (table) => [index('engineAsset_workspaceId_idx').on(table.workspaceId)],
)

export const engineAssetVariant = pgPrivateTable(
  'engineAssetVariant',
  (t) => ({
    id: t.text('id').primaryKey(),
    workspaceId: t
      .text('workspaceId')
      .notNull()
      .references(() => engineWorkspace.id, { onDelete: 'cascade' }),
    assetId: t
      .text('assetId')
      .notNull()
      .references(() => engineAsset.id, { onDelete: 'cascade' }),
    version: t.integer('version').notNull().default(1),
    /** provider + model that produced it, for cost/quality learning */
    provider: t.text('provider'),
    model: t.text('model'),
    providerJobId: t.text('providerJobId'),
    /** text content for copy; null for media */
    body: t.text('body'),
    /** storage ref (mtd-engine:<key>) for media */
    mediaRef: t.text('mediaRef'),
    mimeType: t.text('mimeType'),
    durationMs: t.integer('durationMs'),
    width: t.integer('width'),
    height: t.integer('height'),
    /** scores 0..1 from the auto-scorers */
    performanceScore: t.real('performanceScore'),
    brandScore: t.real('brandScore'),
    looksAiScore: t.real('looksAiScore'),
    claimsScore: t.real('claimsScore'),
    /** draft | review | approved | rejected | live | retired */
    status: t.text('status').notNull().default('draft'),
    approvedBy: t.text('approvedBy'),
    approvedAt: ts('approvedAt'),
    costCents: t.integer('costCents').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  }),
  (table) => [
    index('engineAssetVariant_assetId_idx').on(table.assetId),
    index('engineAssetVariant_workspaceId_idx').on(table.workspaceId),
  ],
)

/** tagged features so the system learns why an asset worked */
export const engineAssetFeature = pgPrivateTable(
  'engineAssetFeature',
  (t) => ({
    id: t.text('id').primaryKey(),
    workspaceId: t
      .text('workspaceId')
      .notNull()
      .references(() => engineWorkspace.id, { onDelete: 'cascade' }),
    variantId: t
      .text('variantId')
      .notNull()
      .references(() => engineAssetVariant.id, { onDelete: 'cascade' }),
    /** hook_type | format | length | aspect | colour | presenter | offer | emotion | cta | proof_type */
    feature: t.text('feature').notNull(),
    value: t.text('value').notNull(),
    confidence: t.real('confidence').notNull().default(1),
    /** user | model */
    source: t.text('source').notNull().default('model'),
    createdAt: createdAt(),
  }),
  (table) => [
    uniqueIndex('engineAssetFeature_variant_feature_idx').on(
      table.variantId,
      table.feature,
    ),
    index('engineAssetFeature_workspace_feature_idx').on(
      table.workspaceId,
      table.feature,
      table.value,
    ),
  ],
)

/** async generation job at a media/copy provider */
export const engineProviderJob = pgPrivateTable(
  'engineProviderJob',
  (t) => ({
    id: t.text('id').primaryKey(),
    workspaceId: t
      .text('workspaceId')
      .notNull()
      .references(() => engineWorkspace.id, { onDelete: 'cascade' }),
    assetId: t.text('assetId').references(() => engineAsset.id, { onDelete: 'set null' }),
    provider: t.text('provider').notNull(),
    model: t.text('model'),
    /** image | video | audio | copy */
    kind: t.text('kind').notNull(),
    externalJobId: t.text('externalJobId'),
    /** queued | running | succeeded | failed | cancelled */
    status: t.text('status').notNull().default('queued'),
    request: t.jsonb('request').$type<Record<string, unknown>>().notNull().default({}),
    result: t.jsonb('result').$type<Record<string, unknown>>(),
    error: t.text('error'),
    estimatedCostCents: t.integer('estimatedCostCents').notNull().default(0),
    actualCostCents: t.integer('actualCostCents'),
    startedAt: ts('startedAt'),
    finishedAt: ts('finishedAt'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  }),
  (table) => [
    index('engineProviderJob_workspaceId_idx').on(table.workspaceId),
    index('engineProviderJob_status_idx').on(table.workspaceId, table.status),
  ],
)

// --- measure: experiments, events, outcomes, metrics --------------------------

export const engineExperiment = pgPrivateTable(
  'engineExperiment',
  (t) => ({
    id: t.text('id').primaryKey(),
    workspaceId: t
      .text('workspaceId')
      .notNull()
      .references(() => engineWorkspace.id, { onDelete: 'cascade' }),
    hypothesisId: t.text('hypothesisId'),
    campaignId: t.text('campaignId').references(() => engineCampaign.id, {
      onDelete: 'set null',
    }),
    name: t.text('name').notNull(),
    /** ab | bandit | geo | switchback | holdout */
    kind: t.text('kind').notNull(),
    /** draft | running | paused | completed | aborted */
    status: t.text('status').notNull().default('draft'),
    /** primary outcome metric key: incremental_gross_profit | conversion_rate */
    successMetric: t.text('successMetric').notNull().default('incremental_gross_profit'),
    /** the channel this experiment measures; feeds attribution triangulation */
    channelKey: t.text('channelKey'),
    /** who is eligible: { lifecycleStages?: string[], requireConsentChannel?: string } */
    audience: t
      .jsonb('audience')
      .$type<{ lifecycleStages?: string[]; requireConsentChannel?: string }>()
      .notNull()
      .default({}),
    holdoutRate: t.real('holdoutRate').notNull().default(0.1),
    explorationFloor: t.real('explorationFloor').notNull().default(0.1),
    minSamplePerArm: t.integer('minSamplePerArm').notNull().default(200),
    /** sha-256 salt that makes assignment deterministic per contact */
    assignmentSalt: t.text('assignmentSalt').notNull(),
    startsAt: ts('startsAt'),
    endsAt: ts('endsAt'),
    result: t.jsonb('result').$type<Record<string, unknown>>(),
    createdBy: t.text('createdBy').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  }),
  (table) => [
    index('engineExperiment_workspaceId_idx').on(table.workspaceId),
    index('engineExperiment_status_idx').on(table.workspaceId, table.status),
  ],
)

export const engineExperimentArm = pgPrivateTable(
  'engineExperimentArm',
  (t) => ({
    id: t.text('id').primaryKey(),
    workspaceId: t
      .text('workspaceId')
      .notNull()
      .references(() => engineWorkspace.id, { onDelete: 'cascade' }),
    experimentId: t
      .text('experimentId')
      .notNull()
      .references(() => engineExperiment.id, { onDelete: 'cascade' }),
    name: t.text('name').notNull(),
    isControl: t.boolean('isControl').notNull().default(false),
    assetVariantId: t.text('assetVariantId'),
    /** current allocation weight 0..1 (bandit updates this) */
    weight: t.real('weight').notNull().default(0.5),
    exposures: t.integer('exposures').notNull().default(0),
    conversions: t.integer('conversions').notNull().default(0),
    grossProfitMinor: t
      .bigint('grossProfitMinor', { mode: 'number' })
      .notNull()
      .default(0),
    /** beta posterior for thompson sampling */
    alpha: t.real('alpha').notNull().default(1),
    beta: t.real('beta').notNull().default(1),
    config: t.jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  }),
  (table) => [index('engineExperimentArm_experimentId_idx').on(table.experimentId)],
)

/** holdout or arm per contact per experiment; the control group lives here */
export const engineAssignment = pgPrivateTable(
  'engineAssignment',
  (t) => ({
    id: t.text('id').primaryKey(),
    workspaceId: t
      .text('workspaceId')
      .notNull()
      .references(() => engineWorkspace.id, { onDelete: 'cascade' }),
    experimentId: t
      .text('experimentId')
      .notNull()
      .references(() => engineExperiment.id, { onDelete: 'cascade' }),
    contactId: t
      .text('contactId')
      .notNull()
      .references(() => engineContact.id, { onDelete: 'cascade' }),
    /** null means holdout */
    armId: t.text('armId').references(() => engineExperimentArm.id, {
      onDelete: 'set null',
    }),
    isHoldout: t.boolean('isHoldout').notNull().default(false),
    assignedAt: ts('assignedAt').defaultNow().notNull(),
    firstExposureAt: ts('firstExposureAt'),
  }),
  (table) => [
    uniqueIndex('engineAssignment_experiment_contact_idx').on(
      table.experimentId,
      table.contactId,
    ),
    index('engineAssignment_workspaceId_idx').on(table.workspaceId),
  ],
)

/** every touch: impression, click, open, reply, visit, form, call, meeting, purchase, refund */
export const engineEvent = pgPrivateTable(
  'engineEvent',
  (t) => ({
    id: t.text('id').primaryKey(),
    workspaceId: t
      .text('workspaceId')
      .notNull()
      .references(() => engineWorkspace.id, { onDelete: 'cascade' }),
    contactId: t.text('contactId'),
    /** anonymous id before identity resolution */
    anonymousId: t.text('anonymousId'),
    type: t.text('type').notNull(),
    channelKey: t.text('channelKey'),
    campaignId: t.text('campaignId'),
    assetVariantId: t.text('assetVariantId'),
    experimentId: t.text('experimentId'),
    armId: t.text('armId'),
    /** source system: web, email, meta_ads, hubspot, stripe, manual */
    source: t.text('source').notNull(),
    /** idempotency key from the source (message id, click id, webhook id) */
    sourceEventId: t.text('sourceEventId'),
    valueMinor: t.integer('valueMinor'),
    currency: t.text('currency'),
    properties: t
      .jsonb('properties')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    occurredAt: ts('occurredAt').notNull(),
    receivedAt: ts('receivedAt').defaultNow().notNull(),
  }),
  (table) => [
    index('engineEvent_workspace_occurred_idx').on(table.workspaceId, table.occurredAt),
    index('engineEvent_workspace_type_occurred_idx').on(
      table.workspaceId,
      table.type,
      table.occurredAt,
    ),
    index('engineEvent_contact_occurred_idx').on(table.contactId, table.occurredAt),
    uniqueIndex('engineEvent_source_event_idx')
      .on(table.workspaceId, table.source, table.sourceEventId)
      .where(sql`${table.sourceEventId} IS NOT NULL`),
  ],
)

/** a conversion credited (or not) to touches; the thing lift is measured on */
export const engineOutcome = pgPrivateTable(
  'engineOutcome',
  (t) => ({
    id: t.text('id').primaryKey(),
    workspaceId: t
      .text('workspaceId')
      .notNull()
      .references(() => engineWorkspace.id, { onDelete: 'cascade' }),
    contactId: t.text('contactId'),
    orderId: t.text('orderId').references(() => engineOrder.id, { onDelete: 'set null' }),
    dealId: t.text('dealId').references(() => engineDeal.id, { onDelete: 'set null' }),
    /** purchase | first_purchase | deal_won | meeting_booked | signup | lead */
    type: t.text('type').notNull(),
    grossProfitMinor: t.integer('grossProfitMinor').notNull().default(0),
    currency: t.text('currency').notNull().default('GBP'),
    experimentId: t.text('experimentId'),
    armId: t.text('armId'),
    isHoldout: t.boolean('isHoldout'),
    /** per-model credit shares: { platform: {...}, first_party: {...} } */
    attribution: t
      .jsonb('attribution')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    occurredAt: ts('occurredAt').notNull(),
    createdAt: createdAt(),
  }),
  (table) => [
    index('engineOutcome_workspace_occurred_idx').on(table.workspaceId, table.occurredAt),
    index('engineOutcome_experiment_idx').on(table.experimentId),
    index('engineOutcome_contact_occurred_idx').on(table.contactId, table.occurredAt),
    uniqueIndex('engineOutcome_order_type_idx')
      .on(table.orderId, table.type)
      .where(sql`${table.orderId} IS NOT NULL`),
  ],
)

/** daily rollups per workspace x channel x campaign x experiment arm */
export const engineMetricsDaily = pgPrivateTable(
  'engineMetricsDaily',
  (t) => ({
    id: t.text('id').primaryKey(),
    workspaceId: t
      .text('workspaceId')
      .notNull()
      .references(() => engineWorkspace.id, { onDelete: 'cascade' }),
    /** YYYY-MM-DD, utc (workspace timezones are a later phase) */
    day: t.text('day').notNull(),
    channelKey: t.text('channelKey').notNull().default('all'),
    campaignId: t.text('campaignId').notNull().default('all'),
    armId: t.text('armId').notNull().default('all'),
    spendMinor: t.integer('spendMinor').notNull().default(0),
    impressions: t.integer('impressions').notNull().default(0),
    clicks: t.integer('clicks').notNull().default(0),
    conversions: t.integer('conversions').notNull().default(0),
    newCustomers: t.integer('newCustomers').notNull().default(0),
    revenueMinor: t.integer('revenueMinor').notNull().default(0),
    grossProfitMinor: t.integer('grossProfitMinor').notNull().default(0),
    /** lift vs holdout, null until the experiment service computes it */
    incrementalGrossProfitMinor: t.integer('incrementalGrossProfitMinor'),
    unsubscribes: t.integer('unsubscribes').notNull().default(0),
    complaints: t.integer('complaints').notNull().default(0),
    /** what the ad platform claims; kept apart from first-party numbers, null when not reported */
    platformConversions: t.integer('platformConversions'),
    platformRevenueMinor: t.integer('platformRevenueMinor'),
    currency: t.text('currency').notNull().default('GBP'),
    computedAt: ts('computedAt').defaultNow().notNull(),
  }),
  (table) => [
    uniqueIndex('engineMetricsDaily_key_idx').on(
      table.workspaceId,
      table.day,
      table.channelKey,
      table.campaignId,
      table.armId,
    ),
  ],
)

// --- decide / learn -----------------------------------------------------------

export const engineHypothesis = pgPrivateTable(
  'engineHypothesis',
  (t) => ({
    id: t.text('id').primaryKey(),
    workspaceId: t
      .text('workspaceId')
      .notNull()
      .references(() => engineWorkspace.id, { onDelete: 'cascade' }),
    brandId: t.text('brandId'),
    statement: t.text('statement').notNull(),
    channelKey: t.text('channelKey'),
    segmentId: t.text('segmentId'),
    /** proposed | approved | testing | supported | refuted | retired */
    status: t.text('status').notNull().default('proposed'),
    expectedEffect: t.real('expectedEffect'),
    confidence: t.real('confidence'),
    /** expected value x confidence, used to order the backlog */
    priority: t.real('priority').notNull().default(0),
    testDesign: t
      .jsonb('testDesign')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    budgetMinor: t.integer('budgetMinor'),
    successMetric: t.text('successMetric').notNull().default('incremental_gross_profit'),
    /** strategist | user */
    proposedBy: t.text('proposedBy').notNull(),
    llmCallId: t.text('llmCallId'),
    approvedBy: t.text('approvedBy'),
    approvedAt: ts('approvedAt'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  }),
  (table) => [
    index('engineHypothesis_workspaceId_idx').on(table.workspaceId),
    index('engineHypothesis_status_priority_idx').on(
      table.workspaceId,
      table.status,
      table.priority,
    ),
  ],
)

/** the evolving memory; the AI may act alone only on grade A */
export const engineLearning = pgPrivateTable(
  'engineLearning',
  (t) => ({
    id: t.text('id').primaryKey(),
    workspaceId: t
      .text('workspaceId')
      .notNull()
      .references(() => engineWorkspace.id, { onDelete: 'cascade' }),
    statement: t.text('statement').notNull(),
    /** workspace | brand | channel | segment */
    scope: t.text('scope').notNull().default('workspace'),
    scopeId: t.text('scopeId'),
    effectSize: t.real('effectSize'),
    ciLow: t.real('ciLow'),
    ciHigh: t.real('ciHigh'),
    sampleSize: t.integer('sampleSize').notNull().default(0),
    /** ab | bandit | geo | holdout | synthetic | observational */
    testType: t.text('testType').notNull(),
    grade: t.text('grade').notNull().default('C'),
    /** days until confidence halves; retest when stale */
    halfLifeDays: t.integer('halfLifeDays').notNull().default(90),
    observedAt: ts('observedAt').defaultNow().notNull(),
    /** active | stale | retired | retesting */
    status: t.text('status').notNull().default('active'),
    retestHypothesisId: t.text('retestHypothesisId'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  }),
  (table) => [
    index('engineLearning_workspaceId_idx').on(table.workspaceId),
    index('engineLearning_grade_status_idx').on(
      table.workspaceId,
      table.grade,
      table.status,
    ),
  ],
)

/** links a learning to the experiments / assets / outcomes that back it */
export const engineLearningEvidence = pgPrivateTable(
  'engineLearningEvidence',
  (t) => ({
    id: t.text('id').primaryKey(),
    workspaceId: t
      .text('workspaceId')
      .notNull()
      .references(() => engineWorkspace.id, { onDelete: 'cascade' }),
    learningId: t
      .text('learningId')
      .notNull()
      .references(() => engineLearning.id, { onDelete: 'cascade' }),
    /** experiment | asset_variant | outcome | prediction | llm_call */
    entityType: t.text('entityType').notNull(),
    entityId: t.text('entityId').notNull(),
    effectSize: t.real('effectSize'),
    sampleSize: t.integer('sampleSize'),
    note: t.text('note'),
    createdAt: createdAt(),
  }),
  (table) => [index('engineLearningEvidence_learningId_idx').on(table.learningId)],
)

export const engineModelRegistry = pgPrivateTable(
  'engineModelRegistry',
  (t) => ({
    id: t.text('id').primaryKey(),
    workspaceId: t
      .text('workspaceId')
      .notNull()
      .references(() => engineWorkspace.id, { onDelete: 'cascade' }),
    /** creative_predictor | uplift | send_time | lead_score | mmm */
    kind: t.text('kind').notNull(),
    version: t.integer('version').notNull().default(1),
    /** challenger | champion | retired */
    status: t.text('status').notNull().default('challenger'),
    artifactRef: t.text('artifactRef'),
    metrics: t.jsonb('metrics').$type<Record<string, number>>().notNull().default({}),
    trainedAt: ts('trainedAt'),
    promotedAt: ts('promotedAt'),
    createdAt: createdAt(),
  }),
  (table) => [
    uniqueIndex('engineModelRegistry_kind_version_idx').on(
      table.workspaceId,
      table.kind,
      table.version,
    ),
  ],
)

/** forecast vs actual; error rates drive the autonomy ladder */
export const enginePrediction = pgPrivateTable(
  'enginePrediction',
  (t) => ({
    id: t.text('id').primaryKey(),
    workspaceId: t
      .text('workspaceId')
      .notNull()
      .references(() => engineWorkspace.id, { onDelete: 'cascade' }),
    channelKey: t.text('channelKey'),
    /** campaign | experiment | hypothesis | budget */
    entityType: t.text('entityType').notNull(),
    entityId: t.text('entityId').notNull(),
    metric: t.text('metric').notNull(),
    predicted: t.real('predicted').notNull(),
    predictedLow: t.real('predictedLow'),
    predictedHigh: t.real('predictedHigh'),
    actual: t.real('actual'),
    /** |actual - predicted| / max(|actual|, 1) once resolved */
    absoluteError: t.real('absoluteError'),
    modelId: t.text('modelId'),
    llmCallId: t.text('llmCallId'),
    horizonEndsAt: ts('horizonEndsAt').notNull(),
    resolvedAt: ts('resolvedAt'),
    createdAt: createdAt(),
  }),
  (table) => [
    index('enginePrediction_workspace_channel_idx').on(
      table.workspaceId,
      table.channelKey,
    ),
    index('enginePrediction_entity_idx').on(table.entityType, table.entityId),
  ],
)

// --- guard: autonomy, guardrails, approvals, audit, llm -----------------------

export const engineAutonomySettings = pgPrivateTable(
  'engineAutonomySettings',
  (t) => ({
    id: t.text('id').primaryKey(),
    workspaceId: t
      .text('workspaceId')
      .notNull()
      .references(() => engineWorkspace.id, { onDelete: 'cascade' }),
    channelKey: t.text('channelKey').notNull(),
    level: t.integer('level').notNull().default(0),
    maxLevel: t.integer('maxLevel').notNull().default(1),
    /** forecast error band for promotion, e.g. 0.2 = within 20% */
    errorBand: t.real('errorBand').notNull().default(0.2),
    promotionWeeks: t.integer('promotionWeeks').notNull().default(4),
    consecutiveWeeksInBand: t.integer('consecutiveWeeksInBand').notNull().default(0),
    /** outbound keeps mandatory review of first N messages per sequence */
    mandatoryReviewCount: t.integer('mandatoryReviewCount').notNull().default(0),
    channelKillSwitch: t.boolean('channelKillSwitch').notNull().default(false),
    lastPromotedAt: ts('lastPromotedAt'),
    lastDemotedAt: ts('lastDemotedAt'),
    lastDemotionReason: t.text('lastDemotionReason'),
    updatedAt: updatedAt(),
  }),
  (table) => [
    uniqueIndex('engineAutonomySettings_workspace_channel_idx').on(
      table.workspaceId,
      table.channelKey,
    ),
  ],
)

export const engineGuardrail = pgPrivateTable(
  'engineGuardrail',
  (t) => ({
    id: t.text('id').primaryKey(),
    workspaceId: t
      .text('workspaceId')
      .notNull()
      .references(() => engineWorkspace.id, { onDelete: 'cascade' }),
    /** spend_cap | cpa_anomaly | brand_rule | banned_claim | consent | send_volume | disclosure */
    kind: t.text('kind').notNull(),
    /** null = all channels */
    channelKey: t.text('channelKey'),
    campaignId: t.text('campaignId'),
    name: t.text('name').notNull(),
    config: t.jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
    /** block | pause | flag */
    action: t.text('action').notNull().default('block'),
    enabled: t.boolean('enabled').notNull().default(true),
    breachCount: t.integer('breachCount').notNull().default(0),
    lastBreachAt: ts('lastBreachAt'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  }),
  (table) => [index('engineGuardrail_workspaceId_idx').on(table.workspaceId)],
)

export const engineApproval = pgPrivateTable(
  'engineApproval',
  (t) => ({
    id: t.text('id').primaryKey(),
    workspaceId: t
      .text('workspaceId')
      .notNull()
      .references(() => engineWorkspace.id, { onDelete: 'cascade' }),
    /** campaign | asset_variant | hypothesis | budget_change | connection | sequence_message */
    entityType: t.text('entityType').notNull(),
    entityId: t.text('entityId').notNull(),
    /** pending | approved | rejected | expired */
    status: t.text('status').notNull().default('pending'),
    requestedBy: t.text('requestedBy').notNull(),
    reason: t.text('reason'),
    /** the why: data, learning and rule behind the request */
    explanation: t
      .jsonb('explanation')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    decidedBy: t.text('decidedBy'),
    decisionNote: t.text('decisionNote'),
    decidedAt: ts('decidedAt'),
    expiresAt: ts('expiresAt'),
    createdAt: createdAt(),
  }),
  (table) => [
    index('engineApproval_workspace_status_idx').on(table.workspaceId, table.status),
    index('engineApproval_entity_idx').on(table.entityType, table.entityId),
  ],
)

/** append-only: every autonomous or privileged action with its reasoning */
export const engineAuditLog = pgPrivateTable(
  'engineAuditLog',
  (t) => ({
    id: t.text('id').primaryKey(),
    workspaceId: t
      .text('workspaceId')
      .notNull()
      .references(() => engineWorkspace.id, { onDelete: 'cascade' }),
    /** user:<id> | system:<agent> | connector:<provider> */
    actor: t.text('actor').notNull(),
    action: t.text('action').notNull(),
    entityType: t.text('entityType'),
    entityId: t.text('entityId'),
    before: t.jsonb('before').$type<Record<string, unknown>>(),
    after: t.jsonb('after').$type<Record<string, unknown>>(),
    reasoning: t.text('reasoning'),
    /** ids of learnings / rules / llm calls that justified the action */
    evidence: t.jsonb('evidence').$type<Record<string, unknown>>().notNull().default({}),
    autonomyLevel: t.integer('autonomyLevel'),
    ipAddress: t.text('ipAddress'),
    createdAt: createdAt(),
  }),
  (table) => [
    index('engineAuditLog_workspace_created_idx').on(table.workspaceId, table.createdAt),
    index('engineAuditLog_entity_idx').on(table.entityType, table.entityId),
  ],
)

/** every call through the llm gateway */
export const engineLlmCall = pgPrivateTable(
  'engineLlmCall',
  (t) => ({
    id: t.text('id').primaryKey(),
    workspaceId: t.text('workspaceId').references(() => engineWorkspace.id, {
      onDelete: 'set null',
    }),
    /** strategist | copywriter | tagger | reflector | copilot | test */
    agent: t.text('agent').notNull(),
    /** strategy | fast */
    tier: t.text('tier').notNull(),
    model: t.text('model').notNull(),
    purpose: t.text('purpose'),
    system: t.text('system'),
    messages: t.jsonb('messages').$type<unknown[]>().notNull().default([]),
    tools: t.jsonb('tools').$type<unknown[]>(),
    output: t.jsonb('output').$type<unknown>(),
    stopReason: t.text('stopReason'),
    inputTokens: t.integer('inputTokens').notNull().default(0),
    outputTokens: t.integer('outputTokens').notNull().default(0),
    cacheReadTokens: t.integer('cacheReadTokens').notNull().default(0),
    cacheWriteTokens: t.integer('cacheWriteTokens').notNull().default(0),
    /** usd micro-cents (1e-6 usd) for precision on tiny calls */
    costMicros: t.bigint('costMicros', { mode: 'number' }).notNull().default(0),
    latencyMs: t.integer('latencyMs').notNull().default(0),
    error: t.text('error'),
    actor: t.text('actor'),
    createdAt: createdAt(),
  }),
  (table) => [
    index('engineLlmCall_workspace_created_idx').on(table.workspaceId, table.createdAt),
    index('engineLlmCall_agent_idx').on(table.agent),
  ],
)

export type EngineWorkspace = typeof engineWorkspace.$inferSelect
export type EngineMembership = typeof engineMembership.$inferSelect
export type EngineBrand = typeof engineBrand.$inferSelect
export type EngineBrandKit = typeof engineBrandKit.$inferSelect
export type EngineContact = typeof engineContact.$inferSelect
export type EngineCompany = typeof engineCompany.$inferSelect
export type EngineDeal = typeof engineDeal.$inferSelect
export type EngineOrder = typeof engineOrder.$inferSelect
export type EngineConnection = typeof engineConnection.$inferSelect
export type EngineEvent = typeof engineEvent.$inferSelect
export type EngineAuditLog = typeof engineAuditLog.$inferSelect
export type EngineLlmCall = typeof engineLlmCall.$inferSelect
