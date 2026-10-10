CREATE TABLE "businessSettings" (
	"userId" text PRIMARY KEY,
	"businessName" text,
	"businessStartDate" text,
	"businessDescription" text,
	"businessType" text,
	"cisRegistered" boolean,
	"vehicleClaimMethod" text,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "businessSettings" ADD CONSTRAINT "businessSettings_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;