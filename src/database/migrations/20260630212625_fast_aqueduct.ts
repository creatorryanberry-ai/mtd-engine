import type { PoolClient } from 'pg'

const sql = `CREATE TABLE "mtdSubmissionJob" (
	"id" text PRIMARY KEY,
	"userId" text NOT NULL,
	"quarterId" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"reference" text,
	"submittedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "mtdSubmissionJob_userId_idx" ON "mtdSubmissionJob" ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "mtdSubmissionJob_user_quarter_idx" ON "mtdSubmissionJob" ("userId","quarterId");`

export async function up(client: PoolClient) {
  for (const stmt of sql.split('--> statement-breakpoint')) {
    const trimmed = stmt.trim()
    if (trimmed) await client.query(trimmed)
  }
}
