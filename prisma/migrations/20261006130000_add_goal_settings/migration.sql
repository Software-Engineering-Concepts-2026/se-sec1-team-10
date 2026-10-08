-- Additive: existing manual targets and account data remain unchanged.
ALTER TABLE "User" ADD COLUMN "goalSettings" JSONB;
