import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { User } from '@prisma/client';
import { createApp } from '../server/app.js';
import { DuplicateEmailError, type Repository } from '../server/repository.js';
import { mealSchema, type ExerciseInput, type ExerciseRecord, type SavedGoalInput, type MealInput, type MealRecord, type ProfileInput, type WeightLogRecord } from '../shared/contracts.js';
import { calculateBmi } from '../server/health.js';
import { calculateExerciseCalories } from '../server/exercise.js';
import { calculateMeal } from '../server/meal.js';
import { COOKIE_NAME, SESSION_MS, tokenService, verifyPassword } from '../server/security.js';

class MemoryRepository implements Repository {
  async lookupFoodReferences() { return []; }
  async searchFoods() { return []; }
  users = new Map<string, User>();
  sessions = new Map<string, { id: string; userId: string; expiresAt: Date }>();
  exercises = new Map<string, ExerciseRecord>();
  meals = new Map<string, MealRecord>();
  weightLogs: (WeightLogRecord & { userId: string })[] = [];
  async findUserByEmail(email: string) { return [...this.users.values()].find(user => user.email === email) ?? null; }
  async findUserById(id: string) { return this.users.get(id) ?? null; }
  async createUser(data: { email: string; displayName: string; passwordHash: string }) {
    // Yield once so the concurrency test exercises the uniqueness check at the storage boundary.
    await Promise.resolve();
    if (await this.findUserByEmail(data.email)) throw new DuplicateEmailError();
    const now = new Date();
    const user: User = { id: randomUUID(), ...data, age: null, weightKg: null, heightCm: null, targetWeightKg: null, dailyCalorieTarget: null, goalSettings: null, avatarImageData: null, createdAt: now, updatedAt: now };
    this.users.set(user.id, user); return user;
  }
  async updateProfile(id: string, data: ProfileInput, loggedAt = new Date()) {
    const user = this.users.get(id);
    if (!user) throw new Error('User not found');
    const updated = { ...user, ...data, updatedAt: new Date() };
    this.users.set(id, updated);
    this.weightLogs.push({ id: randomUUID(), userId: id, weightKg: data.weightKg, heightCm: data.heightCm, loggedAt });
    return updated;
  }
  async updateAvatar(id: string, avatarImageData: string | null) {
    const user = this.users.get(id);
    if (!user) throw new Error('User not found');
    const updated = { ...user, avatarImageData, updatedAt: new Date() };
    this.users.set(id, updated); return updated;
  }
  async updateGoals(id: string, data: SavedGoalInput) {
    const updated = { ...this.users.get(id)!, ...data, updatedAt: new Date() }; this.users.set(id, updated); return updated;
  }
  async addWeightLog(userId: string, weightKg: number, heightCm: number) { this.weightLogs.push({ id: randomUUID(), userId, weightKg, heightCm, loggedAt: new Date() }); }
  async listWeightLogs(userId: string, start: Date) { return this.weightLogs.filter(item => item.userId === userId && item.loggedAt >= start).sort((a,b) => a.loggedAt.getTime() - b.loggedAt.getTime() || a.id.localeCompare(b.id)); }
  private syncWeight(userId: string) {
    const latest = this.weightLogs.filter(item => item.userId === userId).sort((a,b) => b.loggedAt.getTime() - a.loggedAt.getTime() || b.id.localeCompare(a.id))[0];
    const user = { ...this.users.get(userId)!, weightKg: latest?.weightKg ?? null }; this.users.set(userId, user); return user;
  }
  async createWeightLog(userId: string, weightKg: number, heightCm: number, loggedAt: Date) {
    const log = { id: randomUUID(), userId, weightKg, heightCm, loggedAt }; this.weightLogs.push(log); return { log, user: this.syncWeight(userId) };
  }
  async updateWeightLog(id: string, userId: string, weightKg: number, loggedAt: Date) {
    const log = this.weightLogs.find(item => item.id === id && item.userId === userId); if (!log) return null;
    Object.assign(log, { weightKg, loggedAt }); return { log, user: this.syncWeight(userId) };
  }
  async deleteWeightLog(id: string, userId: string) {
    const index = this.weightLogs.findIndex(item => item.id === id && item.userId === userId); if (index < 0) return null;
    this.weightLogs.splice(index, 1); return this.syncWeight(userId);
  }
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
  async listMeals(userId: string, start: Date, end: Date, page?: { query?: string; offset: number; limit: number }) {
    const matches = [...this.meals.values()].filter(item => item.userId === userId &&
      item.activityDate >= start.toISOString().slice(0, 10) && item.activityDate < end.toISOString().slice(0, 10) &&
      (!page?.query || item.name.toLocaleLowerCase().includes(page.query.toLocaleLowerCase())));
    matches.sort((a, b) => b.activityDate.localeCompare(a.activityDate) || b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id));
    return page ? matches.slice(page.offset, page.offset + page.limit) : matches;
  }
  async createMeal(userId: string, data: MealInput, totalCalories: number) {
    const now = new Date();
    const meal: MealRecord = { id: randomUUID(), userId, ...data, imageData: data.imageData ?? null, totalCalories, createdAt: now, updatedAt: now, ingredients: calculateMeal(data).ingredients.map(ingredient => ({ id: randomUUID(), ...ingredient })) };
    this.meals.set(meal.id, meal); return meal;
  }
  async updateMeal(id: string, userId: string, data: MealInput, totalCalories: number) {
    const current = this.meals.get(id);
    if (!current || current.userId !== userId) return null;
    const meal: MealRecord = { ...current, ...data, imageData: data.imageData ?? null, totalCalories, updatedAt: new Date(), ingredients: calculateMeal(data).ingredients.map(ingredient => ({ id: randomUUID(), ...ingredient })) };
    this.meals.set(id, meal); return meal;
  }
  async deleteMeal(id: string, userId: string) {
    const current = this.meals.get(id);
    return !!current && current.userId === userId && this.meals.delete(id);
  }
  async claimDailyAiScan() { return true; }
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
  it('trusts only the configured proxy hop count and defaults to no trusted proxies', () => {
    expect(app.get('trust proxy')).toBe(false);
    expect(createApp(repository, { jwtSecret: secret, appOrigin: origin, trustProxyHops: 1 }).get('trust proxy')).toBe(1);
    expect(() => createApp(repository, { jwtSecret: secret, appOrigin: origin, trustProxyHops: -1 })).toThrow('TRUST_PROXY_HOPS must be a non-negative integer');
    expect(() => createApp(repository, { jwtSecret: secret, appOrigin: origin, trustProxyHops: Number.NaN })).toThrow('TRUST_PROXY_HOPS must be a non-negative integer');
  });
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
  it('keys auth rate limits to the client behind one proxy hop, ignoring spoofed earlier XFF entries', async () => {
    app = createApp(repository, { jwtSecret: secret, appOrigin: origin, trustProxyHops: 1 });
    for (let i = 0; i < 20; i++) {
      await request(app).post('/api/auth/login')
        .set('Origin', origin)
        .set('X-Forwarded-For', `203.0.113.${i + 1}, 198.51.100.10`)
        .send({})
        .expect(400);
    }
    await request(app).post('/api/auth/login')
      .set('Origin', origin)
      .set('X-Forwarded-For', '192.0.2.200, 198.51.100.10')
      .send({})
      .expect(429);
    await request(app).post('/api/auth/login')
      .set('Origin', origin)
      .set('X-Forwarded-For', '203.0.113.1, 198.51.100.11')
      .send({})
      .expect(400);
  });
});

describe('dated weight entries', () => {
  const put = (path: string, auth: string, body: unknown) => request(app).put(path).set('Origin', origin).set('Cookie', auth).send(body);
  it('keeps historical edits out of the current weight and restores the next latest on delete', async () => {
    date = new Date('2026-10-07T12:00:00.000Z');
    const auth = await signIn();
    await put('/api/profile', auth, profile).expect(200);
    await put('/api/goals', auth, { targetWeightKg: 65, dailyCalorieTarget: 2000 }).expect(200);
    date = new Date('2026-10-07T12:00:01.000Z');
    const newest = await post('/api/weight-logs', { date: '2026-10-07', weightKg: 68 }).set('Cookie', auth).expect(201);
    expect(newest.body.user).toMatchObject({ weightKg: 68, bmi: 22.2, dailyCalorieTarget: 2000, targetWeightKg: 65 });
    const old = await post('/api/weight-logs', { date: '2026-10-06', weightKg: 75 }).set('Cookie', auth).expect(201);
    expect(old.body.user.weightKg).toBe(68);
    const changed = await put(`/api/weight-logs/${old.body.log.id}`, auth, { date: '2026-10-06', weightKg: 74 }).expect(200);
    expect(changed.body).toMatchObject({ log: { date: '2026-10-06', weightKg: 74 }, user: { weightKg: 68 } });
    const entries = await request(app).get('/api/weight-logs').set('Cookie', auth).expect(200);
    expect(entries.body.logs).toHaveLength(3);
    expect(entries.body.logs[0].id).toBe(newest.body.log.id);
    expect(entries.body.logs.every((log: Record<string, unknown>) => !('userId' in log))).toBe(true);
    const deleted = await request(app).delete(`/api/weight-logs/${newest.body.log.id}`).set('Origin', origin).set('Cookie', auth).send({}).expect(200);
    expect(deleted.body.user.weightKg).toBe(70);
    expect((await request(app).get('/api/auth/me').set('Cookie', auth).expect(200)).body.user.weightKg).toBe(70);
    const points = await request(app).get('/api/health-history').set('Cookie', auth).expect(200);
    expect(points.body.points).toEqual(expect.arrayContaining([expect.objectContaining({ date: '2026-10-06', weightKg: 74 })]));
    for (const log of entries.body.logs.filter((item: { id: string }) => item.id !== newest.body.log.id)) {
      await request(app).delete(`/api/weight-logs/${log.id}`).set('Origin', origin).set('Cookie', auth).send({}).expect(200);
    }
    expect((await request(app).get('/api/auth/me').set('Cookie', auth).expect(200)).body.user).toMatchObject({ weightKg: null, bmi: null, dailyCalorieTarget: 2000 });
  });
  it('isolates records by account and refuses future or malformed inputs', async () => {
    date = new Date('2026-10-07T12:00:00.000Z');
    const auth = await signIn(); const other = await signIn('second@example.com');
    await request(app).get('/api/weight-logs').expect(401);
    await post('/api/weight-logs', { date: '2026-10-07', weightKg: 68 }).set('Cookie', auth).expect(409);
    await put('/api/profile', auth, profile).expect(200);
    const saved = await post('/api/weight-logs', { date: '2026-10-06', weightKg: 68 }).set('Cookie', auth).expect(201);
    expect((await request(app).get('/api/weight-logs').set('Cookie', other).expect(200)).body.logs).toEqual([]);
    await put(`/api/weight-logs/${saved.body.log.id}`, other, { date: '2026-10-06', weightKg: 80 }).expect(404);
    await request(app).delete(`/api/weight-logs/${saved.body.log.id}`).set('Origin', origin).set('Cookie', other).send({}).expect(404);
    for (const body of [{ date: '2026-10-08', weightKg: 68 }, { date: '2025-10-06', weightKg: 68 }, { date: '2026-02-30', weightKg: 68 }, { date: '2026-10-07', weightKg: -1 }, { date: '2026-10-07', weightKg: 501 }, { date: '2026-10-07', weightKg: '68' }, { date: '2026-10-07', weightKg: 68, userId: 'forged' }]) {
      await post('/api/weight-logs', body).set('Cookie', auth).expect(400);
    }
    expect(repository.weightLogs).toHaveLength(2);
  });
  it('uses the Thai calendar day near midnight and preserves the historical height when editing', async () => {
    date = new Date('2026-10-06T18:00:00.000Z');
    const auth = await signIn(); await put('/api/profile', auth, profile).expect(200);
    const saved = await post('/api/weight-logs', { date: '2026-10-07', weightKg: 68 }).set('Cookie', auth).expect(201);
    expect(saved.body.log.date).toBe('2026-10-07');
    date = new Date('2026-10-06T18:00:01.000Z');
    await put('/api/profile', auth, { ...profile, heightCm: 180 }).expect(200);
    const changed = await put(`/api/weight-logs/${saved.body.log.id}`, auth, { date: '2026-10-05', weightKg: 67 }).expect(200);
    expect(changed.body.log).toMatchObject({ date: '2026-10-05', heightCm: 175, bmi: 21.9 });
    expect(changed.body.user.weightKg).toBe(70);
  });
});

describe('personal profile', () => {
  it('saves and removes only the signed-in user avatar without adding weight history', async () => {
    const auth = await signIn();
    const second = await signIn('second@example.com');
    const image = `data:image/jpeg;base64,${'a'.repeat(96)}`;
    const saved = await request(app).put('/api/profile/avatar').set('Origin', origin).set('Cookie', auth).send({ avatarImageData: image, userId: 'other' }).expect(400);
    expect(saved.body).toHaveProperty('message');
    const updated = await request(app).put('/api/profile/avatar').set('Origin', origin).set('Cookie', auth).send({ avatarImageData: image }).expect(200);
    expect(updated.body.user.avatarImageData).toBe(image);
    expect((await request(app).get('/api/auth/me').set('Cookie', second).expect(200)).body.user.avatarImageData).toBeNull();
    await request(app).put('/api/profile/avatar').set('Origin', origin).set('Cookie', auth).send({ avatarImageData: null }).expect(200);
    expect((await request(app).get('/api/auth/me').set('Cookie', auth).expect(200)).body.user.avatarImageData).toBeNull();
    expect(repository.weightLogs).toHaveLength(0);
  });
  it.each([{ avatarImageData: 'data:image/gif;base64,AAAA' }, { avatarImageData: `data:image/png;base64,${'a'.repeat(150_001)}` }, { avatarImageData: null, userId: 'injected' }])('rejects invalid avatar update %j', async body => {
    const auth = await signIn();
    await request(app).put('/api/profile/avatar').set('Origin', origin).set('Cookie', auth).send(body).expect(400);
  });
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

describe('saved TDEE goal settings', () => {
  const goalSettings = { mode: 'maintain', formulaSex: 'male', activityLevel: 'moderate', targetMode: 'recommended' };
  const save = (auth: string, body: unknown) => request(app).put('/api/goals').set('Origin', origin).set('Cookie', auth).send(body);
  it('calculates the recommended target server-side, saves its snapshot and restores it on login', async () => {
    const auth = await signIn();
    await request(app).put('/api/profile').set('Origin', origin).set('Cookie', auth).send(profile).expect(200);
    const result = await save(auth, { targetWeightKg: 70, dailyCalorieTarget: 1000, goalSettings }).expect(200);
    expect(result.body.user).toMatchObject({ dailyCalorieTarget: 2622, goalSettings: { ...goalSettings, tdeeKcal: 2622, profileSnapshot: { age: 32, weightKg: 70, heightCm: 175 }, startWeightKg: 70 } });
    const me = await request(app).get('/api/auth/me').set('Cookie', auth).expect(200);
    expect(me.body.user.goalSettings).toEqual(result.body.user.goalSettings);
    const other = await request(app).get('/api/auth/me').set('Cookie', await signIn('goal-other@example.com')).expect(200);
    expect(other.body.user.goalSettings).toBeNull();
  });
  it('preserves the saved target after a profile change until the user explicitly recalculates', async () => {
    const auth = await signIn();
    await request(app).put('/api/profile').set('Origin', origin).set('Cookie', auth).send(profile).expect(200);
    await save(auth, { targetWeightKg: 70, goalSettings }).expect(200);
    const changed = await request(app).put('/api/profile').set('Origin', origin).set('Cookie', auth).send({ ...profile, weightKg: 72 }).expect(200);
    expect(changed.body.user).toMatchObject({ dailyCalorieTarget: 2622, goalSettings: { startWeightKg: 70, profileSnapshot: { weightKg: 70 } } });
    const recalculated = await save(auth, { targetWeightKg: 70, goalSettings }).expect(200);
    expect(recalculated.body.user).toMatchObject({ dailyCalorieTarget: 2654, goalSettings: { startWeightKg: 70, profileSnapshot: { weightKg: 72 } } });
  });
  it('saves a manual override and accepts an older client without discarding intake semantics', async () => {
    const auth = await signIn();
    await request(app).put('/api/profile').set('Origin', origin).set('Cookie', auth).send(profile).expect(200);
    await save(auth, { targetWeightKg: 65, dailyCalorieTarget: 2100, goalSettings: { ...goalSettings, mode: 'lose', targetMode: 'manual' } }).expect(200);
    const result = await save(auth, { targetWeightKg: 65, dailyCalorieTarget: 2200 }).expect(200);
    expect(result.body.user).toMatchObject({ dailyCalorieTarget: 2200, goalSettings: { targetMode: 'manual', mode: 'lose', tdeeKcal: 2622 } });
  });
  it('rejects incomplete profiles, minors, unsafe loss targets and forged calculation fields', async () => {
    const auth = await signIn();
    await save(auth, { targetWeightKg: 65, goalSettings }).expect(400);
    await request(app).put('/api/profile').set('Origin', origin).set('Cookie', auth).send({ ...profile, age: 17 }).expect(200);
    await save(auth, { targetWeightKg: 65, goalSettings }).expect(400);
    await request(app).put('/api/profile').set('Origin', origin).set('Cookie', auth).send(profile).expect(200);
    await save(auth, { targetWeightKg: 40, goalSettings: { ...goalSettings, mode: 'lose' } }).expect(400);
    await save(auth, { targetWeightKg: 65, goalSettings: { ...goalSettings, tdeeKcal: 1000 } }).expect(400);
    expect([...repository.users.values()][0].goalSettings).toBeNull();
  });
  it('retains legacy targets without a TDEE snapshot for users who have not opted in', async () => {
    const auth = await signIn();
    const result = await save(auth, { targetWeightKg: 65, dailyCalorieTarget: 2000 }).expect(200);
    expect(result.body.user).toMatchObject({ dailyCalorieTarget: 2000, goalSettings: null });
  });
});

describe('food calories', () => {
  const meal = { name: 'ข้าวมันไก่', mealType: 'lunch', activityDate: '2026-09-11', ingredients: [
    { name: 'ข้าวและไก่', carbsGrams: 50, sugarGrams: 4, proteinGrams: 25, fatGrams: 18 },
  ] };
  it('creates food, totals its calories, and includes it in the daily net calories', async () => {
    const auth = await signIn();
    const created = await request(app).post('/api/meals').set('Origin', origin).set('Cookie', auth).send(meal).expect(201);
    expect(created.body.meal).toMatchObject({ name: meal.name, totalCalories: 462, ingredients: [{ name: 'ข้าวและไก่', carbsGrams: 50, sugarGrams: 4, proteinGrams: 25, fatGrams: 18 }] });
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
  it('searches meal history in bounded pages without exposing another account', async () => {
    const first = await signIn();
    for (const name of ['ข้าวมันไก่', 'ข้าวไข่เจียว', 'สลัด']) {
      await request(app).post('/api/meals').set('Origin', origin).set('Cookie', first).send({ ...meal, name }).expect(201);
    }
    const base = '/api/meals/history?from=2026-09-01&to=2026-09-30&q=ข้าว&limit=1';
    const firstPage = await request(app).get(`${base}&offset=0`).set('Cookie', first).expect(200);
    const secondPage = await request(app).get(`${base}&offset=1`).set('Cookie', first).expect(200);
    expect(firstPage.body.hasMore).toBe(true);
    expect(secondPage.body.hasMore).toBe(false);
    expect(firstPage.body.meals).toHaveLength(1);
    expect(secondPage.body.meals).toHaveLength(1);
    expect([firstPage.body.meals[0].name, secondPage.body.meals[0].name].sort()).toEqual(['ข้าวมันไก่', 'ข้าวไข่เจียว'].sort());
    await request(app).get(`${base}&offset=0`).set('Cookie', await signIn('history-second@example.com')).expect(200).expect({ meals: [], hasMore: false });
    await request(app).get(`${base}&offset=0&limit=51`).set('Cookie', first).expect(400);
  });
  it('uses standard macronutrient energy values without double-counting sugar', () => {
    expect(calculateMeal(mealSchema.parse(meal)).totalCalories).toBe(462);
  });
  it('summarizes seven daily calorie totals for the weekly dashboard', async () => {
    const auth = await signIn();
    await request(app).post('/api/meals').set('Origin', origin).set('Cookie', auth).send(meal).expect(201);
    const weekly = await request(app).get('/api/summary/weekly?date=2026-09-11').set('Cookie', auth).expect(200);
    expect(weekly.body).toMatchObject({ startDate: '2026-09-05', endDate: '2026-09-11', caloriesConsumed: 462, caloriesBurned: 0 });
    expect(weekly.body.days).toHaveLength(7);
    expect(weekly.body.days.at(-1)).toMatchObject({ date: '2026-09-11', caloriesConsumed: 462, netCalories: 462, mealCount: 1 });
    expect(weekly.body.days[0]).toMatchObject({ caloriesConsumed: 0, mealCount: 0 });
  });
  it('uses the selected end date as the final day in the weekly summary window', async () => {
    const auth = await signIn();
    await request(app).post('/api/meals').set('Origin', origin).set('Cookie', auth).send({
      ...meal,
      activityDate: '2026-01-04',
    }).expect(201);
    await request(app).post('/api/meals').set('Origin', origin).set('Cookie', auth).send({
      ...meal,
      activityDate: '2026-01-10',
    }).expect(201);

    const weekly = await request(app).get('/api/summary/weekly?date=2026-01-10').set('Cookie', auth).expect(200);

    expect(weekly.body).toMatchObject({
      startDate: '2026-01-04',
      endDate: '2026-01-10',
    });
    expect(weekly.body.days).toHaveLength(7);
    expect(weekly.body.days[0]).toMatchObject({ date: '2026-01-04', caloriesConsumed: 462 });
    expect(weekly.body.days.at(-1)).toMatchObject({ date: '2026-01-10', caloriesConsumed: 462, netCalories: 462 });
  });
  it('keeps daily meal counts and exercise totals separate across the selected week', async () => {
    const auth = await signIn();
    await request(app).put('/api/profile').set('Origin', origin).set('Cookie', auth).send(profile).expect(200);
    for (const activityDate of ['2026-09-09', '2026-09-11', '2026-09-09', '2026-09-04']) {
      await post('/api/meals', { ...meal, activityDate }).set('Cookie', auth).expect(201);
    }
    for (const activityDate of ['2026-09-09', '2026-09-10', '2026-09-09']) {
      await post('/api/exercises', { activityType: 'running', durationMinutes: 60, activityDate }).set('Cookie', auth).expect(201);
    }
    const weekly = await request(app).get('/api/summary/weekly?date=2026-09-11').set('Cookie', auth).expect(200);
    expect(weekly.body.days.map((day: { date: string }) => day.date)).toEqual([
      '2026-09-05', '2026-09-06', '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11',
    ]);
    expect(weekly.body.days[4]).toMatchObject({ mealCount: 2, caloriesConsumed: 924, caloriesBurned: 1220, netCalories: -296 });
    expect(weekly.body.days[5]).toMatchObject({ mealCount: 0, caloriesConsumed: 0, caloriesBurned: 610, netCalories: -610 });
    expect(weekly.body.days[6]).toMatchObject({ mealCount: 1, caloriesConsumed: 462, caloriesBurned: 0 });
    expect(weekly.body).toMatchObject({ caloriesConsumed: 1386, caloriesBurned: 1830 });
  });
});

describe('dashboard performance', () => {
  it('returns one year of health history within the 1.5-second target', async () => {
    const auth = await signIn();
    await request(app).put('/api/profile').set('Origin', origin).set('Cookie', auth).send(profile).expect(200);
    const started = performance.now();
    const response = await request(app).get('/api/health-history').set('Cookie', auth).expect(200);
    expect(performance.now() - started).toBeLessThan(1500);
    expect(response.body).toMatchObject({ rangeDays: 365, performanceTargetMs: 1500 });
  });
});
