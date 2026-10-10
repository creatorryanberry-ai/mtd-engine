CREATE TABLE "categorisationRuleBankAccount" (
	"ruleId" text,
	"bankAccountId" text,
	CONSTRAINT "categorisationRuleBankAccount_pkey" PRIMARY KEY("ruleId","bankAccountId")
);
--> statement-breakpoint
CREATE INDEX "categorisationRuleBankAccount_bankAccountId_idx" ON "categorisationRuleBankAccount" ("bankAccountId");--> statement-breakpoint
ALTER TABLE "categorisationRuleBankAccount" ADD CONSTRAINT "categorisationRuleBankAccount_ruleId_categorisationRule_id_fkey" FOREIGN KEY ("ruleId") REFERENCES "categorisationRule"("id") ON DELETE CASCADE;