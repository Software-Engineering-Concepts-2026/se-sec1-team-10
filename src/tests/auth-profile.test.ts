import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { User } from '@prisma/client';
import { createApp } from '../server/app.js';
import { DuplicateEmailError, type Repository } from '../server/repository.js';
import type { ExerciseInput, ExerciseRecord, GoalInput, MealInput, MealRecord, ProfileInput } from '../shared/contracts.js';
import { calculateBmi } from '../server/health.js';
import { calculateExerciseCalories } from '../server/exercise.js';
import { calculateMealCalories } from '../server/meal.js';
import { COOKIE_NAME, SESSION_MS, tokenService, verifyPassword } from '../server/security.js';

class MemoryRepository implements Repository {
  users = new Map<string, User>();
  sessions = new Map<string, { id: string; userId: string; expiresAt: Date }>();
  exercises = new Map<string, ExerciseRecord>();
  meals = new Map<string, MealRecord>();
  weightLogs: { userId: string; weightKg: number; heightCm: number; loggedAt: Date }[] = [];
  async findUserByEmail(email: string) { return [...this.users.values()].find(user => user.email === email) ?? null; }
  async findUserById(id: string) { return this.users.get(id) ?? null; }
  async createUser(data: { email: string; displayName: string; passwordHash: string }) {
    // Yield once so the concurrency test exercises the uniqueness check at the storage boundary.
    await Promise.resolve();
    if (await this.findUserByEmail(data.email)) throw new DuplicateEmailError();
    const now = new Date();
    const user: User = { id: randomUUID(), ...data, age: null, weightKg: null, heightCm: null, targetWeightKg: null, dailyCalorieTarget: null, createdAt: now, updatedAt: now };
    this.users.set(user.id, user); return user;
  }
  async updateProfile(id: string, data: ProfileInput) {
    const user = this.users.get(id);
    if (!user) throw new Error('User not found');
    const updated = { ...user, ...data, updatedAt: new Date() };
    this.users.set(id, updated); return updated;
  }
  async updateGoals(id: string, data: GoalInput) { return this.updateProfile(id, data as ProfileInput); }
  async addWeightLog(userId: string, weightKg: number, heightCm: number) { this.weightLogs.push({ userId, weightKg, heightCm, loggedAt: new Date() }); }
  async listWeightLogs(userId: string, start: Date) { return this.weightLogs.filter(item => item.userId === userId && item.loggedAt >= start); }
  async createSession(userId: string, expiresAt: Date) {
    const session = { id: randomUUID(), userId, expiresAt };
    this.sessions.set(session.id, session); return session;
  }
  async touchSession(id: string, userId: string, now: Date, expiresAt: Date) {
    const session = this.sessions.get(id);
    if (!session || session.userId !== userId || session.expiresAt <= now) return false;
    session.expiresAt = expiresAt; return true;
  }
  async deleteSession(id: string) { this.sessions.delete(id); }
  async listExercises(userId: string, start: Date, end: Date) {
    return [...this.exercises.values()].filter(item => item.userId === userId &&
      item.activityDate >= start.toISOString().slice(0, 10) && item.activityDate < end.toISOString().slice(0, 10));
  }
  async createExercise(userId: string, data: ExerciseInput, weightKg: number, caloriesBurned: number) {
    const now = new Date();
    const exercise: ExerciseRecord = { id: randomUUID(), userId, ...data, weightKg, caloriesBurned, createdAt: now, updatedAt: now };
    this.exercises.set(exercise.id, exercise); return exercise;
  }
  async updateExercise(id: string, userId: string, data: ExerciseInput, weightKg: number, caloriesBurned: number) {
    const current = this.exercises.get(id);
    if (!current || current.userId !== userId) return null;
    const exercise = { ...current, ...data, weightKg, caloriesBurned, updatedAt: new Date() };
    this.exercises.set(id, exercise); return exercise;
  }
  async deleteExercise(id: string, userId: string) {
    const current = this.exercises.get(id);
    return !!current && current.userId === userId && this.exercises.delete(id);
  }
  async listMeals(userId: string, start: Date, end: Date) {
    return [...this.meals.values()].filter(item => item.userId === userId && item.activityDate >= start.toISOString().slice(0, 10) && item.activityDate < end.toISOString().slice(0, 10));
  }
  async createMeal(userId: string, data: MealInput, totalCalories: number) {
    const now = new Date();
    const meal: MealRecord = { id: randomUUID(), userId, ...data, imageData: data.imageData ?? null, totalCalories, createdAt: now, updatedAt: now, ingredients: data.ingredients.map(ingredient => ({ id: randomUUID(), ...ingredient })) };
    this.meals.set(meal.id, meal); return meal;
  }
  async updateMeal(id: string, userId: string, data: MealInput, totalCalories: number) {
    const current = this.meals.get(id);
    if (!current || current.userId !== userId) return null;
    const meal: MealRecord = { ...current, ...data, imageData: data.imageData ?? null, totalCalories, updatedAt: new Date(), ingredients: data.ingredients.map(ingredient => ({ id: randomUUID(), ...ingredient })) };
    this.meals.set(id, meal); return meal;
  }
  async deleteMeal(id: string, userId: string) {
    const current = this.meals.get(id);
    return !!current && current.userId === userId && this.meals.delete(id);
  }
  reset() { this.users.clear(); this.sessions.clear(); this.exercises.clear(); this.meals.clear(); this.weightLogs = []; }
}
const repository = new MemoryRepository();
const secret = 'test-only-secret-with-at-least-32-characters';
const origin = 'http://localhost:5173';
let date: Date;
let app: ReturnType<typeof createApp>;
const account = { displayName: 'ผู้ทดสอบ', email: 'person@example.com', password: 'ValidPassword123!' };
const profile = { displayName: 'ชื่อใหม่', age: 32, weightKg: 70, heightCm: 175 };
const post = (path: string, body: unknown) => request(app).post(path).set('Origin', origin).send(body);
const cookie = (response: request.Response) => (response.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
async function signIn(email = account.email) {
  await post('/api/auth/register', { ...account, email }).expect(201);
  return cookie(await post('/api/auth/login', { email, password: account.password }).expect(200));
}

beforeEach(async () => {
  repository.reset();
  date = new Date();
  app = createApp(repository, { jwtSecret: secret, appOrigin: origin, now: () => date });
});

describe('registration and authentication', () => {
  it('registers, normalizes email, hashes password, and never returns password data', async () => {
    const result = await post('/api/auth/register', { ...account, email: ' Person@Example.COM ' }).expect(201);
    expect(result.body.user.email).toBe('person@example.com');
    expect(result.body.user).not.toHaveProperty('passwordHash');
    const stored = await repository.findUserByEmail(account.email);
    expect(stored).not.toBeNull();
    if (!stored) throw new Error('Expected stored user');
    expect(stored.passwordHash).not.toBe(account.password);
    expect(await verifyPassword(account.password, stored.passwordHash)).toBe(true);
  });
  it.each([
    { email: 'invalid', password: account.password, displayName: 'Test' },
    { ...account, password: 'short' },
    { ...account, displayName: '  ' },
    {},
  ])('rejects invalid or missing registration fields: %j', async body => {
    await post('/api/auth/register', body).expect(400);
    expect(repository.users.size).toBe(0);
  });
  it('rejects duplicate emails regardless of capitalization, including concurrent registration', async () => {
    const results = await Promise.all([
      post('/api/auth/register', account),
      post('/api/auth/register', { ...account, email: account.email.toUpperCase() }),
    ]);
    expect(results.map(r => r.status).sort()).toEqual([201, 409]);
    expect(repository.users.size).toBe(1);
  });
  it('authenticates through an HttpOnly SameSite cookie and restores the profile', async () => {
    await post('/api/auth/register', account);
    const login = await post('/api/auth/login', account).expect(200);
    const cookies = login.headers['set-cookie'].toString();
    expect(cookies).toContain('HttpOnly');
    expect(cookies).toContain('SameSite=Lax');
    expect(cookies).toContain('Max-Age=1800');
    const me = await request(app).get('/api/auth/me').set('Cookie', cookie(login)).expect(200);
    expect(me.body.user.email).toBe(account.email);
    expect(me.headers['cache-control']).toBe('no-store');
  });
  it('uses Secure cookies in production', async () => {
    app = createApp(repository, { jwtSecret: secret, appOrigin: origin, production: true });
    await post('/api/auth/register', account);
    const login = await post('/api/auth/login', account).expect(200);
    expect(login.headers['set-cookie'].toString()).toContain('Secure');
  });
  it('returns the same login error for an unknown email and a wrong password', async () => {
    await post('/api/auth/register', account);
    const wrong = await post('/api/auth/login', { ...account, password: 'WrongPassword123!' }).expect(401);
    const missing = await post('/api/auth/login', { ...account, email: 'missing@example.com' }).expect(401);
    expect(wrong.body).toEqual(missing.body);
  });
  it('rejects anonymous reads, updates and tampered JWTs', async () => {
    await request(app).get('/api/auth/me').expect(401);
    await request(app).put('/api/profile').set('Origin', origin).send(profile).expect(401);
    await request(app).get('/api/auth/me').set('Cookie', `${COOKIE_NAME}=tampered`).expect(401);
  });
  it('rejects cross-origin and non-JSON mutations', async () => {
    await request(app).post('/api/auth/register').set('Origin', 'https://other.example').send(account).expect(403);
    await request(app).post('/api/auth/register').set('Origin', origin).type('form').send(account).expect(403);
    await request(app).post('/api/auth/register').send(account).expect(403);
  });
  it('expires after 30 minutes without activity', async () => {
    const auth = await signIn();
    date = new Date(date.getTime() + SESSION_MS);
    await request(app).get('/api/auth/me').set('Cookie', auth).expect(401);
  });
  it('renews the inactivity deadline when the user makes a request', async () => {
    let auth = await signIn();
    date = new Date(date.getTime() + 20 * 60 * 1000);
    auth = cookie(await request(app).get('/api/auth/me').set('Cookie', auth).expect(200));
    date = new Date(date.getTime() + 20 * 60 * 1000);
    await request(app).get('/api/auth/me').set('Cookie', auth).expect(200);
  });
  it('rejects a signed token when its server-side session has expired', async () => {
    await signIn();
    const session = [...repository.sessions.values()][0];
    session.expiresAt = new Date(date.getTime() - 1);
    const token = await tokenService(secret).sign(session.userId, session.id, date);
    await request(app).get('/api/auth/me').set('Cookie', `${COOKIE_NAME}=${token}`).expect(401);
  });
  it('logout revokes copied tokens and is idempotent', async () => {
    const auth = await signIn();
    await post('/api/auth/logout', {}).set('Cookie', auth).expect(204);
    await request(app).get('/api/auth/me').set('Cookie', auth).expect(401);
    await post('/api/auth/logout', {}).expect(204);
  });
  it('limits repeated login attempts', async () => {
    for (let i = 0; i < 20; i++) await post('/api/auth/login', {}).expect(400);
    await post('/api/auth/login', {}).expect(429);
  });
});

describe('personal profile', () => {
  it('persists edits across a new session and recalculates BMI using current values', async () => {
    const auth = await signIn();
    const saved = await request(app).put('/api/profile').set('Origin', origin).set('Cookie', auth).send(profile).expect(200);
    expect(saved.body.user).toMatchObject({ ...profile, bmi: 22.9 });
    const login = await post('/api/auth/login', account).expect(200);
    const me = await request(app).get('/api/auth/me').set('Cookie', cookie(login)).expect(200);
    expect(me.body.user).toMatchObject({ ...profile, bmi: 22.9 });
    const changed = await request(app).put('/api/profile').set('Origin', origin).set('Cookie', auth).send({ ...profile, weightKg: 80 }).expect(200);
    expect(changed.body.user.bmi).toBe(26.1);
  });
  it.each([{ ...profile, age: 2.5 }, { ...profile, weightKg: -1 }, { ...profile, heightCm: '175' }, { displayName: 'Name' }])('rejects invalid profile %j', async body => {
    const auth = await signIn();
    await request(app).put('/api/profile').set('Origin', origin).set('Cookie', auth).send(body).expect(400);
    const me = await request(app).get('/api/auth/me').set('Cookie', auth).expect(200);
    expect(me.body.user.weightKg).toBeNull();
  });
  it('isolates accounts and rejects identity injection in profile updates', async () => {
    const first = await signIn();
    const second = await signIn('second@example.com');
    const other = await repository.findUserByEmail('second@example.com');
    if (!other) throw new Error('Expected second user');
    await request(app).put('/api/profile').set('Origin', origin).set('Cookie', first).send({ ...profile, id: other.id }).expect(400);
    await request(app).put('/api/profile').set('Origin', origin).set('Cookie', first).send(profile).expect(200);
    const me = await request(app).get('/api/auth/me').set('Cookie', second).expect(200);
    expect(me.body.user.weightKg).toBeNull();
  });
  it('handles missing measurements without inventing a BMI', () => {
    expect(calculateBmi(null, 175)).toBeNull();
    expect(calculateBmi(70, null)).toBeNull();
    expect(calculateBmi(70, 0)).toBeNull();
    expect(calculateBmi(70, 175)).toBe(22.9);
  });
});

describe('exercise calories', () => {
  it('creates, updates and deletes an activity while recalculating the daily summary', async () => {
    const auth = await signIn();
    await request(app).put('/api/profile').set('Origin', origin).set('Cookie', auth).send(profile).expect(200);
    const input = { activityType: 'running', durationMinutes: 60, activityDate: '2026-09-11' };
    const created = await request(app).post('/api/exercises').set('Origin', origin).set('Cookie', auth).send(input).expect(201);
    expect(created.body.exercise).toMatchObject({ ...input, weightKg: 70, caloriesBurned: 610 });

    let summary = await request(app).get('/api/exercises/daily?date=2026-09-11').set('Cookie', auth).expect(200);
    expect(summary.body).toMatchObject({ caloriesConsumed: 0, caloriesBurned: 610, netCalories: -610 });

    const changed = { activityType: 'walking', durationMinutes: 30, activityDate: '2026-09-11' };
    await request(app).put(`/api/exercises/${created.body.exercise.id}`).set('Origin', origin).set('Cookie', auth).send(changed).expect(200);
    summary = await request(app).get('/api/exercises/daily?date=2026-09-11').set('Cookie', auth).expect(200);
    expect(summary.body).toMatchObject({ caloriesBurned: 129, netCalories: -129 });

    await request(app).delete(`/api/exercises/${created.body.exercise.id}`).set('Origin', origin).set('Cookie', auth).send({}).expect(204);
    summary = await request(app).get('/api/exercises/daily?date=2026-09-11').set('Cookie', auth).expect(200);
    expect(summary.body).toMatchObject({ caloriesBurned: 0, netCalories: 0, exercises: [] });
  });
  it('requires current weight and validates activity data', async () => {
    const auth = await signIn();
    const valid = { activityType: 'cycling', durationMinutes: 45, activityDate: '2026-09-11' };
    await request(app).post('/api/exercises').set('Origin', origin).set('Cookie', auth).send(valid).expect(409);
    await request(app).post('/api/exercises').set('Origin', origin).set('Cookie', auth).send({ ...valid, durationMinutes: 0 }).expect(400);
    await request(app).post('/api/exercises').set('Origin', origin).set('Cookie', auth).send({ ...valid, activityDate: '2026-02-30' }).expect(400);
  });
  it('isolates exercise records between users', async () => {
    const first = await signIn();
    await request(app).put('/api/profile').set('Origin', origin).set('Cookie', first).send(profile).expect(200);
    const created = await request(app).post('/api/exercises').set('Origin', origin).set('Cookie', first)
      .send({ activityType: 'yoga', durationMinutes: 30, activityDate: '2026-09-11' }).expect(201);
    const second = await signIn('exercise-second@example.com');
    await request(app).delete(`/api/exercises/${created.body.exercise.id}`).set('Origin', origin).set('Cookie', second).send({}).expect(404);
    const summary = await request(app).get('/api/exercises/daily?date=2026-09-11').set('Cookie', second).expect(200);
    expect(summary.body.exercises).toEqual([]);
  });
  it('uses the standard MET calorie formula', () => {
    expect(calculateExerciseCalories('running', 70, 60)).toBe(610);
    expect(() => calculateExerciseCalories('unknown', 70, 60)).toThrow();
  });
});

describe('food calories', () => {
  const meal = { name: 'ข้าวมันไก่', mealType: 'lunch', activityDate: '2026-09-11', ingredients: [
    { name: 'ข้าวและไก่', carbsGrams: 50, sugarGrams: 4, proteinGrams: 25, fatGrams: 18 },
  ] };
  it('creates food, totals its calories, and includes it in the daily net calories', async () => {
    const auth = await signIn();
    const created = await request(app).post('/api/meals').set('Origin', origin).set('Cookie', auth).send(meal).expect(201);
    expect(created.body.meal).toMatchObject({ name: meal.name, totalCalories: 462, ingredients: meal.ingredients });
    const daily = await request(app).get('/api/meals/daily?date=2026-09-11').set('Cookie', auth).expect(200);
    expect(daily.body).toMatchObject({ caloriesConsumed: 462 });
    const exercise = await request(app).get('/api/exercises/daily?date=2026-09-11').set('Cookie', auth).expect(200);
    expect(exercise.body).toMatchObject({ caloriesConsumed: 462, caloriesBurned: 0, netCalories: 462 });
  });
  it('updates and deletes food while recalculating the daily total', async () => {
    const auth = await signIn();
    const created = await request(app).post('/api/meals').set('Origin', origin).set('Cookie', auth).send(meal).expect(201);
    const changed = { ...meal, name: 'สลัดไก่', ingredients: [{ name: 'สลัด', carbsGrams: 10, sugarGrams: 3, proteinGrams: 20, fatGrams: 8 }] };
    await request(app).put(`/api/meals/${created.body.meal.id}`).set('Origin', origin).set('Cookie', auth).send(changed).expect(200);
    let daily = await request(app).get('/api/meals/daily?date=2026-09-11').set('Cookie', auth).expect(200);
    expect(daily.body.caloriesConsumed).toBe(192);
    await request(app).delete(`/api/meals/${created.body.meal.id}`).set('Origin', origin).set('Cookie', auth).send({}).expect(204);
    daily = await request(app).get('/api/meals/daily?date=2026-09-11').set('Cookie', auth).expect(200);
    expect(daily.body).toMatchObject({ caloriesConsumed: 0, meals: [] });
  });
  it('validates food input and isolates records between accounts', async () => {
    const first = await signIn();
    await request(app).post('/api/meals').set('Origin', origin).set('Cookie', first).send({ ...meal, ingredients: [] }).expect(400);
    const created = await request(app).post('/api/meals').set('Origin', origin).set('Cookie', first).send(meal).expect(201);
    const second = await signIn('food-second@example.com');
    await request(app).delete(`/api/meals/${created.body.meal.id}`).set('Origin', origin).set('Cookie', second).send({}).expect(404);
    await request(app).get('/api/meals/daily?date=2026-09-11').set('Cookie', second).expect(200).expect({ date: '2026-09-11', meals: [], caloriesConsumed: 0 });
  });
  it('uses standard macronutrient energy values without double-counting sugar', () => {
    expect(calculateMealCalories(meal.ingredients)).toBe(462);
  });
  it('summarizes seven daily calorie totals for the weekly dashboard', async () => {
    const auth = await signIn();
    await request(app).post('/api/meals').set('Origin', origin).set('Cookie', auth).send(meal).expect(201);
    const weekly = await request(app).get('/api/summary/weekly?date=2026-09-11').set('Cookie', auth).expect(200);
    expect(weekly.body).toMatchObject({ startDate: '2026-09-05', endDate: '2026-09-11', caloriesConsumed: 462, caloriesBurned: 0 });
    expect(weekly.body.days).toHaveLength(7);
    expect(weekly.body.days.at(-1)).toMatchObject({ date: '2026-09-11', caloriesConsumed: 462, netCalories: 462 });
  });
});
