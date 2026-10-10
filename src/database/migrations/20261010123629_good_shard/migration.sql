ALTER TABLE "engineExperiment" ADD COLUMN "channelKey" text;--> statement-breakpoint
ALTER TABLE "engineExperiment" ADD COLUMN "audience" jsonb DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "engineMetricsDaily" ADD COLUMN "platformConversions" integer;--> statement-breakpoint
ALTER TABLE "engineMetricsDaily" ADD COLUMN "platformRevenueMinor" integer;--> statement-breakpoint
ALTER TABLE "engineWorkspace" ADD COLUMN "globalHoldoutRate" real DEFAULT 0.05 NOT NULL;