ALTER TABLE "User" ADD COLUMN "targetWeightKg" DOUBLE PRECISION;
ALTER TABLE "User" ADD COLUMN "dailyCalorieTarget" INTEGER;
ALTER TABLE "User" ADD CONSTRAINT "User_targetWeightKg_check" CHECK ("targetWeightKg" IS NULL OR ("targetWeightKg" > 0 AND "targetWeightKg" <= 500));
ALTER TABLE "User" ADD CONSTRAINT "User_dailyCalorieTarget_check" CHECK ("dailyCalorieTarget" IS NULL OR ("dailyCalorieTarget" BETWEEN 1 AND 100000));
