import type { PoolClient } from 'pg'

const sql = `CREATE TABLE "hmrcConnection" (
	"id" text PRIMARY KEY,
	"userId" text NOT NULL UNIQUE,
	"nino" text NOT NULL,
	"accessToken" text NOT NULL,
	"refreshToken" text NOT NULL,
	"accessTokenExpiresAt" timestamp NOT NULL,
	"scope" text,
	"businessId" text,
	"businessName" text,
	"connectedAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hmrcOAuthState" (
	"id" text PRIMARY KEY,
	"userId" text NOT NULL,
	"codeVerifier" text NOT NULL,
	"redirectUri" text NOT NULL,
	"returnTo" text,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mtdSubmission" ADD COLUMN "source" text DEFAULT 'mock' NOT NULL;--> statement-breakpoint
ALTER TABLE "mtdSubmission" ADD COLUMN "hmrcPeriodId" text;--> statement-breakpoint
ALTER TABLE "hmrcConnection" ADD CONSTRAINT "hmrcConnection_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "hmrcOAuthState" ADD CONSTRAINT "hmrcOAuthState_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;`

export async function up(client: PoolClient) {
  for (const stmt of sql.split('--> statement-breakpoint')) {
    const trimmed = stmt.trim()
    if (trimmed) await client.query(trimmed)
  }
}
