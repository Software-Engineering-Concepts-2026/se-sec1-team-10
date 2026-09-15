import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { ZodError } from 'zod';
import { dailyExerciseQuerySchema, exerciseSchema, goalSchema, historyQuerySchema, loginSchema, mealSchema, profileSchema, registerSchema, type PublicUser } from '../shared/contracts.js';
import { DuplicateEmailError, type Repository } from './repository.js';
import { COOKIE_NAME, SESSION_MS, hashPassword, tokenService, verifyPassword } from './security.js';
import { calculateBmi } from './health.js';
import { calculateExerciseCalories, dateBounds, publicExercise } from './exercise.js';
import { calculateMealCalories, publicMeal } from './meal.js';
import { analyzeMealImage, analyzeMealRequestSchema, AiRequestError, DailyScanBudget, isAiConfigured, NotFoodError, type AiConfiguration } from './ai.js';
import { foodSearchQuerySchema, isNutritionConfigured, NutritionRequestError, searchUsdaFoods, type NutritionConfiguration } from './nutrition.js';

export type AppConfig = {
  jwtSecret: string; appOrigin: string; production?: boolean; now?: () => Date;
  /** Optional so applications without an AI provider keep the feature disabled. */
  ai?: AiConfiguration;
  nutrition?: NutritionConfiguration;
};

const publicUser = (user: Omit<PublicUser, 'bmi'>): PublicUser => ({
  id: user.id, email: user.email, displayName: user.displayName,
  age: user.age, weightKg: user.weightKg, heightCm: user.heightCm,
  targetWeightKg: user.targetWeightKg, dailyCalorieTarget: user.dailyCalorieTarget,
  bmi: calculateBmi(user.weightKg, user.heightCm),
});

export function createApp(repository: Repository, config: AppConfig) {
  if (config.jwtSecret.length < 32 || config.jwtSecret.startsWith('replace-this')) {
    throw new Error('JWT_SECRET must be a randomly generated secret of at least 32 characters');
  }
  const origin = new URL(config.appOrigin).origin;
  const now = config.now ?? (() => new Date());
  const dailyScanBudget = new DailyScanBudget(config.ai?.dailyScanLimit ?? 50);
  const tokens = tokenService(config.jwtSecret);
  const cookieOptions = { httpOnly: true, sameSite: 'lax' as const, secure: !!config.production, path: '/api' };
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  // Mutations must originate in our own UI. Requiring JSON prevents simple cross-site form posts.
  app.use('/api', (req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      (req.get('origin') !== origin || !req.is('application/json'))) {
      res.status(403).json({ message: 'ไม่อนุญาตคำขอจากเว็บไซต์นี้' }); return;
    }
    next();
  });
  app.use(express.json({ limit: '320kb' }));
  app.use(cookieParser());
  app.get('/api/health', (_req, res) => { res.json({ status: 'ok' }); });
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { message: 'ลองหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่' },
  });
  const dummyHash = hashPassword('dummy-password-for-timing-only');

  app.post('/api/auth/register', authLimiter, async (req, res) => {
    const { password, ...data } = registerSchema.parse(req.body);
    const user = await repository.createUser({ ...data, passwordHash: await hashPassword(password) });
    res.status(201).json({ user: publicUser(user), message: 'สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ' });
  });
  app.post('/api/auth/login', authLimiter, async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = await repository.findUserByEmail(email);
    const matches = await verifyPassword(password, user?.passwordHash ?? await dummyHash);
    if (!user || !matches) {
      res.status(401).json({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }); return;
    }
    const date = now();
    const session = await repository.createSession(user.id, new Date(date.getTime() + SESSION_MS));
    res.cookie(COOKIE_NAME, await tokens.sign(user.id, session.id, date), { ...cookieOptions, maxAge: SESSION_MS });
    res.json({ user: publicUser(user) });
  });

  const requireAuth: RequestHandler = async (req, res, next) => {
    let identity;
    try { identity = await tokens.verify(req.cookies[COOKIE_NAME] ?? '', now()); }
    catch {
      res.clearCookie(COOKIE_NAME, cookieOptions);
      res.status(401).json({ message: 'กรุณาเข้าสู่ระบบอีกครั้ง' }); return;
    }
    const date = now();
    const active = await repository.touchSession(identity.sessionId, identity.userId, date, new Date(date.getTime() + SESSION_MS));
    const user = active ? await repository.findUserById(identity.userId) : null;
    if (!user) {
      res.clearCookie(COOKIE_NAME, cookieOptions);
      res.status(401).json({ message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง' }); return;
    }
    res.locals.user = user;
    res.locals.sessionId = identity.sessionId;
    // Renew both the JWT cookie and server-side inactivity deadline on user requests.
    res.cookie(COOKIE_NAME, await tokens.sign(user.id, identity.sessionId, date), { ...cookieOptions, maxAge: SESSION_MS });
    next();
  };
  app.get('/api/auth/me', requireAuth, (_req, res) => { res.json({ user: publicUser(res.locals.user) }); });
  app.post('/api/auth/logout', async (req, res) => {
    let sessionId: string | undefined;
    try { sessionId = (await tokens.verify(req.cookies[COOKIE_NAME] ?? '', now())).sessionId; } catch { /* Already signed out. */ }
    if (sessionId) await repository.deleteSession(sessionId);
    res.clearCookie(COOKIE_NAME, cookieOptions);
    res.status(204).end();
  });
  app.put('/api/profile', requireAuth, async (req, res) => {
    const data = profileSchema.parse(req.body);
    const user = await repository.updateProfile(res.locals.user.id, data);
    await repository.addWeightLog(user.id, data.weightKg, data.heightCm);
    res.json({ user: publicUser(user), message: 'บันทึกข้อมูลส่วนตัวแล้ว' });
  });
  app.get('/api/exercises/daily', requireAuth, async (req, res) => {
    const query = dailyExerciseQuerySchema.parse(req.query);
    const { start, end } = dateBounds(query.date);
    const exercises = (await repository.listExercises(res.locals.user.id, start, end)).map(publicExercise);
    const caloriesConsumed = (await repository.listMeals(res.locals.user.id, start, end)).reduce((total, meal) => total + meal.totalCalories, 0);
    const caloriesBurned = exercises.reduce((total, exercise) => total + exercise.caloriesBurned, 0);
    res.json({
      date: query.date, exercises, caloriesConsumed, caloriesBurned, netCalories: caloriesConsumed - caloriesBurned,
    });
  });
  app.get('/api/meals/daily', requireAuth, async (req, res) => {
    const query = dailyExerciseQuerySchema.parse(req.query);
    const { start, end } = dateBounds(query.date);
    const meals = (await repository.listMeals(res.locals.user.id, start, end)).map(publicMeal);
    res.json({ date: query.date, meals, caloriesConsumed: meals.reduce((total, meal) => total + meal.totalCalories, 0) });
  });
  app.get('/api/health-history', requireAuth, async (_req, res) => {
    const start = new Date(); start.setFullYear(start.getFullYear() - 1);
    const points = (await repository.listWeightLogs(res.locals.user.id, start)).map(point => ({ date: point.loggedAt.toISOString().slice(0, 10), weightKg: point.weightKg, bmi: calculateBmi(point.weightKg, point.heightCm) }));
    res.json({ points, rangeDays: 365, performanceTargetMs: 1500 });
  });
  app.get('/api/meals/history', requireAuth, async (req, res) => {
    const query = historyQuerySchema.parse(req.query);
    const { start } = dateBounds(query.from); const { end } = dateBounds(query.to);
    const meals = (await repository.listMeals(res.locals.user.id, start, end)).map(publicMeal);
    res.json({ meals });
  });
  app.put('/api/goals', requireAuth, async (req, res) => {
    const user = await repository.updateGoals(res.locals.user.id, goalSchema.parse(req.body));
    res.json({ user: publicUser(user), message: 'บันทึกเป้าหมายแล้ว' });
  });
  app.get('/api/summary/weekly', requireAuth, async (req, res) => {
    const { date } = dailyExerciseQuerySchema.parse(req.query);
    const { end } = dateBounds(date);
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    const [meals, exercises] = await Promise.all([
      repository.listMeals(res.locals.user.id, start, end), repository.listExercises(res.locals.user.id, start, end),
    ]);
    const dates = Array.from({ length: 7 }, (_, index) => new Date(start.getTime() + index * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
    const days = dates.map(day => {
      const caloriesConsumed = meals.filter(meal => meal.activityDate === day).reduce((total, meal) => total + meal.totalCalories, 0);
      const caloriesBurned = exercises.filter(exercise => exercise.activityDate === day).reduce((total, exercise) => total + exercise.caloriesBurned, 0);
      return { date: day, caloriesConsumed, caloriesBurned, netCalories: caloriesConsumed - caloriesBurned };
    });
    res.json({ startDate: dates[0], endDate: date, days, caloriesConsumed: days.reduce((total, day) => total + day.caloriesConsumed, 0), caloriesBurned: days.reduce((total, day) => total + day.caloriesBurned, 0) });
  });
  app.post('/api/meals', requireAuth, async (req, res) => {
    const data = mealSchema.parse(req.body);
    const meal = await repository.createMeal(res.locals.user.id, data, calculateMealCalories(data.ingredients));
    res.status(201).json({ meal: publicMeal(meal), message: 'บันทึกอาหารแล้ว' });
  });
  const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false,
    keyGenerator: (_req, res) => String(res.locals.user?.id ?? 'unauthenticated'),
    message: { message: 'วิเคราะห์รูปภาพบ่อยเกินไป กรุณารอ 15 นาทีแล้วลองใหม่' },
  });
  app.post('/api/meals/analyze', requireAuth, aiLimiter, async (req, res) => {
    if (!isAiConfigured(config.ai)) {
      res.status(503).json({ message: 'ยังไม่ได้เปิดใช้การวิเคราะห์รูปภาพอาหาร' }); return;
    }
    const { imageData } = analyzeMealRequestSchema.parse(req.body);
    if (!dailyScanBudget.claim(res.locals.user.id, now())) {
      res.status(429).json({ message: 'ใช้โควต้าวิเคราะห์รูปภาพครบสำหรับวันนี้แล้ว กรุณาลองใหม่วันพรุ่งนี้' }); return;
    }
    try {
      const analysis = await analyzeMealImage(imageData, config.ai);
      res.json({ analysis });
    } catch (error) {
      if (error instanceof NotFoodError) {
        res.status(422).json({ error: 'not-food', message: 'ไม่พบอาหารหรือเครื่องดื่มในรูปภาพ กรุณาเลือกรูปอาหารที่ชัดเจน' }); return;
      }
      if (error instanceof AiRequestError) {
        const message = error.status === 504
          ? 'การวิเคราะห์ใช้เวลานานเกินไป กรุณาลองใหม่'
          : 'ไม่สามารถวิเคราะห์รูปภาพได้ในขณะนี้ กรุณาลองใหม่';
        res.status(error.status).json({ message }); return;
      }
      throw error;
    }
  });
  app.get('/api/foods/search', requireAuth, async (req, res) => {
    if (!isNutritionConfigured(config.nutrition)) {
      res.status(503).json({ message: 'ยังไม่ได้เปิดใช้การค้นหาข้อมูลโภชนาการ' }); return;
    }
    const { q } = foodSearchQuerySchema.parse(req.query);
    try {
      res.json({ foods: await searchUsdaFoods(q, config.nutrition) });
    } catch (error) {
      if (error instanceof NutritionRequestError) {
        const message = error.status === 504
          ? 'การค้นหาข้อมูลโภชนาการใช้เวลานานเกินไป กรุณาลองใหม่'
          : 'ไม่สามารถค้นหาข้อมูลโภชนาการได้ในขณะนี้ กรุณาลองใหม่';
        res.status(error.status).json({ message }); return;
      }
      throw error;
    }
  });
  app.put('/api/meals/:id', requireAuth, async (req, res) => {
    const data = mealSchema.parse(req.body);
    const meal = await repository.updateMeal(String(req.params.id), res.locals.user.id, data, calculateMealCalories(data.ingredients));
    if (!meal) { res.status(404).json({ message: 'ไม่พบรายการอาหาร' }); return; }
    res.json({ meal: publicMeal(meal), message: 'แก้ไขอาหารแล้ว' });
  });
  app.delete('/api/meals/:id', requireAuth, async (req, res) => {
    const deleted = await repository.deleteMeal(String(req.params.id), res.locals.user.id);
    if (!deleted) { res.status(404).json({ message: 'ไม่พบรายการอาหาร' }); return; }
    res.status(204).end();
  });
  app.post('/api/exercises', requireAuth, async (req, res) => {
    const data = exerciseSchema.parse(req.body);
    const weightKg = res.locals.user.weightKg;
    if (weightKg === null) {
      res.status(409).json({ message: 'กรุณาบันทึกน้ำหนักในข้อมูลส่วนตัวก่อนคำนวณการออกกำลังกาย' }); return;
    }
    const caloriesBurned = calculateExerciseCalories(data.activityType, weightKg, data.durationMinutes);
    const exercise = await repository.createExercise(res.locals.user.id, data, weightKg, caloriesBurned);
    res.status(201).json({ exercise: publicExercise(exercise), message: 'บันทึกการออกกำลังกายแล้ว' });
  });
  app.put('/api/exercises/:id', requireAuth, async (req, res) => {
    const data = exerciseSchema.parse(req.body);
    const weightKg = res.locals.user.weightKg;
    if (weightKg === null) {
      res.status(409).json({ message: 'กรุณาบันทึกน้ำหนักในข้อมูลส่วนตัวก่อนคำนวณการออกกำลังกาย' }); return;
    }
    const caloriesBurned = calculateExerciseCalories(data.activityType, weightKg, data.durationMinutes);
    const exercise = await repository.updateExercise(String(req.params.id), res.locals.user.id, data, weightKg, caloriesBurned);
    if (!exercise) { res.status(404).json({ message: 'ไม่พบรายการออกกำลังกาย' }); return; }
    res.json({ exercise: publicExercise(exercise), message: 'แก้ไขการออกกำลังกายแล้ว' });
  });
  app.delete('/api/exercises/:id', requireAuth, async (req, res) => {
    const deleted = await repository.deleteExercise(String(req.params.id), res.locals.user.id);
    if (!deleted) { res.status(404).json({ message: 'ไม่พบรายการออกกำลังกาย' }); return; }
    res.status(204).end();
  });
  app.use('/api', (_req, res) => { res.status(404).json({ message: 'ไม่พบ API ที่ร้องขอ' }); });
  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof ZodError) {
      res.status(400).json({ message: 'กรุณาตรวจสอบข้อมูลที่กรอก', errors: error.flatten().fieldErrors }); return;
    }
    if (error instanceof DuplicateEmailError) {
      res.status(409).json({ message: 'อีเมลนี้ถูกใช้แล้ว กรุณาเข้าสู่ระบบหรือใช้อีเมลอื่น' }); return;
    }
    if (error instanceof SyntaxError && 'body' in error) {
      res.status(400).json({ message: 'รูปแบบข้อมูลไม่ถูกต้อง' }); return;
    }
    if (error?.type === 'entity.too.large') {
      res.status(413).json({ message: 'ข้อมูลมีขนาดใหญ่เกินไป' }); return;
    }
    console.error('Request failed:', error instanceof Error ? error.name : 'UnknownError');
    res.status(500).json({ message: 'ระบบขัดข้องชั่วคราว กรุณาลองใหม่' });
  };
  app.use(errorHandler);
  return app;
}
