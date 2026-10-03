import type { CatalogFood } from '../shared/foodCatalog.js';
import { catalogFood, normalizeFoodSearch } from './foodCatalog.js';
import { Prisma, type PrismaClient, type User } from '@prisma/client';
import type { ExerciseInput, ExerciseRecord, GoalInput, MealInput, MealRecord, ProfileInput } from '../shared/contracts.js';
import { calculatedIngredient, scaleReferenceNutrients } from './meal.js';

export interface Repository {
  searchFoods(userId: string, query: string): Promise<CatalogFood[]>;
  findUserByEmail(email: string): Promise<User | null>;
  findUserById(id: string): Promise<User | null>;
  createUser(data: { email: string; displayName: string; passwordHash: string }): Promise<User>;
  updateProfile(id: string, data: ProfileInput): Promise<User>;
  addWeightLog(userId: string, weightKg: number, heightCm: number): Promise<void>;
  listWeightLogs(userId: string, start: Date): Promise<{ weightKg: number; heightCm: number; loggedAt: Date }[]>;
  updateGoals(id: string, data: GoalInput): Promise<User>;
  createSession(userId: string, expiresAt: Date): Promise<{ id: string }>;
  touchSession(id: string, userId: string, now: Date, expiresAt: Date): Promise<boolean>;
  deleteSession(id: string): Promise<void>;
  listExercises(userId: string, start: Date, end: Date): Promise<ExerciseRecord[]>;
  createExercise(userId: string, data: ExerciseInput, weightKg: number, caloriesBurned: number): Promise<ExerciseRecord>;
  updateExercise(id: string, userId: string, data: ExerciseInput, weightKg: number, caloriesBurned: number): Promise<ExerciseRecord | null>;
  deleteExercise(id: string, userId: string): Promise<boolean>;
  listMeals(userId: string, start: Date, end: Date): Promise<MealRecord[]>;
  createMeal(userId: string, data: MealInput, totalCalories: number): Promise<MealRecord>;
  updateMeal(id: string, userId: string, data: MealInput, totalCalories: number): Promise<MealRecord | null>;
  deleteMeal(id: string, userId: string): Promise<boolean>;
  /** Atomically reserves one analysis attempt for this user and UTC calendar day. */
  claimDailyAiScan(userId: string, day: Date, limit: number): Promise<boolean>;
}

export class DuplicateEmailError extends Error {}

export function prismaRepository(db: PrismaClient): Repository {
  const exerciseRecord = (record: {
    id: string; userId: string; activityType: string; durationMinutes: number; weightKg: number;
    caloriesBurned: number; activityDate: Date; createdAt: Date; updatedAt: Date;
  }): ExerciseRecord => ({ ...record, activityDate: record.activityDate.toISOString().slice(0, 10) });
  const mealRecord = (record: {
    id: string; userId: string; name: string; mealType: string; imageData: string | null; totalCalories: number;
    activityDate: Date; createdAt: Date; updatedAt: Date;
    ingredients: { id: string; mealLogId: string; name: string; carbsGrams: number; sugarGrams: number; proteinGrams: number; fatGrams: number; amount: number; unit: string; referenceAmount: number; referenceUnit: string; source: string; referenceCaloriesKcal: number | null; referenceCarbsGrams: number | null; referenceSugarGrams: number | null; referenceProteinGrams: number | null; referenceFatGrams: number | null }[];
  }): MealRecord => ({ ...record, mealType: record.mealType as MealRecord['mealType'], activityDate: record.activityDate.toISOString().slice(0, 10), ingredients: record.ingredients.map(({ mealLogId: _mealLogId, referenceCaloriesKcal, referenceCarbsGrams, referenceSugarGrams, referenceProteinGrams, referenceFatGrams, unit, referenceUnit, source, ...ingredient }) => ({ ...ingredient, ...scaleReferenceNutrients({ caloriesKcal: referenceCaloriesKcal, carbsGrams: referenceCarbsGrams, sugarGrams: referenceSugarGrams, proteinGrams: referenceProteinGrams, fatGrams: referenceFatGrams }, ingredient.amount, ingredient.referenceAmount), unit: unit as 'g' | 'serving', referenceUnit: referenceUnit as 'g' | 'serving', source: source as MealRecord['ingredients'][number]['source'], referenceNutrients: { caloriesKcal: referenceCaloriesKcal, carbsGrams: referenceCarbsGrams, sugarGrams: referenceSugarGrams, proteinGrams: referenceProteinGrams, fatGrams: referenceFatGrams } })) });
  return {
    async searchFoods(userId, query) {
      const term = normalizeFoodSearch(query);
      const foods = await db.food.findMany({
        where: {
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { aliases: { has: term } },
          ],
          AND: [
            { OR: [{ createdByUserId: userId }, { createdByUserId: null, isCustom: false }] },
            { OR: [{ servingWeightGrams: { gt: 0 } }, { servingWeightGrams: null, servingUnit: 'g', servingAmount: { gt: 0 } }] },
          ],
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        take: 30,
      });
      return foods.map(catalogFood).filter((food): food is CatalogFood => food !== null);
    },
    findUserByEmail: email => db.user.findUnique({ where: { email } }),
    findUserById: id => db.user.findUnique({ where: { id } }),
    async createUser(data) {
      try { return await db.user.create({ data }); }
      catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
          throw new DuplicateEmailError();
        }
        throw error;
      }
    },
    updateProfile: (id, data) => db.user.update({ where: { id }, data }),
    async addWeightLog(userId, weightKg, heightCm) { await db.weightLog.create({ data: { userId, weightKg, heightCm } }); },
    listWeightLogs: (userId, start) => db.weightLog.findMany({ where: { userId, loggedAt: { gte: start } }, orderBy: { loggedAt: 'asc' }, select: { weightKg: true, heightCm: true, loggedAt: true } }),
    updateGoals: (id, data) => db.user.update({ where: { id }, data }),
    async createSession(userId, expiresAt) {
      // Clean up expired sessions without ending active sessions on other devices.
      await db.session.deleteMany({ where: { userId, expiresAt: { lte: new Date() } } });
      return db.session.create({ data: { userId, expiresAt } });
    },
    async touchSession(id, userId, now, expiresAt) {
      const result = await db.session.updateMany({
        where: { id, userId, expiresAt: { gt: now } }, data: { expiresAt },
      });
      return result.count === 1;
    },
    async deleteSession(id) { await db.session.deleteMany({ where: { id } }); },
    async listExercises(userId, start, end) {
      const records = await db.exerciseLog.findMany({
        where: { userId, activityDate: { gte: start, lt: end } }, orderBy: [{ activityDate: 'desc' }, { createdAt: 'desc' }],
      });
      return records.map(exerciseRecord);
    },
    async createExercise(userId, data, weightKg, caloriesBurned) {
      const record = await db.exerciseLog.create({ data: {
        userId, activityType: data.activityType, durationMinutes: data.durationMinutes,
        activityDate: new Date(`${data.activityDate}T00:00:00.000Z`), weightKg, caloriesBurned,
      } });
      return exerciseRecord(record);
    },
    async updateExercise(id, userId, data, weightKg, caloriesBurned) {
      const result = await db.exerciseLog.updateMany({ where: { id, userId }, data: {
        activityType: data.activityType, durationMinutes: data.durationMinutes,
        activityDate: new Date(`${data.activityDate}T00:00:00.000Z`), weightKg, caloriesBurned,
      } });
      if (result.count !== 1) return null;
      const record = await db.exerciseLog.findUnique({ where: { id } });
      return record ? exerciseRecord(record) : null;
    },
    async deleteExercise(id, userId) {
      return (await db.exerciseLog.deleteMany({ where: { id, userId } })).count === 1;
    },
    async listMeals(userId, start, end) {
      const records = await db.mealLog.findMany({
        where: { userId, activityDate: { gte: start, lt: end } }, orderBy: [{ activityDate: 'desc' }, { createdAt: 'desc' }], include: { ingredients: true },
      });
      return records.map(mealRecord);
    },
    async createMeal(userId, data, totalCalories) {
      const record = await db.mealLog.create({ data: {
        userId, name: data.name, mealType: data.mealType, imageData: data.imageData ?? null, totalCalories,
        activityDate: new Date(`${data.activityDate}T00:00:00.000Z`),
        ingredients: { create: data.ingredients.map(input => { const calculated = calculatedIngredient(input); return { name: input.name, amount: input.amount, unit: input.unit, referenceAmount: input.referenceAmount, referenceUnit: input.referenceUnit, source: input.source, carbsGrams: calculated.carbsGrams ?? 0, sugarGrams: calculated.sugarGrams ?? 0, proteinGrams: calculated.proteinGrams ?? 0, fatGrams: calculated.fatGrams ?? 0, referenceCaloriesKcal: input.referenceNutrients.caloriesKcal, referenceCarbsGrams: input.referenceNutrients.carbsGrams, referenceSugarGrams: input.referenceNutrients.sugarGrams, referenceProteinGrams: input.referenceNutrients.proteinGrams, referenceFatGrams: input.referenceNutrients.fatGrams }; }) },
      }, include: { ingredients: true } });
      return mealRecord(record);
    },
    async updateMeal(id, userId, data, totalCalories) {
      const result = await db.mealLog.updateMany({ where: { id, userId }, data: {
        name: data.name, mealType: data.mealType, imageData: data.imageData ?? null, totalCalories,
        activityDate: new Date(`${data.activityDate}T00:00:00.000Z`),
      } });
      if (result.count !== 1) return null;
      await db.mealIngredient.deleteMany({ where: { mealLogId: id } });
      await db.mealIngredient.createMany({ data: data.ingredients.map(input => { const calculated = calculatedIngredient(input); return { mealLogId: id, name: input.name, amount: input.amount, unit: input.unit, referenceAmount: input.referenceAmount, referenceUnit: input.referenceUnit, source: input.source, carbsGrams: calculated.carbsGrams ?? 0, sugarGrams: calculated.sugarGrams ?? 0, proteinGrams: calculated.proteinGrams ?? 0, fatGrams: calculated.fatGrams ?? 0, referenceCaloriesKcal: input.referenceNutrients.caloriesKcal, referenceCarbsGrams: input.referenceNutrients.carbsGrams, referenceSugarGrams: input.referenceNutrients.sugarGrams, referenceProteinGrams: input.referenceNutrients.proteinGrams, referenceFatGrams: input.referenceNutrients.fatGrams }; }) });
      const record = await db.mealLog.findUnique({ where: { id }, include: { ingredients: true } });
      return record ? mealRecord(record) : null;
    },
    async deleteMeal(id, userId) {
      return (await db.mealLog.deleteMany({ where: { id, userId } })).count === 1;
    },
    async claimDailyAiScan(userId, day, limit) {
      const quotaDay = new Date(`${day.toISOString().slice(0, 10)}T00:00:00.000Z`);
      const claimed = await db.$queryRaw<{ scanCount: number }[]>(Prisma.sql`
        INSERT INTO "AiDailyQuota" ("userId", "day", "scanCount")
        VALUES (${userId}, ${quotaDay}, 1)
        ON CONFLICT ("userId", "day") DO UPDATE
        SET "scanCount" = "AiDailyQuota"."scanCount" + 1
        WHERE "AiDailyQuota"."scanCount" < ${limit}
        RETURNING "scanCount"
      `);
      return claimed.length === 1;
    },
  };
}
