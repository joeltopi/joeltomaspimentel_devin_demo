-- CreateTable
CREATE TABLE "FraudHeldTransaction" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "merchant" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "destinationKnown" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "riskReasons" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'held',
    "assigneeId" TEXT,
    "assigneeName" TEXT,
    "decisionBy" TEXT,
    "decisionNote" TEXT,
    "heldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FraudHeldTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FraudHeldTransaction_status_idx" ON "FraudHeldTransaction"("status");

-- CreateIndex
CREATE INDEX "FraudHeldTransaction_channel_idx" ON "FraudHeldTransaction"("channel");

-- CreateIndex
CREATE INDEX "FraudHeldTransaction_riskScore_idx" ON "FraudHeldTransaction"("riskScore");
