import type { PrismaClient, User } from '@prisma/client';
import type { ExerciseInput, ExerciseRecord, ProfileInput } from '../shared/contracts.js';

export interface Repository {
  findUserByEmail(email: string): Promise<User | null>;
  findUserById(id: string): Promise<User | null>;
  createUser(data: { email: string; displayName: string; passwordHash: string }): Promise<User>;
  updateProfile(id: string, data: ProfileInput): Promise<User>;
  createSession(userId: string, expiresAt: Date): Promise<{ id: string }>;
  touchSession(id: string, userId: string, now: Date, expiresAt: Date): Promise<boolean>;
  deleteSession(id: string): Promise<void>;
  listExercises(userId: string, start: Date, end: Date): Promise<ExerciseRecord[]>;
  createExercise(userId: string, data: ExerciseInput, weightKg: number, caloriesBurned: number): Promise<ExerciseRecord>;
  updateExercise(id: string, userId: string, data: ExerciseInput, weightKg: number, caloriesBurned: number): Promise<ExerciseRecord | null>;
  deleteExercise(id: string, userId: string): Promise<boolean>;
}

export class DuplicateEmailError extends Error {}

export function prismaRepository(db: PrismaClient): Repository {
  const exerciseRecord = (record: {
    id: string; userId: string; activityType: string; durationMinutes: number; weightKg: number;
    caloriesBurned: number; activityDate: Date; createdAt: Date; updatedAt: Date;
  }): ExerciseRecord => ({ ...record, activityDate: record.activityDate.toISOString().slice(0, 10) });
  return {
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
  };
}
