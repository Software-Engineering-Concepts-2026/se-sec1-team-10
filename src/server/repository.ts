import type { PrismaClient, User } from '@prisma/client';
import type { ProfileInput } from '../shared/contracts.js';

export interface Repository {
  findUserByEmail(email: string): Promise<User | null>;
  findUserById(id: string): Promise<User | null>;
  createUser(data: { email: string; displayName: string; passwordHash: string }): Promise<User>;
  updateProfile(id: string, data: ProfileInput): Promise<User>;
  createSession(userId: string, expiresAt: Date): Promise<{ id: string }>;
  touchSession(id: string, userId: string, now: Date, expiresAt: Date): Promise<boolean>;
  deleteSession(id: string): Promise<void>;
}

export class DuplicateEmailError extends Error {}

export function prismaRepository(db: PrismaClient): Repository {
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
  };
}
