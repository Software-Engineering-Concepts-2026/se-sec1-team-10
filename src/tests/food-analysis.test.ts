import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { User } from '@prisma/client';
import { createApp } from '../server/app.js';
import type { Repository } from '../server/repository.js';
import type { ExerciseInput, ExerciseRecord, GoalInput, MealInput, MealRecord, ProfileInput } from '../shared/contracts.js';

class MemoryRepository implements Repository {
  users = new Map<string, User>();
  sessions = new Map<string, { id: string; userId: string; expiresAt: Date }>();
  meals = new Map<string, MealRecord>();
  aiQuotas = new Map<string, number>();
  async findUserByEmail(email: string) { return [...this.users.values()].find(user => user.email === email) ?? null; }
  async findUserById(id: string) { return this.users.get(id) ?? null; }
  async createUser(data: { email: string; displayName: string; passwordHash: string }) {
    const now = new Date(); const user: User = { id: randomUUID(), ...data, age: null, weightKg: null, heightCm: null, targetWeightKg: null, dailyCalorieTarget: null, createdAt: now, updatedAt: now };
    this.users.set(user.id, user); return user;
  }
  async updateProfile(id: string, data: ProfileInput) { const user = this.users.get(id)!; const updated = { ...user, ...data, updatedAt: new Date() }; this.users.set(id, updated); return updated; }
  async updateGoals(id: string, data: GoalInput) { return this.updateProfile(id, data as ProfileInput); }
  async addWeightLog() {}
  async listWeightLogs() { return []; }
  async createSession(userId: string, expiresAt: Date) { const session = { id: randomUUID(), userId, expiresAt }; this.sessions.set(session.id, session); return session; }
  async touchSession(id: string, userId: string, now: Date, expiresAt: Date) { const session = this.sessions.get(id); if (!session || session.userId !== userId || session.expiresAt <= now) return false; session.expiresAt = expiresAt; return true; }
  async deleteSession(id: string) { this.sessions.delete(id); }
  async listExercises(): Promise<ExerciseRecord[]> { return []; }
  async createExercise(_userId: string, _data: ExerciseInput, _weightKg: number, _caloriesBurned: number): Promise<ExerciseRecord> { throw new Error('unused'); }
  async updateExercise(): Promise<ExerciseRecord | null> { return null; }
  async deleteExercise() { return false; }
  async listMeals() { return [...this.meals.values()]; }
  async createMeal(userId: string, data: MealInput, totalCalories: number) { const meal: MealRecord = { id: randomUUID(), userId, ...data, imageData: data.imageData ?? null, totalCalories, createdAt: new Date(), updatedAt: new Date(), ingredients: data.ingredients.map(ingredient => ({ id: randomUUID(), ...ingredient })) }; this.meals.set(meal.id, meal); return meal; }
  async updateMeal(): Promise<MealRecord | null> { return null; }
  async deleteMeal() { return false; }
  async claimDailyAiScan(userId: string, day: Date, limit: number) {
    const key = `${userId}:${day.toISOString().slice(0, 10)}`;
    const used = this.aiQuotas.get(key) ?? 0;
    if (used >= limit) return false;
    this.aiQuotas.set(key, used + 1);
    return true;
  }
}

const origin = 'http://localhost:5173';
const secret = 'test-only-secret-with-at-least-32-characters';
const account = { displayName: 'Food tester', email: 'food@example.com', password: 'ValidPassword123!' };
const imageData = 'data:image/png;base64,AAAA';
let repository: MemoryRepository;
let app: ReturnType<typeof createApp>;

const cookie = (response: request.Response) => (response.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
async function signIn() {
  await request(app).post('/api/auth/register').set('Origin', origin).send(account).expect(201);
  return cookie(await request(app).post('/api/auth/login').set('Origin', origin).send(account).expect(200));
}
const providerResponse = (payload: unknown) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
const validEstimate = { name: 'Chicken rice', mealType: 'lunch', ingredients: [{ name: 'Rice', carbsGrams: 50, sugarGrams: 1, proteinGrams: 5, fatGrams: 2 }], portionDescription: 'One plate', notes: ['Estimate only'] };

beforeEach(() => {
  repository = new MemoryRepository();
  app = createApp(repository, { jwtSecret: secret, appOrigin: origin });
});

describe('food image analysis', () => {
  it('returns 503 when the optional AI service is not configured', async () => {
    const auth = await signIn();
    const response = await request(app).post('/api/meals/analyze').set('Origin', origin).set('Cookie', auth).send({ imageData });
    expect(response.status).toBe(503);
    expect(response.body.message).toBeTruthy();
  });

  it('requires authentication before attempting analysis', async () => {
    await request(app).post('/api/meals/analyze').set('Origin', origin).send({ imageData }).expect(401);
  });

  it('rejects non-image payloads before calling the provider', async () => {
    const fetch = async () => { throw new Error('provider must not be called'); };
    app = createApp(repository, { jwtSecret: secret, appOrigin: origin, ai: { baseUrl: 'https://provider.test/v1/chat/completions', apiKey: 'secret', model: 'food', fetch } });
    const auth = await signIn();
    await request(app).post('/api/meals/analyze').set('Origin', origin).set('Cookie', auth).send({ imageData: 'not-an-image' }).expect(400);
  });

  it.each([
    ['malformed provider JSON', providerResponse({ name: 'missing fields' })],
    ['nonnumeric nutrition', providerResponse({ ...validEstimate, ingredients: [{ ...validEstimate.ingredients[0], carbsGrams: 'many' }] })],
  ])('sanitizes %s as a provider failure', async (_label, response) => {
    app = createApp(repository, { jwtSecret: secret, appOrigin: origin, ai: { baseUrl: 'https://provider.test/v1/chat/completions', apiKey: 'secret', model: 'food', fetch: async () => response } });
    const auth = await signIn();
    const result = await request(app).post('/api/meals/analyze').set('Origin', origin).set('Cookie', auth).send({ imageData });
    expect(result.status).toBe(502);
    expect(result.body.message).not.toMatch(/missing fields|many|provider\.test|secret/i);
  });

  it('returns 422 for a provider response that explicitly identifies a non-food image', async () => {
    app = createApp(repository, { jwtSecret: secret, appOrigin: origin, ai: { baseUrl: 'https://provider.test/v1/chat/completions', apiKey: 'secret', model: 'food', fetch: async () => providerResponse({ error: 'not-food' }) } });
    const auth = await signIn();
    const result = await request(app).post('/api/meals/analyze').set('Origin', origin).set('Cookie', auth).send({ imageData });
    expect(result.status).toBe(422);
    expect(result.body).toMatchObject({ error: 'not-food' });
  });

  it('normalizes a valid single provider note into the notes array', async () => {
    app = createApp(repository, { jwtSecret: secret, appOrigin: origin, ai: {
      baseUrl: 'https://provider.test/v1/chat/completions', apiKey: 'secret', model: 'food',
      fetch: async () => providerResponse({ ...validEstimate, notes: 'ประเมินจากภาพ' }),
    } });
    const auth = await signIn();
    const result = await request(app).post('/api/meals/analyze').set('Origin', origin).set('Cookie', auth).send({ imageData }).expect(200);
    expect(result.body.analysis.notes).toContain('ประเมินจากภาพ');
  });

  it('enforces the configured daily scan budget per account', async () => {
    app = createApp(repository, { jwtSecret: secret, appOrigin: origin, ai: { baseUrl: 'https://provider.test/v1/chat/completions', apiKey: 'secret', model: 'food', dailyScanLimit: 1, fetch: async () => providerResponse(validEstimate) } });
    const auth = await signIn();
    await request(app).post('/api/meals/analyze').set('Origin', origin).set('Cookie', auth).send({ imageData }).expect(200);
    const second = await request(app).post('/api/meals/analyze').set('Origin', origin).set('Cookie', auth).send({ imageData }).expect(429);
    expect(second.body.message).toMatch(/โควต้า|quota/i);
  });

  it('requires configured nutrition search and maps USDA nutrient IDs', async () => {
    const authApp = createApp(repository, { jwtSecret: secret, appOrigin: origin });
    app = authApp;
    const auth = await signIn();
    await request(app).get('/api/foods/search?q=rice').set('Cookie', auth).expect(503);
    app = createApp(repository, { jwtSecret: secret, appOrigin: origin, nutrition: { apiKey: 'key', fetch: async () => new Response(JSON.stringify({ foods: [{ fdcId: 123, description: 'Rice', dataType: 'Foundation', foodNutrients: [{ nutrientId: 1008, value: 130 }, { nutrientId: 1005, value: 28 }, { nutrientId: 1003, value: 3 }, { nutrientId: 1004, value: 0.3 }, { nutrientId: 2000, value: 0.1 }] }] })) } });
    const configuredAuth = await request(app).post('/api/auth/login').set('Origin', origin).send(account).expect(200).then(cookie);
    const result = await request(app).get('/api/foods/search?q=rice').set('Cookie', configuredAuth).expect(200);
    expect(result.body.foods[0]).toMatchObject({ fdcId: 123, source: 'usda-fdc', nutrientsPer100g: { caloriesKcal: 130, carbsGrams: 28, proteinGrams: 3, fatGrams: 0.3, sugarGrams: 0.1 } });
  });

  it('maps provider errors and timeouts to safe statuses', async () => {
    const errorApp = (fetch: typeof globalThis.fetch) => createApp(repository, { jwtSecret: secret, appOrigin: origin, ai: { baseUrl: 'https://provider.test/v1/chat/completions', apiKey: 'secret', model: 'food', fetch, timeoutMs: 1000 } });
    app = errorApp(async () => new Response('private upstream failure', { status: 500 }));
    let auth = await signIn();
    let result = await request(app).post('/api/meals/analyze').set('Origin', origin).set('Cookie', auth).send({ imageData });
    expect(result.status).toBe(502);
    app = errorApp(async (_url, init) => new Promise((_resolve, reject) => { init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))); }));
    auth = await signIn();
    result = await request(app).post('/api/meals/analyze').set('Origin', origin).set('Cookie', auth).send({ imageData });
    expect(result.status).toBe(504);
    expect(result.body.message).not.toMatch(/private|upstream|AbortError|provider\.test/i);
  });

  it('returns a preview and does not persist a meal', async () => {
    app = createApp(repository, { jwtSecret: secret, appOrigin: origin, ai: { baseUrl: 'https://provider.test/v1/chat/completions', apiKey: 'secret', model: 'food', fetch: async () => providerResponse(validEstimate) } });
    const auth = await signIn();
    const result = await request(app).post('/api/meals/analyze').set('Origin', origin).set('Cookie', auth).send({ imageData }).expect(200);
    expect(result.body.analysis).toMatchObject({ name: validEstimate.name, source: 'ai-estimate' });
    expect(result.body.analysis.notes.join(' ')).toMatch(/ตรวจสอบส่วนผสม|confirm ingredients/i);
    expect(repository.meals.size).toBe(0);
  });
});
