CREATE TABLE "WeightLog" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "weightKg" DOUBLE PRECISION NOT NULL,
  "heightCm" DOUBLE PRECISION NOT NULL, "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WeightLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WeightLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "WeightLog_userId_loggedAt_idx" ON "WeightLog"("userId", "loggedAt");
