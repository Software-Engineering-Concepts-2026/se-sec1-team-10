import { describe, expect, it } from 'vitest';
import type { Prisma } from '@prisma/client';
import { prismaRepository } from '../server/repository.js';

describe('persistent daily AI quota', () => {
  it('uses one conditional upsert to reserve a scan atomically', async () => {
    const statements: Prisma.Sql[] = [];
    const db = {
      $queryRaw: async (statement: Prisma.Sql) => {
        statements.push(statement);
        return [{ scanCount: 2 }];
      },
    };
    const repository = prismaRepository(db as never);

    await expect(repository.claimDailyAiScan('user-a', new Date('2026-09-16T15:40:00.000Z'), 2)).resolves.toBe(true);

    expect(statements).toHaveLength(1);
    expect(statements[0].sql).toContain('INSERT INTO "AiDailyQuota"');
    expect(statements[0].sql).toContain('ON CONFLICT ("userId", "day") DO UPDATE');
    expect(statements[0].sql).toContain('WHERE "AiDailyQuota"."scanCount" <');
    expect(statements[0].sql).toContain('RETURNING "scanCount"');
    expect(statements[0].values).toEqual(['user-a', new Date('2026-09-16T00:00:00.000Z'), 2]);
  });

  it('denies a scan when the conditional upsert returns no row', async () => {
    const db = { $queryRaw: async () => [] };
    const repository = prismaRepository(db as never);

    await expect(repository.claimDailyAiScan('user-a', new Date('2026-09-16T00:00:00.000Z'), 1)).resolves.toBe(false);
  });
});
