-- CreateTable
CREATE TABLE "Food" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "caloriesKcal" DOUBLE PRECISION NOT NULL,
    "carbsGrams" DOUBLE PRECISION,
    "sugarGrams" DOUBLE PRECISION,
    "proteinGrams" DOUBLE PRECISION,
    "fatGrams" DOUBLE PRECISION,
    "servingAmount" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "servingUnit" TEXT NOT NULL DEFAULT 'serving',
    "imageUrl" TEXT,
    "createdByUserId" TEXT,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Food_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Food_name_idx" ON "Food"("name");
