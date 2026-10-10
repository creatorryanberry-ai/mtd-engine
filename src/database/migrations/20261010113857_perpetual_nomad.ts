import type { PoolClient } from 'pg'

const sql = `CREATE TABLE "engineApproval" (
	"id" text PRIMARY KEY,
	"workspaceId" text NOT NULL,
	"entityType" text NOT NULL,
	"entityId" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"requestedBy" text NOT NULL,
	"reason" text,
	"explanation" jsonb DEFAULT '{}' NOT NULL,
	"decidedBy" text,
	"decisionNote" text,
	"decidedAt" timestamp with time zone,
	"expiresAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineAsset" (
	"id" text PRIMARY KEY,
	"workspaceId" text NOT NULL,
	"brandId" text,
	"campaignId" text,
	"hypothesisId" text,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"brief" jsonb DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"usageRights" text,
	"expiresAt" timestamp with time zone,
	"createdBy" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineAssetFeature" (
	"id" text PRIMARY KEY,
	"workspaceId" text NOT NULL,
	"variantId" text NOT NULL,
	"feature" text NOT NULL,
	"value" text NOT NULL,
	"confidence" real DEFAULT 1 NOT NULL,
	"source" text DEFAULT 'model' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineAssetVariant" (
	"id" text PRIMARY KEY,
	"workspaceId" text NOT NULL,
	"assetId" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"provider" text,
	"model" text,
	"providerJobId" text,
	"body" text,
	"mediaRef" text,
	"mimeType" text,
	"durationMs" integer,
	"width" integer,
	"height" integer,
	"performanceScore" real,
	"brandScore" real,
	"looksAiScore" real,
	"claimsScore" real,
	"status" text DEFAULT 'draft' NOT NULL,
	"approvedBy" text,
	"approvedAt" timestamp with time zone,
	"costCents" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineAssignment" (
	"id" text PRIMARY KEY,
	"workspaceId" text NOT NULL,
	"experimentId" text NOT NULL,
	"contactId" text NOT NULL,
	"armId" text,
	"isHoldout" boolean DEFAULT false NOT NULL,
	"assignedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"firstExposureAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "engineAuditLog" (
	"id" text PRIMARY KEY,
	"workspaceId" text NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"entityType" text,
	"entityId" text,
	"before" jsonb,
	"after" jsonb,
	"reasoning" text,
	"evidence" jsonb DEFAULT '{}' NOT NULL,
	"autonomyLevel" integer,
	"ipAddress" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineAutonomySettings" (
	"id" text PRIMARY KEY,
	"workspaceId" text NOT NULL,
	"channelKey" text NOT NULL,
	"level" integer DEFAULT 0 NOT NULL,
	"maxLevel" integer DEFAULT 1 NOT NULL,
	"errorBand" real DEFAULT 0.2 NOT NULL,
	"promotionWeeks" integer DEFAULT 4 NOT NULL,
	"consecutiveWeeksInBand" integer DEFAULT 0 NOT NULL,
	"mandatoryReviewCount" integer DEFAULT 0 NOT NULL,
	"channelKillSwitch" boolean DEFAULT false NOT NULL,
	"lastPromotedAt" timestamp with time zone,
	"lastDemotedAt" timestamp with time zone,
	"lastDemotionReason" text,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineBrand" (
	"id" text PRIMARY KEY,
	"workspaceId" text NOT NULL,
	"name" text NOT NULL,
	"websiteUrl" text,
	"industry" text,
	"market" text DEFAULT 'b2b' NOT NULL,
	"isDefault" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineBrandKit" (
	"id" text PRIMARY KEY,
	"workspaceId" text NOT NULL,
	"brandId" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"logoUrl" text,
	"colors" jsonb DEFAULT '[]' NOT NULL,
	"fonts" jsonb DEFAULT '{}' NOT NULL,
	"toneOfVoice" text,
	"bannedWords" jsonb DEFAULT '[]' NOT NULL,
	"claims" jsonb DEFAULT '[]' NOT NULL,
	"proofPoints" jsonb DEFAULT '[]' NOT NULL,
	"personas" jsonb DEFAULT '[]' NOT NULL,
	"aiDisclosure" text DEFAULT 'subtle' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineCampaign" (
	"id" text PRIMARY KEY,
	"workspaceId" text NOT NULL,
	"brandId" text,
	"channelId" text,
	"hypothesisId" text,
	"experimentId" text,
	"name" text NOT NULL,
	"objective" text DEFAULT 'incremental_gross_profit' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"budgetDailyMinor" integer,
	"budgetTotalMinor" integer,
	"currency" text DEFAULT 'GBP' NOT NULL,
	"holdoutRate" real DEFAULT 0.1 NOT NULL,
	"autonomyLevel" integer DEFAULT 1 NOT NULL,
	"externalId" text,
	"targeting" jsonb DEFAULT '{}' NOT NULL,
	"startsAt" timestamp with time zone,
	"endsAt" timestamp with time zone,
	"createdBy" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineChannel" (
	"id" text PRIMARY KEY,
	"workspaceId" text NOT NULL,
	"key" text NOT NULL,
	"kind" text NOT NULL,
	"displayName" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineCompany" (
	"id" text PRIMARY KEY,
	"workspaceId" text NOT NULL,
	"name" text NOT NULL,
	"domain" text,
	"industry" text,
	"sizeBand" text,
	"country" text,
	"legalForm" text,
	"source" text,
	"externalIds" jsonb DEFAULT '{}' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineConnection" (
	"id" text PRIMARY KEY,
	"workspaceId" text NOT NULL,
	"channelId" text,
	"provider" text NOT NULL,
	"externalAccountId" text,
	"displayName" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"credentialsEncrypted" text,
	"scopes" jsonb DEFAULT '[]' NOT NULL,
	"tokenExpiresAt" timestamp with time zone,
	"settings" jsonb DEFAULT '{}' NOT NULL,
	"lastSyncAt" timestamp with time zone,
	"lastSyncError" text,
	"connectedBy" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineConsent" (
	"id" text PRIMARY KEY,
	"workspaceId" text NOT NULL,
	"contactId" text NOT NULL,
	"channel" text NOT NULL,
	"status" text DEFAULT 'unknown' NOT NULL,
	"lawfulBasis" text,
	"source" text,
	"evidence" jsonb DEFAULT '{}' NOT NULL,
	"recordedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"expiresAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineContact" (
	"id" text PRIMARY KEY,
	"workspaceId" text NOT NULL,
	"companyId" text,
	"email" text,
	"emailNormalized" text,
	"phone" text,
	"firstName" text,
	"lastName" text,
	"jobTitle" text,
	"country" text,
	"lifecycleStage" text DEFAULT 'lead' NOT NULL,
	"upliftClass" text,
	"upliftScore" real,
	"leadScore" real,
	"hashBucket" integer DEFAULT 0 NOT NULL,
	"source" text,
	"externalIds" jsonb DEFAULT '{}' NOT NULL,
	"attributes" jsonb DEFAULT '{}' NOT NULL,
	"firstSeenAt" timestamp with time zone,
	"lastActivityAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineDeal" (
	"id" text PRIMARY KEY,
	"workspaceId" text NOT NULL,
	"contactId" text,
	"companyId" text,
	"name" text NOT NULL,
	"stage" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"amountMinor" integer,
	"currency" text DEFAULT 'GBP' NOT NULL,
	"probability" real,
	"source" text,
	"externalId" text,
	"ownerName" text,
	"expectedCloseAt" timestamp with time zone,
	"closedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineEvent" (
	"id" text PRIMARY KEY,
	"workspaceId" text NOT NULL,
	"contactId" text,
	"anonymousId" text,
	"type" text NOT NULL,
	"channelKey" text,
	"campaignId" text,
	"assetVariantId" text,
	"experimentId" text,
	"armId" text,
	"source" text NOT NULL,
	"sourceEventId" text,
	"valueMinor" integer,
	"currency" text,
	"properties" jsonb DEFAULT '{}' NOT NULL,
	"occurredAt" timestamp with time zone NOT NULL,
	"receivedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineExperiment" (
	"id" text PRIMARY KEY,
	"workspaceId" text NOT NULL,
	"hypothesisId" text,
	"campaignId" text,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"successMetric" text DEFAULT 'incremental_gross_profit' NOT NULL,
	"holdoutRate" real DEFAULT 0.1 NOT NULL,
	"explorationFloor" real DEFAULT 0.1 NOT NULL,
	"minSamplePerArm" integer DEFAULT 200 NOT NULL,
	"assignmentSalt" text NOT NULL,
	"startsAt" timestamp with time zone,
	"endsAt" timestamp with time zone,
	"result" jsonb,
	"createdBy" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineExperimentArm" (
	"id" text PRIMARY KEY,
	"workspaceId" text NOT NULL,
	"experimentId" text NOT NULL,
	"name" text NOT NULL,
	"isControl" boolean DEFAULT false NOT NULL,
	"assetVariantId" text,
	"weight" real DEFAULT 0.5 NOT NULL,
	"exposures" integer DEFAULT 0 NOT NULL,
	"conversions" integer DEFAULT 0 NOT NULL,
	"grossProfitMinor" bigint DEFAULT 0 NOT NULL,
	"alpha" real DEFAULT 1 NOT NULL,
	"beta" real DEFAULT 1 NOT NULL,
	"config" jsonb DEFAULT '{}' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineGuardrail" (
	"id" text PRIMARY KEY,
	"workspaceId" text NOT NULL,
	"kind" text NOT NULL,
	"channelKey" text,
	"campaignId" text,
	"name" text NOT NULL,
	"config" jsonb DEFAULT '{}' NOT NULL,
	"action" text DEFAULT 'block' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"breachCount" integer DEFAULT 0 NOT NULL,
	"lastBreachAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineHypothesis" (
	"id" text PRIMARY KEY,
	"workspaceId" text NOT NULL,
	"brandId" text,
	"statement" text NOT NULL,
	"channelKey" text,
	"segmentId" text,
	"status" text DEFAULT 'proposed' NOT NULL,
	"expectedEffect" real,
	"confidence" real,
	"priority" real DEFAULT 0 NOT NULL,
	"testDesign" jsonb DEFAULT '{}' NOT NULL,
	"budgetMinor" integer,
	"successMetric" text DEFAULT 'incremental_gross_profit' NOT NULL,
	"proposedBy" text NOT NULL,
	"llmCallId" text,
	"approvedBy" text,
	"approvedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineIdentity" (
	"id" text PRIMARY KEY,
	"workspaceId" text NOT NULL,
	"contactId" text NOT NULL,
	"kind" text NOT NULL,
	"provider" text,
	"value" text NOT NULL,
	"confidence" real DEFAULT 1 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineJourney" (
	"id" text PRIMARY KEY,
	"workspaceId" text NOT NULL,
	"campaignId" text,
	"name" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"trigger" jsonb DEFAULT '{}' NOT NULL,
	"holdoutRate" real DEFAULT 0.1 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineJourneyStep" (
	"id" text PRIMARY KEY,
	"workspaceId" text NOT NULL,
	"journeyId" text NOT NULL,
	"kind" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"parentStepId" text,
	"channelId" text,
	"assetVariantId" text,
	"config" jsonb DEFAULT '{}' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineLearning" (
	"id" text PRIMARY KEY,
	"workspaceId" text NOT NULL,
	"statement" text NOT NULL,
	"scope" text DEFAULT 'workspace' NOT NULL,
	"scopeId" text,
	"effectSize" real,
	"ciLow" real,
	"ciHigh" real,
	"sampleSize" integer DEFAULT 0 NOT NULL,
	"testType" text NOT NULL,
	"grade" text DEFAULT 'C' NOT NULL,
	"halfLifeDays" integer DEFAULT 90 NOT NULL,
	"observedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"retestHypothesisId" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineLearningEvidence" (
	"id" text PRIMARY KEY,
	"workspaceId" text NOT NULL,
	"learningId" text NOT NULL,
	"entityType" text NOT NULL,
	"entityId" text NOT NULL,
	"effectSize" real,
	"sampleSize" integer,
	"note" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineLlmCall" (
	"id" text PRIMARY KEY,
	"workspaceId" text,
	"agent" text NOT NULL,
	"tier" text NOT NULL,
	"model" text NOT NULL,
	"purpose" text,
	"system" text,
	"messages" jsonb DEFAULT '[]' NOT NULL,
	"tools" jsonb,
	"output" jsonb,
	"stopReason" text,
	"inputTokens" integer DEFAULT 0 NOT NULL,
	"outputTokens" integer DEFAULT 0 NOT NULL,
	"cacheReadTokens" integer DEFAULT 0 NOT NULL,
	"cacheWriteTokens" integer DEFAULT 0 NOT NULL,
	"costMicros" bigint DEFAULT 0 NOT NULL,
	"latencyMs" integer DEFAULT 0 NOT NULL,
	"error" text,
	"actor" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineMembership" (
	"id" text PRIMARY KEY,
	"workspaceId" text NOT NULL,
	"userId" text NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"invitedBy" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineMetricsDaily" (
	"id" text PRIMARY KEY,
	"workspaceId" text NOT NULL,
	"day" text NOT NULL,
	"channelKey" text DEFAULT 'all' NOT NULL,
	"campaignId" text DEFAULT 'all' NOT NULL,
	"armId" text DEFAULT 'all' NOT NULL,
	"spendMinor" integer DEFAULT 0 NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"conversions" integer DEFAULT 0 NOT NULL,
	"newCustomers" integer DEFAULT 0 NOT NULL,
	"revenueMinor" integer DEFAULT 0 NOT NULL,
	"grossProfitMinor" integer DEFAULT 0 NOT NULL,
	"incrementalGrossProfitMinor" integer,
	"unsubscribes" integer DEFAULT 0 NOT NULL,
	"complaints" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'GBP' NOT NULL,
	"computedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineModelRegistry" (
	"id" text PRIMARY KEY,
	"workspaceId" text NOT NULL,
	"kind" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'challenger' NOT NULL,
	"artifactRef" text,
	"metrics" jsonb DEFAULT '{}' NOT NULL,
	"trainedAt" timestamp with time zone,
	"promotedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineOAuthState" (
	"id" text PRIMARY KEY,
	"workspaceId" text NOT NULL,
	"userId" text NOT NULL,
	"provider" text NOT NULL,
	"codeVerifier" text,
	"redirectUri" text NOT NULL,
	"returnTo" text,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineOrder" (
	"id" text PRIMARY KEY,
	"workspaceId" text NOT NULL,
	"contactId" text,
	"dealId" text,
	"source" text NOT NULL,
	"externalId" text NOT NULL,
	"status" text DEFAULT 'paid' NOT NULL,
	"currency" text NOT NULL,
	"revenueMinor" integer NOT NULL,
	"costMinor" integer DEFAULT 0 NOT NULL,
	"feesMinor" integer DEFAULT 0 NOT NULL,
	"refundedMinor" integer DEFAULT 0 NOT NULL,
	"grossProfitMinor" integer NOT NULL,
	"isFirstOrder" boolean DEFAULT false NOT NULL,
	"lineItems" jsonb DEFAULT '[]' NOT NULL,
	"occurredAt" timestamp with time zone NOT NULL,
	"raw" jsonb,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineOutcome" (
	"id" text PRIMARY KEY,
	"workspaceId" text NOT NULL,
	"contactId" text,
	"orderId" text,
	"dealId" text,
	"type" text NOT NULL,
	"grossProfitMinor" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'GBP' NOT NULL,
	"experimentId" text,
	"armId" text,
	"isHoldout" boolean,
	"attribution" jsonb DEFAULT '{}' NOT NULL,
	"occurredAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enginePrediction" (
	"id" text PRIMARY KEY,
	"workspaceId" text NOT NULL,
	"channelKey" text,
	"entityType" text NOT NULL,
	"entityId" text NOT NULL,
	"metric" text NOT NULL,
	"predicted" real NOT NULL,
	"predictedLow" real,
	"predictedHigh" real,
	"actual" real,
	"absoluteError" real,
	"modelId" text,
	"llmCallId" text,
	"horizonEndsAt" timestamp with time zone NOT NULL,
	"resolvedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineProduct" (
	"id" text PRIMARY KEY,
	"workspaceId" text NOT NULL,
	"brandId" text,
	"name" text NOT NULL,
	"sku" text,
	"priceMinor" integer,
	"unitCostMinor" integer,
	"grossMarginRate" real,
	"currency" text DEFAULT 'GBP' NOT NULL,
	"source" text,
	"externalIds" jsonb DEFAULT '{}' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineProviderJob" (
	"id" text PRIMARY KEY,
	"workspaceId" text NOT NULL,
	"assetId" text,
	"provider" text NOT NULL,
	"model" text,
	"kind" text NOT NULL,
	"externalJobId" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"request" jsonb DEFAULT '{}' NOT NULL,
	"result" jsonb,
	"error" text,
	"estimatedCostCents" integer DEFAULT 0 NOT NULL,
	"actualCostCents" integer,
	"startedAt" timestamp with time zone,
	"finishedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineSegment" (
	"id" text PRIMARY KEY,
	"workspaceId" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"definition" jsonb DEFAULT '{}' NOT NULL,
	"isDynamic" boolean DEFAULT true NOT NULL,
	"memberCount" integer DEFAULT 0 NOT NULL,
	"lastEvaluatedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineWorkspace" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"currency" text DEFAULT 'GBP' NOT NULL,
	"timezone" text DEFAULT 'Europe/London' NOT NULL,
	"dataRegion" text DEFAULT 'uk' NOT NULL,
	"llmBudgetMonthlyCents" integer DEFAULT 5000 NOT NULL,
	"mediaBudgetMonthlyCents" integer DEFAULT 5000 NOT NULL,
	"killSwitch" boolean DEFAULT false NOT NULL,
	"createdBy" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "engineApproval_workspace_status_idx" ON "engineApproval" ("workspaceId","status");--> statement-breakpoint
CREATE INDEX "engineApproval_entity_idx" ON "engineApproval" ("entityType","entityId");--> statement-breakpoint
CREATE INDEX "engineAsset_workspaceId_idx" ON "engineAsset" ("workspaceId");--> statement-breakpoint
CREATE UNIQUE INDEX "engineAssetFeature_variant_feature_idx" ON "engineAssetFeature" ("variantId","feature");--> statement-breakpoint
CREATE INDEX "engineAssetFeature_workspace_feature_idx" ON "engineAssetFeature" ("workspaceId","feature","value");--> statement-breakpoint
CREATE INDEX "engineAssetVariant_assetId_idx" ON "engineAssetVariant" ("assetId");--> statement-breakpoint
CREATE INDEX "engineAssetVariant_workspaceId_idx" ON "engineAssetVariant" ("workspaceId");--> statement-breakpoint
CREATE UNIQUE INDEX "engineAssignment_experiment_contact_idx" ON "engineAssignment" ("experimentId","contactId");--> statement-breakpoint
CREATE INDEX "engineAssignment_workspaceId_idx" ON "engineAssignment" ("workspaceId");--> statement-breakpoint
CREATE INDEX "engineAuditLog_workspace_created_idx" ON "engineAuditLog" ("workspaceId","createdAt");--> statement-breakpoint
CREATE INDEX "engineAuditLog_entity_idx" ON "engineAuditLog" ("entityType","entityId");--> statement-breakpoint
CREATE UNIQUE INDEX "engineAutonomySettings_workspace_channel_idx" ON "engineAutonomySettings" ("workspaceId","channelKey");--> statement-breakpoint
CREATE INDEX "engineBrand_workspaceId_idx" ON "engineBrand" ("workspaceId");--> statement-breakpoint
CREATE INDEX "engineBrandKit_workspaceId_idx" ON "engineBrandKit" ("workspaceId");--> statement-breakpoint
CREATE UNIQUE INDEX "engineBrandKit_brand_version_idx" ON "engineBrandKit" ("brandId","version");--> statement-breakpoint
CREATE INDEX "engineCampaign_workspaceId_idx" ON "engineCampaign" ("workspaceId");--> statement-breakpoint
CREATE INDEX "engineCampaign_status_idx" ON "engineCampaign" ("workspaceId","status");--> statement-breakpoint
CREATE UNIQUE INDEX "engineChannel_workspace_key_idx" ON "engineChannel" ("workspaceId","key");--> statement-breakpoint
CREATE INDEX "engineCompany_workspaceId_idx" ON "engineCompany" ("workspaceId");--> statement-breakpoint
CREATE INDEX "engineCompany_domain_idx" ON "engineCompany" ("workspaceId","domain");--> statement-breakpoint
CREATE INDEX "engineConnection_workspaceId_idx" ON "engineConnection" ("workspaceId");--> statement-breakpoint
CREATE UNIQUE INDEX "engineConnection_workspace_provider_account_idx" ON "engineConnection" ("workspaceId","provider","externalAccountId") WHERE "externalAccountId" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "engineConsent_contact_channel_idx" ON "engineConsent" ("contactId","channel");--> statement-breakpoint
CREATE INDEX "engineConsent_workspaceId_idx" ON "engineConsent" ("workspaceId");--> statement-breakpoint
CREATE INDEX "engineContact_workspaceId_idx" ON "engineContact" ("workspaceId");--> statement-breakpoint
CREATE UNIQUE INDEX "engineContact_workspace_email_idx" ON "engineContact" ("workspaceId","emailNormalized") WHERE "emailNormalized" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "engineContact_companyId_idx" ON "engineContact" ("companyId");--> statement-breakpoint
CREATE INDEX "engineContact_lifecycle_idx" ON "engineContact" ("workspaceId","lifecycleStage");--> statement-breakpoint
CREATE INDEX "engineDeal_workspaceId_idx" ON "engineDeal" ("workspaceId");--> statement-breakpoint
CREATE UNIQUE INDEX "engineDeal_workspace_source_external_idx" ON "engineDeal" ("workspaceId","source","externalId") WHERE "externalId" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "engineDeal_status_idx" ON "engineDeal" ("workspaceId","status");--> statement-breakpoint
CREATE INDEX "engineEvent_workspace_occurred_idx" ON "engineEvent" ("workspaceId","occurredAt");--> statement-breakpoint
CREATE INDEX "engineEvent_workspace_type_occurred_idx" ON "engineEvent" ("workspaceId","type","occurredAt");--> statement-breakpoint
CREATE INDEX "engineEvent_contact_occurred_idx" ON "engineEvent" ("contactId","occurredAt");--> statement-breakpoint
CREATE UNIQUE INDEX "engineEvent_source_event_idx" ON "engineEvent" ("workspaceId","source","sourceEventId") WHERE "sourceEventId" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "engineExperiment_workspaceId_idx" ON "engineExperiment" ("workspaceId");--> statement-breakpoint
CREATE INDEX "engineExperiment_status_idx" ON "engineExperiment" ("workspaceId","status");--> statement-breakpoint
CREATE INDEX "engineExperimentArm_experimentId_idx" ON "engineExperimentArm" ("experimentId");--> statement-breakpoint
CREATE INDEX "engineGuardrail_workspaceId_idx" ON "engineGuardrail" ("workspaceId");--> statement-breakpoint
CREATE INDEX "engineHypothesis_workspaceId_idx" ON "engineHypothesis" ("workspaceId");--> statement-breakpoint
CREATE INDEX "engineHypothesis_status_priority_idx" ON "engineHypothesis" ("workspaceId","status","priority");--> statement-breakpoint
CREATE UNIQUE INDEX "engineIdentity_workspace_kind_provider_value_idx" ON "engineIdentity" ("workspaceId","kind","provider","value");--> statement-breakpoint
CREATE INDEX "engineIdentity_contactId_idx" ON "engineIdentity" ("contactId");--> statement-breakpoint
CREATE INDEX "engineJourney_workspaceId_idx" ON "engineJourney" ("workspaceId");--> statement-breakpoint
CREATE INDEX "engineJourneyStep_journeyId_idx" ON "engineJourneyStep" ("journeyId");--> statement-breakpoint
CREATE INDEX "engineLearning_workspaceId_idx" ON "engineLearning" ("workspaceId");--> statement-breakpoint
CREATE INDEX "engineLearning_grade_status_idx" ON "engineLearning" ("workspaceId","grade","status");--> statement-breakpoint
CREATE INDEX "engineLearningEvidence_learningId_idx" ON "engineLearningEvidence" ("learningId");--> statement-breakpoint
CREATE INDEX "engineLlmCall_workspace_created_idx" ON "engineLlmCall" ("workspaceId","createdAt");--> statement-breakpoint
CREATE INDEX "engineLlmCall_agent_idx" ON "engineLlmCall" ("agent");--> statement-breakpoint
CREATE UNIQUE INDEX "engineMembership_workspace_user_idx" ON "engineMembership" ("workspaceId","userId");--> statement-breakpoint
CREATE INDEX "engineMembership_userId_idx" ON "engineMembership" ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "engineMetricsDaily_key_idx" ON "engineMetricsDaily" ("workspaceId","day","channelKey","campaignId","armId");--> statement-breakpoint
CREATE UNIQUE INDEX "engineModelRegistry_kind_version_idx" ON "engineModelRegistry" ("workspaceId","kind","version");--> statement-breakpoint
CREATE INDEX "engineOAuthState_workspaceId_idx" ON "engineOAuthState" ("workspaceId");--> statement-breakpoint
CREATE UNIQUE INDEX "engineOrder_workspace_source_external_idx" ON "engineOrder" ("workspaceId","source","externalId");--> statement-breakpoint
CREATE INDEX "engineOrder_workspace_occurred_idx" ON "engineOrder" ("workspaceId","occurredAt");--> statement-breakpoint
CREATE INDEX "engineOrder_contactId_idx" ON "engineOrder" ("contactId");--> statement-breakpoint
CREATE INDEX "engineOutcome_workspace_occurred_idx" ON "engineOutcome" ("workspaceId","occurredAt");--> statement-breakpoint
CREATE INDEX "engineOutcome_experiment_idx" ON "engineOutcome" ("experimentId");--> statement-breakpoint
CREATE UNIQUE INDEX "engineOutcome_order_type_idx" ON "engineOutcome" ("orderId","type") WHERE "orderId" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "enginePrediction_workspace_channel_idx" ON "enginePrediction" ("workspaceId","channelKey");--> statement-breakpoint
CREATE INDEX "enginePrediction_entity_idx" ON "enginePrediction" ("entityType","entityId");--> statement-breakpoint
CREATE INDEX "engineProduct_workspaceId_idx" ON "engineProduct" ("workspaceId");--> statement-breakpoint
CREATE INDEX "engineProviderJob_workspaceId_idx" ON "engineProviderJob" ("workspaceId");--> statement-breakpoint
CREATE INDEX "engineProviderJob_status_idx" ON "engineProviderJob" ("workspaceId","status");--> statement-breakpoint
CREATE INDEX "engineSegment_workspaceId_idx" ON "engineSegment" ("workspaceId");--> statement-breakpoint
CREATE UNIQUE INDEX "engineWorkspace_slug_idx" ON "engineWorkspace" ("slug");--> statement-breakpoint
ALTER TABLE "engineApproval" ADD CONSTRAINT "engineApproval_workspaceId_engineWorkspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "engineWorkspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineAsset" ADD CONSTRAINT "engineAsset_workspaceId_engineWorkspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "engineWorkspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineAsset" ADD CONSTRAINT "engineAsset_brandId_engineBrand_id_fkey" FOREIGN KEY ("brandId") REFERENCES "engineBrand"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "engineAsset" ADD CONSTRAINT "engineAsset_campaignId_engineCampaign_id_fkey" FOREIGN KEY ("campaignId") REFERENCES "engineCampaign"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "engineAssetFeature" ADD CONSTRAINT "engineAssetFeature_workspaceId_engineWorkspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "engineWorkspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineAssetFeature" ADD CONSTRAINT "engineAssetFeature_variantId_engineAssetVariant_id_fkey" FOREIGN KEY ("variantId") REFERENCES "engineAssetVariant"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineAssetVariant" ADD CONSTRAINT "engineAssetVariant_workspaceId_engineWorkspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "engineWorkspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineAssetVariant" ADD CONSTRAINT "engineAssetVariant_assetId_engineAsset_id_fkey" FOREIGN KEY ("assetId") REFERENCES "engineAsset"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineAssignment" ADD CONSTRAINT "engineAssignment_workspaceId_engineWorkspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "engineWorkspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineAssignment" ADD CONSTRAINT "engineAssignment_experimentId_engineExperiment_id_fkey" FOREIGN KEY ("experimentId") REFERENCES "engineExperiment"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineAssignment" ADD CONSTRAINT "engineAssignment_contactId_engineContact_id_fkey" FOREIGN KEY ("contactId") REFERENCES "engineContact"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineAssignment" ADD CONSTRAINT "engineAssignment_armId_engineExperimentArm_id_fkey" FOREIGN KEY ("armId") REFERENCES "engineExperimentArm"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "engineAuditLog" ADD CONSTRAINT "engineAuditLog_workspaceId_engineWorkspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "engineWorkspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineAutonomySettings" ADD CONSTRAINT "engineAutonomySettings_workspaceId_engineWorkspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "engineWorkspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineBrand" ADD CONSTRAINT "engineBrand_workspaceId_engineWorkspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "engineWorkspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineBrandKit" ADD CONSTRAINT "engineBrandKit_workspaceId_engineWorkspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "engineWorkspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineBrandKit" ADD CONSTRAINT "engineBrandKit_brandId_engineBrand_id_fkey" FOREIGN KEY ("brandId") REFERENCES "engineBrand"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineCampaign" ADD CONSTRAINT "engineCampaign_workspaceId_engineWorkspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "engineWorkspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineCampaign" ADD CONSTRAINT "engineCampaign_brandId_engineBrand_id_fkey" FOREIGN KEY ("brandId") REFERENCES "engineBrand"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "engineCampaign" ADD CONSTRAINT "engineCampaign_channelId_engineChannel_id_fkey" FOREIGN KEY ("channelId") REFERENCES "engineChannel"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "engineChannel" ADD CONSTRAINT "engineChannel_workspaceId_engineWorkspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "engineWorkspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineCompany" ADD CONSTRAINT "engineCompany_workspaceId_engineWorkspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "engineWorkspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineConnection" ADD CONSTRAINT "engineConnection_workspaceId_engineWorkspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "engineWorkspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineConnection" ADD CONSTRAINT "engineConnection_channelId_engineChannel_id_fkey" FOREIGN KEY ("channelId") REFERENCES "engineChannel"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "engineConsent" ADD CONSTRAINT "engineConsent_workspaceId_engineWorkspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "engineWorkspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineConsent" ADD CONSTRAINT "engineConsent_contactId_engineContact_id_fkey" FOREIGN KEY ("contactId") REFERENCES "engineContact"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineContact" ADD CONSTRAINT "engineContact_workspaceId_engineWorkspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "engineWorkspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineContact" ADD CONSTRAINT "engineContact_companyId_engineCompany_id_fkey" FOREIGN KEY ("companyId") REFERENCES "engineCompany"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "engineDeal" ADD CONSTRAINT "engineDeal_workspaceId_engineWorkspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "engineWorkspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineDeal" ADD CONSTRAINT "engineDeal_contactId_engineContact_id_fkey" FOREIGN KEY ("contactId") REFERENCES "engineContact"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "engineDeal" ADD CONSTRAINT "engineDeal_companyId_engineCompany_id_fkey" FOREIGN KEY ("companyId") REFERENCES "engineCompany"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "engineEvent" ADD CONSTRAINT "engineEvent_workspaceId_engineWorkspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "engineWorkspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineExperiment" ADD CONSTRAINT "engineExperiment_workspaceId_engineWorkspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "engineWorkspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineExperiment" ADD CONSTRAINT "engineExperiment_campaignId_engineCampaign_id_fkey" FOREIGN KEY ("campaignId") REFERENCES "engineCampaign"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "engineExperimentArm" ADD CONSTRAINT "engineExperimentArm_workspaceId_engineWorkspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "engineWorkspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineExperimentArm" ADD CONSTRAINT "engineExperimentArm_experimentId_engineExperiment_id_fkey" FOREIGN KEY ("experimentId") REFERENCES "engineExperiment"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineGuardrail" ADD CONSTRAINT "engineGuardrail_workspaceId_engineWorkspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "engineWorkspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineHypothesis" ADD CONSTRAINT "engineHypothesis_workspaceId_engineWorkspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "engineWorkspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineIdentity" ADD CONSTRAINT "engineIdentity_workspaceId_engineWorkspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "engineWorkspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineIdentity" ADD CONSTRAINT "engineIdentity_contactId_engineContact_id_fkey" FOREIGN KEY ("contactId") REFERENCES "engineContact"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineJourney" ADD CONSTRAINT "engineJourney_workspaceId_engineWorkspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "engineWorkspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineJourney" ADD CONSTRAINT "engineJourney_campaignId_engineCampaign_id_fkey" FOREIGN KEY ("campaignId") REFERENCES "engineCampaign"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "engineJourneyStep" ADD CONSTRAINT "engineJourneyStep_workspaceId_engineWorkspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "engineWorkspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineJourneyStep" ADD CONSTRAINT "engineJourneyStep_journeyId_engineJourney_id_fkey" FOREIGN KEY ("journeyId") REFERENCES "engineJourney"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineLearning" ADD CONSTRAINT "engineLearning_workspaceId_engineWorkspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "engineWorkspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineLearningEvidence" ADD CONSTRAINT "engineLearningEvidence_workspaceId_engineWorkspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "engineWorkspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineLearningEvidence" ADD CONSTRAINT "engineLearningEvidence_learningId_engineLearning_id_fkey" FOREIGN KEY ("learningId") REFERENCES "engineLearning"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineLlmCall" ADD CONSTRAINT "engineLlmCall_workspaceId_engineWorkspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "engineWorkspace"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "engineMembership" ADD CONSTRAINT "engineMembership_workspaceId_engineWorkspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "engineWorkspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineMembership" ADD CONSTRAINT "engineMembership_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineMetricsDaily" ADD CONSTRAINT "engineMetricsDaily_workspaceId_engineWorkspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "engineWorkspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineModelRegistry" ADD CONSTRAINT "engineModelRegistry_workspaceId_engineWorkspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "engineWorkspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineOAuthState" ADD CONSTRAINT "engineOAuthState_workspaceId_engineWorkspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "engineWorkspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineOrder" ADD CONSTRAINT "engineOrder_workspaceId_engineWorkspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "engineWorkspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineOrder" ADD CONSTRAINT "engineOrder_contactId_engineContact_id_fkey" FOREIGN KEY ("contactId") REFERENCES "engineContact"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "engineOrder" ADD CONSTRAINT "engineOrder_dealId_engineDeal_id_fkey" FOREIGN KEY ("dealId") REFERENCES "engineDeal"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "engineOutcome" ADD CONSTRAINT "engineOutcome_workspaceId_engineWorkspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "engineWorkspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineOutcome" ADD CONSTRAINT "engineOutcome_orderId_engineOrder_id_fkey" FOREIGN KEY ("orderId") REFERENCES "engineOrder"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "engineOutcome" ADD CONSTRAINT "engineOutcome_dealId_engineDeal_id_fkey" FOREIGN KEY ("dealId") REFERENCES "engineDeal"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "enginePrediction" ADD CONSTRAINT "enginePrediction_workspaceId_engineWorkspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "engineWorkspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineProduct" ADD CONSTRAINT "engineProduct_workspaceId_engineWorkspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "engineWorkspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineProduct" ADD CONSTRAINT "engineProduct_brandId_engineBrand_id_fkey" FOREIGN KEY ("brandId") REFERENCES "engineBrand"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "engineProviderJob" ADD CONSTRAINT "engineProviderJob_workspaceId_engineWorkspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "engineWorkspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineProviderJob" ADD CONSTRAINT "engineProviderJob_assetId_engineAsset_id_fkey" FOREIGN KEY ("assetId") REFERENCES "engineAsset"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "engineSegment" ADD CONSTRAINT "engineSegment_workspaceId_engineWorkspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "engineWorkspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engineWorkspace" ADD CONSTRAINT "engineWorkspace_createdBy_user_id_fkey" FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE RESTRICT;`

export async function up(client: PoolClient) {
  for (const stmt of sql.split('--> statement-breakpoint')) {
    const trimmed = stmt.trim()
    if (trimmed) await client.query(trimmed)
  }
}
