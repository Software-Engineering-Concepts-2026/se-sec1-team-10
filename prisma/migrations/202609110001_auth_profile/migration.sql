CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "age" INTEGER,
  "weightKg" DOUBLE PRECISION,
  "heightCm" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "User_age_check" CHECK ("age" BETWEEN 1 AND 120),
  CONSTRAINT "User_weight_check" CHECK ("weightKg" > 0 AND "weightKg" <= 500),
  CONSTRAINT "User_height_check" CHECK ("heightCm" >= 30 AND "heightCm" <= 250)
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE TABLE "Session" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
