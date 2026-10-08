import type { Express, RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import {
  goalSchema,
  loginSchema,
  profileSchema,
  profileAvatarSchema,
  registerSchema,
  savedGoalSettingsSchema,
  type SavedGoalInput,
} from "../../shared/contracts.js";
import { estimateGoal, goalEstimateIssue } from "../../shared/goals.js";
import {
  COOKIE_NAME,
  SESSION_MS,
  hashPassword,
  verifyPassword,
} from "../security.js";
import type { RouteContext } from "./context.js";
import { weightDate, weightTimestamp } from '../weight.js';

export function registerAccountRoutes(
  app: Express,
  context: RouteContext,
  requireAuth: RequestHandler,
) {
  const { repository, now, tokens, cookieOptions, publicUser } = context;
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { message: "ลองหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่" },
  });
  const dummyHash = hashPassword("dummy-password-for-timing-only");

  app.post("/api/auth/register", authLimiter, async (req, res) => {
    const { password, ...data } = registerSchema.parse(req.body);
    const user = await repository.createUser({
      ...data,
      passwordHash: await hashPassword(password),
    });
    res
      .status(201)
      .json({
        user: publicUser(user),
        message: "สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ",
      });
  });
  app.post("/api/auth/login", authLimiter, async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = await repository.findUserByEmail(email);
    const matches = await verifyPassword(
      password,
      user?.passwordHash ?? (await dummyHash),
    );
    if (!user || !matches) {
      res.status(401).json({ message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
      return;
    }
    const date = now();
    const session = await repository.createSession(
      user.id,
      new Date(date.getTime() + SESSION_MS),
    );
    res.cookie(COOKIE_NAME, await tokens.sign(user.id, session.id, date), {
      ...cookieOptions,
      maxAge: SESSION_MS,
    });
    res.json({ user: publicUser(user) });
  });

  app.get("/api/auth/me", requireAuth, (_req, res) => {
    res.json({ user: publicUser(res.locals.user) });
  });
  app.post("/api/auth/logout", async (req, res) => {
    let sessionId: string | undefined;
    try {
      sessionId = (await tokens.verify(req.cookies[COOKIE_NAME] ?? "", now()))
        .sessionId;
    } catch {
      /* Already signed out. */
    }
    if (sessionId) await repository.deleteSession(sessionId);
    res.clearCookie(COOKIE_NAME, cookieOptions);
    res.status(204).end();
  });
  app.put("/api/profile", requireAuth, async (req, res) => {
    const data = profileSchema.parse(req.body);
    const user = await repository.updateProfile(res.locals.user.id, data, weightTimestamp(weightDate(now()), now()));
    res.json({ user: publicUser(user), message: "บันทึกข้อมูลส่วนตัวแล้ว" });
  });
  app.put("/api/profile/avatar", requireAuth, async (req, res) => {
    const { avatarImageData } = profileAvatarSchema.parse(req.body);
    const user = await repository.updateAvatar(res.locals.user.id, avatarImageData);
    res.json({ user: publicUser(user), message: "บันทึกรูปโปรไฟล์แล้ว" });
  });
  app.put("/api/goals", requireAuth, async (req, res) => {
    const input = goalSchema.parse(req.body);
    const profile = res.locals.user;
    const previous = savedGoalSettingsSchema.safeParse(profile.goalSettings).data;
    const data: SavedGoalInput = { targetWeightKg: input.targetWeightKg, dailyCalorieTarget: input.dailyCalorieTarget ?? 0 };
    if (input.goalSettings) {
      const issue = goalEstimateIssue(profile, input.goalSettings.mode);
      const estimate = estimateGoal(profile, input.goalSettings);
      if (issue || !estimate) {
        res.status(400).json({ message: issue ?? 'ข้อมูลร่างกายนี้อยู่นอกช่วงที่ระบบประมาณพลังงานได้ กรุณาตรวจข้อมูลส่วนตัว', errors: { goalSettings: [issue ?? 'ไม่สามารถประมาณ TDEE ได้'] } });
        return;
      }
      if (input.goalSettings.mode === 'lose' && input.targetWeightKg / (profile.heightCm / 100) ** 2 < 18.5) {
        res.status(400).json({ message: 'น้ำหนักเป้าหมายสำหรับการลดน้ำหนักต้องไม่ทำให้ BMI ต่ำกว่า 18.5', errors: { targetWeightKg: ['กรุณาตรวจน้ำหนักเป้าหมาย'] } });
        return;
      }
      data.dailyCalorieTarget = input.goalSettings.targetMode === 'recommended' ? estimate.targetKcal : input.dailyCalorieTarget!;
      data.goalSettings = {
        ...input.goalSettings,
        tdeeKcal: estimate.tdeeKcal,
        profileSnapshot: { age: profile.age, weightKg: profile.weightKg, heightCm: profile.heightCm },
        startWeightKg: previous && previous.mode === input.goalSettings.mode && profile.targetWeightKg === input.targetWeightKg ? previous.startWeightKg : profile.weightKg,
        updatedAt: now().toISOString(),
      };
    } else if (previous) {
      // Older clients can edit a target without silently reverting its intake semantics.
      data.goalSettings = { ...previous, targetMode: 'manual', updatedAt: now().toISOString() };
    }
    const user = await repository.updateGoals(profile.id, data);
    res.json({ user: publicUser(user), message: "บันทึกเป้าหมายแล้ว" });
  });
}
