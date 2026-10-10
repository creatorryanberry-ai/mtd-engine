CREATE TABLE "mileageEntry" (
	"id" text PRIMARY KEY,
	"userId" text NOT NULL,
	"date" text NOT NULL,
	"journeyDetails" text NOT NULL,
	"miles" real NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "mileageEntry_userId_idx" ON "mileageEntry" ("userId");--> statement-breakpoint
CREATE INDEX "mileageEntry_userId_date_idx" ON "mileageEntry" ("userId","date");