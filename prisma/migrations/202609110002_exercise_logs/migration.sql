CREATE TABLE "ExerciseLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "activityType" TEXT NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "weightKg" DOUBLE PRECISION NOT NULL,
  "caloriesBurned" INTEGER NOT NULL,
  "activityDate" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExerciseLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExerciseLog_duration_check" CHECK ("durationMinutes" BETWEEN 1 AND 1440),
  CONSTRAINT "ExerciseLog_weight_check" CHECK ("weightKg" > 0 AND "weightKg" <= 500),
  CONSTRAINT "ExerciseLog_calories_check" CHECK ("caloriesBurned" >= 0),
  CONSTRAINT "ExerciseLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ExerciseLog_userId_activityDate_idx" ON "ExerciseLog"("userId", "activityDate");
