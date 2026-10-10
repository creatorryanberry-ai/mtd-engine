CREATE TABLE "inboundEmail" (
	"id" text PRIMARY KEY,
	"userId" text NOT NULL,
	"inboundEmailAddressId" text NOT NULL,
	"provider" text NOT NULL,
	"providerMessageId" text NOT NULL,
	"fromAddress" text NOT NULL,
	"toAddress" text NOT NULL,
	"subject" text,
	"receivedAt" timestamp NOT NULL,
	"status" text NOT NULL,
	"errorMessage" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inboundEmailAddress" (
	"id" text PRIMARY KEY,
	"userId" text NOT NULL,
	"token" text NOT NULL,
	"emailAddress" text NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"revokedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "inboxDocument" (
	"id" text PRIMARY KEY,
	"userId" text NOT NULL,
	"inboundEmailId" text,
	"source" text NOT NULL,
	"originalFileName" text NOT NULL,
	"mimeType" text NOT NULL,
	"fileSize" integer NOT NULL,
	"storagePath" text NOT NULL,
	"sha256Hash" text NOT NULL,
	"status" text NOT NULL,
	"receivedAt" timestamp NOT NULL,
	"processedAt" timestamp,
	"mtdTransactionId" text,
	"errorMessage" text
);
--> statement-breakpoint
ALTER TABLE "mtdSubmissionJob" ADD COLUMN IF NOT EXISTS "taxYearStart" text DEFAULT '2025-04-06' NOT NULL;--> statement-breakpoint
CREATE INDEX "inboundEmail_userId_idx" ON "inboundEmail" ("userId");--> statement-breakpoint
CREATE INDEX "inboundEmail_inboundEmailAddressId_idx" ON "inboundEmail" ("inboundEmailAddressId");--> statement-breakpoint
CREATE UNIQUE INDEX "inboundEmail_provider_message_idx" ON "inboundEmail" ("provider","providerMessageId");--> statement-breakpoint
CREATE UNIQUE INDEX "inboundEmailAddress_token_idx" ON "inboundEmailAddress" ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "inboundEmailAddress_emailAddress_idx" ON "inboundEmailAddress" ("emailAddress");--> statement-breakpoint
CREATE INDEX "inboundEmailAddress_userId_idx" ON "inboundEmailAddress" ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "inboundEmailAddress_active_user_idx" ON "inboundEmailAddress" ("userId") WHERE "isActive" = true;--> statement-breakpoint
CREATE INDEX "inboxDocument_userId_idx" ON "inboxDocument" ("userId");--> statement-breakpoint
CREATE INDEX "inboxDocument_userId_status_idx" ON "inboxDocument" ("userId","status");--> statement-breakpoint
CREATE INDEX "inboxDocument_inboundEmailId_idx" ON "inboxDocument" ("inboundEmailId");--> statement-breakpoint
CREATE INDEX "inboxDocument_userId_hash_idx" ON "inboxDocument" ("userId","sha256Hash");--> statement-breakpoint
ALTER TABLE "inboundEmail" ADD CONSTRAINT "inboundEmail_inboundEmailAddressId_inboundEmailAddress_id_fkey" FOREIGN KEY ("inboundEmailAddressId") REFERENCES "inboundEmailAddress"("id");--> statement-breakpoint
ALTER TABLE "inboxDocument" ADD CONSTRAINT "inboxDocument_inboundEmailId_inboundEmail_id_fkey" FOREIGN KEY ("inboundEmailId") REFERENCES "inboundEmail"("id") ON DELETE SET NULL;