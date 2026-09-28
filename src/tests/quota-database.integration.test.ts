import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { prismaRepository } from '../server/repository.js';

// This test is intentionally opt-in so normal unit tests never need a database.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const databaseDescribe = testDatabaseUrl ? describe : describe.skip;
const createClient = () => new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });

databaseDescribe('PostgreSQL AI daily quota integration', () => {
  it('atomically caps concurrent requests and persists independent user/day quotas', async () => {
    const clients = Array.from({ length: 6 }, createClient);
    const day = new Date('2031-06-15T17:00:00.000Z');
    const otherDay = new Date('2031-06-16T00:00:00.000Z');
    const userId = randomUUID();
    const otherUserId = randomUUID();
    let originalsClosed = false;
    let reconnect: PrismaClient | undefined;
    try {
      await clients[0].user.create({ data: {
        id: userId, email: `quota-${userId}@test.invalid`, passwordHash: 'test-only-hash', displayName: 'Quota test',
      } });
      await clients[0].user.create({ data: {
        id: otherUserId, email: `quota-${otherUserId}@test.invalid`, passwordHash: 'test-only-hash', displayName: 'Quota test',
      } });

      const claims = await Promise.all(clients.map(client => prismaRepository(client).claimDailyAiScan(userId, day, 3)));
      expect(claims.filter(Boolean)).toHaveLength(3);

      await Promise.all(clients.map(client => client.$disconnect()));
      originalsClosed = true;
      reconnect = createClient();
      await expect(prismaRepository(reconnect).claimDailyAiScan(userId, day, 3)).resolves.toBe(false);
      await expect(prismaRepository(reconnect).claimDailyAiScan(userId, otherDay, 3)).resolves.toBe(true);
      await expect(prismaRepository(reconnect).claimDailyAiScan(otherUserId, day, 3)).resolves.toBe(true);
    } finally {
      if (!originalsClosed) await Promise.all(clients.map(client => client.$disconnect()));
      if (reconnect) await reconnect.$disconnect();
      const cleanup = createClient();
      try {
        await cleanup.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
      } finally { await cleanup.$disconnect(); }
    }
  });
});
