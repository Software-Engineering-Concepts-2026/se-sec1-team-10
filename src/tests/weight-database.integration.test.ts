import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { prismaRepository } from '../server/repository.js';

describe.skipIf(!process.env.TEST_DATABASE_URL)('PostgreSQL dated weight persistence', () => {
  it('persists edits across connections and restores the latest surviving weight atomically', async () => {
    const db = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL });
    const second = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL });
    const userIds: string[] = [];
    try {
      const repo = prismaRepository(db);
      const user = await repo.createUser({ email: `${randomUUID()}@weight.example.test`, displayName: 'weight test', passwordHash: 'test-only' });
      const other = await repo.createUser({ email: `${randomUUID()}@weight.example.test`, displayName: 'other', passwordHash: 'test-only' });
      userIds.push(user.id, other.id);
      await repo.updateProfile(user.id, { displayName: 'weight test', age: 30, weightKg: 70, heightCm: 175 }, new Date('2026-10-07T08:00:00Z'));
      const newest = await repo.createWeightLog(user.id, 68, 175, new Date('2026-10-07T09:00:00Z'));
      const old = await repo.createWeightLog(user.id, 75, 175, new Date('2026-10-06T09:00:00Z'));
      expect(old.user.weightKg).toBe(68);
      const restarted = prismaRepository(second);
      expect((await restarted.findUserById(user.id))?.weightKg).toBe(68);
      expect(await restarted.updateWeightLog(newest.log.id, other.id, 90, new Date('2026-10-07T10:00:00Z'))).toBeNull();
      expect(await restarted.deleteWeightLog(newest.log.id, other.id)).toBeNull();
      const edited = await restarted.updateWeightLog(old.log.id, user.id, 74, new Date('2026-10-06T10:00:00Z'));
      expect(edited?.user.weightKg).toBe(68);
      expect((await restarted.listWeightLogs(user.id, new Date('2026-01-01'))).find(log => log.id === old.log.id)?.weightKg).toBe(74);
      expect((await restarted.deleteWeightLog(newest.log.id, user.id))?.weightKg).toBe(70);
      const profileLog = (await restarted.listWeightLogs(user.id, new Date('2026-01-01'))).find(log => log.id !== old.log.id)!;
      expect((await restarted.deleteWeightLog(profileLog.id, user.id))?.weightKg).toBe(74);
      expect((await restarted.deleteWeightLog(old.log.id, user.id))?.weightKg).toBeNull();
      expect((await repo.findUserById(user.id))?.weightKg).toBeNull();
      await Promise.all([
        repo.createWeightLog(user.id, 76, 175, new Date('2026-10-06T09:00:00Z')),
        restarted.createWeightLog(user.id, 67, 175, new Date('2026-10-07T09:00:00Z')),
      ]);
      expect((await repo.findUserById(user.id))?.weightKg).toBe(67);
    } finally {
      await db.user.deleteMany({ where: { id: { in: userIds } } });
      await Promise.all([db.$disconnect(), second.$disconnect()]);
    }
  });
});
