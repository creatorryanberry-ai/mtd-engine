DROP TABLE IF EXISTS "notification" CASCADE;
DROP TABLE IF EXISTS "comment" CASCADE;
DROP TABLE IF EXISTS "report" CASCADE;
DROP TABLE IF EXISTS "block" CASCADE;
DROP TABLE IF EXISTS "post" CASCADE;
DROP TABLE IF EXISTS "device" CASCADE;
DROP TABLE IF EXISTS "invite" CASCADE;
DROP TABLE IF EXISTS "whitelist" CASCADE;

ALTER TABLE "userPublic" DROP COLUMN IF EXISTS "hasOnboarded";
ALTER TABLE "userPublic" DROP COLUMN IF EXISTS "whitelisted";
ALTER TABLE "userPublic" DROP COLUMN IF EXISTS "migrationVersion";
ALTER TABLE "userPublic" DROP COLUMN IF EXISTS "postsCount";

ALTER TABLE "userState" DROP COLUMN IF EXISTS "locale";
ALTER TABLE "userState" DROP COLUMN IF EXISTS "timeZone";
ALTER TABLE "userState" DROP COLUMN IF EXISTS "onlineStatus";
ALTER TABLE "userState" DROP COLUMN IF EXISTS "lastNotificationReadAt";

CREATE TABLE IF NOT EXISTS "plaidItem" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL UNIQUE,
  "plaidItemId" text NOT NULL UNIQUE,
  "accessToken" text NOT NULL,
  "institutionId" text,
  "institutionName" text,
  "transactionsCursor" text,
  "lastSyncedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "mtdTransaction" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "plaidTransactionId" text NOT NULL,
  "merchantName" text NOT NULL,
  "category" text DEFAULT 'Uncategorised' NOT NULL,
  "hmrcCategory" text DEFAULT 'uncategorised' NOT NULL,
  "categorySource" text DEFAULT 'uncategorised' NOT NULL,
  "confidence" text DEFAULT 'low' NOT NULL,
  "reviewedAt" timestamp,
  "amount" real NOT NULL,
  "date" text NOT NULL,
  "pending" boolean DEFAULT false NOT NULL,
  "accountName" text,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "mtdTransaction_userId_idx" ON "mtdTransaction" ("userId");
CREATE INDEX IF NOT EXISTS "mtdTransaction_date_idx" ON "mtdTransaction" ("date");
CREATE INDEX IF NOT EXISTS "mtdTransaction_review_idx" ON "mtdTransaction" ("userId", "confidence", "reviewedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "mtdTransaction_user_plaid_tx_idx" ON "mtdTransaction" ("userId", "plaidTransactionId");

CREATE TABLE IF NOT EXISTS "categorisationRule" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "matchField" text DEFAULT 'merchant' NOT NULL,
  "matchType" text DEFAULT 'contains' NOT NULL,
  "matchValue" text NOT NULL,
  "hmrcCategory" text NOT NULL,
  "priority" real DEFAULT 0 NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "categorisationRule_userId_idx" ON "categorisationRule" ("userId");
CREATE INDEX IF NOT EXISTS "categorisationRule_priority_idx" ON "categorisationRule" ("userId", "priority");

CREATE TABLE IF NOT EXISTS "mtdSubmission" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "quarterId" text NOT NULL,
  "taxYearStart" text NOT NULL,
  "periodEnd" text NOT NULL,
  "submittedAt" timestamp NOT NULL,
  "reference" text NOT NULL,
  "incomeTotal" real NOT NULL,
  "expenseTotal" real NOT NULL,
  "taxableProfit" real NOT NULL,
  "taxDue" real NOT NULL,
  "payload" text DEFAULT '[]' NOT NULL
);

CREATE INDEX IF NOT EXISTS "mtdSubmission_userId_idx" ON "mtdSubmission" ("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "mtdSubmission_user_quarter_tax_year_idx" ON "mtdSubmission" ("userId", "quarterId", "taxYearStart");

DO $$ BEGIN
  ALTER TABLE "plaidItem" ADD CONSTRAINT "plaidItem_userId_user_id_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "device" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "name" text,
  "platform" text NOT NULL,
  "platformVersion" text,
  "appVersion" text,
  "pushToken" text,
  "pushEnabled" boolean DEFAULT false NOT NULL,
  "lastActiveAt" timestamp,
  "createdAt" timestamp NOT NULL,
  "updatedAt" timestamp
);

CREATE INDEX IF NOT EXISTS "device_userId_idx" ON "device" ("userId");
CREATE INDEX IF NOT EXISTS "device_pushToken_idx" ON "device" ("pushToken");

CREATE TABLE IF NOT EXISTS "notification" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "actorId" text,
  "type" text NOT NULL,
  "title" text,
  "body" text,
  "data" text,
  "read" boolean DEFAULT false NOT NULL,
  "createdAt" timestamp NOT NULL
);

CREATE INDEX IF NOT EXISTS "notification_userId_idx" ON "notification" ("userId");
CREATE INDEX IF NOT EXISTS "notification_userId_read_idx" ON "notification" ("userId", "read");
CREATE INDEX IF NOT EXISTS "notification_userId_read_createdAt_idx" ON "notification" ("userId", "read", "createdAt");
CREATE INDEX IF NOT EXISTS "notification_actorId_idx" ON "notification" ("actorId");
CREATE INDEX IF NOT EXISTS "notification_createdAt_idx" ON "notification" ("createdAt");
