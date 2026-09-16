import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../server/app.js';
import { prismaRepository } from '../server/repository.js';

// Opt in with a migrated local test database; cleanup only accounts created here.
describe.skipIf(!process.env.TEST_DATABASE_URL)('real PostgreSQL application lifecycle', () => {
  it('persists sessions and records across app instances, isolates users, and updates totals', async () => {
    const db = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL });
    const secondDb = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL });
    const emails = [0, 1].map(() => `integration-${randomUUID()}@example.test`);
    const config = { jwtSecret: randomUUID() + randomUUID(), appOrigin: 'http://127.0.0.1:5173' };
    const app = createApp(prismaRepository(db), config);
    const first = request.agent(app);
    const other = request.agent(app);
    const date = new Date().toISOString().slice(0, 10);
    const meal = { name: 'ข้าวทดสอบ', mealType: 'lunch', activityDate: date, ingredients: [{ name: 'ข้าว', carbsGrams: 50, sugarGrams: 2, proteinGrams: 5, fatGrams: 2 }] };
    try {
      for (const [index, agent] of [first, other].entries()) {
        const credentials = { email: emails[index], password: 'IntegrationPassword123!' };
        await agent.post('/api/auth/register').set('Origin', config.appOrigin).send({ ...credentials, displayName: 'Integration' }).expect(201);
        await agent.post('/api/auth/login').set('Origin', config.appOrigin).send(credentials).expect(200);
      }
      await first.put('/api/profile').set('Origin', config.appOrigin).send({ displayName: 'Integration', age: 30, weightKg: 70, heightCm: 175 }).expect(200);
      await first.put('/api/goals').set('Origin', config.appOrigin).send({ targetWeightKg: 65, dailyCalorieTarget: 2000 }).expect(200);
      const saved = await first.post('/api/meals').set('Origin', config.appOrigin).send(meal).expect(201);
      expect(saved.body.meal.totalCalories).toBe(238);
      expect(Object.keys(saved.body.meal.ingredients[0]).sort()).toEqual(['id', 'name', 'carbsGrams', 'sugarGrams', 'proteinGrams', 'fatGrams'].sort());
      const mealId = saved.body.meal.id;
      const exerciseInput = { activityType: 'walking', durationMinutes: 30, activityDate: date };
      const exercise = await first.post('/api/exercises').set('Origin', config.appOrigin).send(exerciseInput).expect(201);
      const exerciseId = exercise.body.exercise.id;
      await other.put(`/api/meals/${mealId}`).set('Origin', config.appOrigin).send(meal).expect(404);
      await other.delete(`/api/exercises/${exerciseId}`).set('Origin', config.appOrigin).send({}).expect(404);
      expect((await other.get(`/api/meals/daily?date=${date}`).expect(200)).body.meals).toHaveLength(0);
      const login = await first.post('/api/auth/login').set('Origin', config.appOrigin).send({ email: emails[0], password: 'IntegrationPassword123!' }).expect(200);
      const cookie = login.headers['set-cookie'][0].split(';')[0];
      await db.$disconnect();
      const restarted = request(createApp(prismaRepository(secondDb), config));
      const profile = await restarted.get('/api/auth/me').set('Cookie', cookie).expect(200);
      expect(profile.body.user.dailyCalorieTarget).toBe(2000);
      expect((await restarted.get(`/api/meals/daily?date=${date}`).set('Cookie', cookie).expect(200)).body.caloriesConsumed).toBe(238);
      const updated = { ...meal, ingredients: [{ ...meal.ingredients[0], carbsGrams: 60 }] };
      await restarted.put(`/api/meals/${mealId}`).set('Cookie', cookie).set('Origin', config.appOrigin).send(updated).expect(200);
      await restarted.put(`/api/exercises/${exerciseId}`).set('Cookie', cookie).set('Origin', config.appOrigin).send({ ...exerciseInput, durationMinutes: 45 }).expect(200);
      const daily = await restarted.get(`/api/exercises/daily?date=${date}`).set('Cookie', cookie).expect(200);
      expect(daily.body.caloriesConsumed).toBe(278);
      expect(daily.body.netCalories).toBe(278 - daily.body.caloriesBurned);
      expect(daily.body.caloriesBurned).toBeGreaterThan(exercise.body.exercise.caloriesBurned);
      expect((await restarted.get(`/api/meals/history?from=${date}&to=${date}`).set('Cookie', cookie).expect(200)).body.meals).toHaveLength(1);
      expect((await restarted.get(`/api/summary/weekly?date=${date}`).set('Cookie', cookie).expect(200)).body.caloriesConsumed).toBe(278);
      expect((await restarted.get('/api/health-history').set('Cookie', cookie).expect(200)).body.points).toHaveLength(1);
      await restarted.delete(`/api/meals/${mealId}`).set('Cookie', cookie).set('Origin', config.appOrigin).send({}).expect(204);
      await restarted.delete(`/api/exercises/${exerciseId}`).set('Cookie', cookie).set('Origin', config.appOrigin).send({}).expect(204);
      expect((await restarted.get(`/api/exercises/daily?date=${date}`).set('Cookie', cookie).expect(200)).body.netCalories).toBe(0);
      await restarted.post('/api/auth/logout').set('Cookie', cookie).set('Origin', config.appOrigin).send({}).expect(204);
      await restarted.get('/api/auth/me').set('Cookie', cookie).expect(401);
    } finally {
      await secondDb.user.deleteMany({ where: { email: { in: emails } } });
      await Promise.all([db.$disconnect(), secondDb.$disconnect()]);
    }
  }, 30000);
});
