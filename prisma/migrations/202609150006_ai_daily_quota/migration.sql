CREATE TABLE "AiDailyQuota" (
  "userId" TEXT NOT NULL,
  "day" DATE NOT NULL,
  "scanCount" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "AiDailyQuota_pkey" PRIMARY KEY ("userId", "day"),
  CONSTRAINT "AiDailyQuota_scanCount_check" CHECK ("scanCount" >= 0),
  CONSTRAINT "AiDailyQuota_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
