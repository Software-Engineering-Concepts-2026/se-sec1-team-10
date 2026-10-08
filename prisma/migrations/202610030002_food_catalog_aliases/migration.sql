ALTER TABLE "Food" ADD COLUMN "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
CREATE INDEX "Food_aliases_idx" ON "Food" USING GIN ("aliases");
