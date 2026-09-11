CREATE TABLE "MealLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "mealType" TEXT NOT NULL,
  "imageData" TEXT,
  "totalCalories" INTEGER NOT NULL,
  "activityDate" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MealLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MealLog_totalCalories_check" CHECK ("totalCalories" >= 0),
  CONSTRAINT "MealLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "MealIngredient" (
  "id" TEXT NOT NULL,
  "mealLogId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "carbsGrams" DOUBLE PRECISION NOT NULL,
  "sugarGrams" DOUBLE PRECISION NOT NULL,
  "proteinGrams" DOUBLE PRECISION NOT NULL,
  "fatGrams" DOUBLE PRECISION NOT NULL,
  CONSTRAINT "MealIngredient_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MealIngredient_values_check" CHECK ("carbsGrams" >= 0 AND "sugarGrams" >= 0 AND "proteinGrams" >= 0 AND "fatGrams" >= 0),
  CONSTRAINT "MealIngredient_mealLogId_fkey" FOREIGN KEY ("mealLogId") REFERENCES "MealLog"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "MealLog_userId_activityDate_idx" ON "MealLog"("userId", "activityDate");
CREATE INDEX "MealIngredient_mealLogId_idx" ON "MealIngredient"("mealLogId");
