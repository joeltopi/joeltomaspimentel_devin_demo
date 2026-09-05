-- CreateTable
CREATE TABLE "KycCase" (
    "id" TEXT NOT NULL,
    "applicantName" TEXT NOT NULL,
    "applicantEmail" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentRef" TEXT NOT NULL,
    "riskFlags" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'pending',
    "assigneeId" TEXT,
    "assigneeName" TEXT,
    "decisionBy" TEXT,
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KycCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KycCase_status_idx" ON "KycCase"("status");

-- CreateIndex
CREATE INDEX "KycCase_country_idx" ON "KycCase"("country");
