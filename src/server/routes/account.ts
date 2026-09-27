import type { Express, RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import {
  goalSchema,
  loginSchema,
  profileSchema,
  registerSchema,
} from "../../shared/contracts.js";
import {
  COOKIE_NAME,
  SESSION_MS,
  hashPassword,
  verifyPassword,
} from "../security.js";
import type { RouteContext } from "./context.js";

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
    const user = await repository.updateProfile(res.locals.user.id, data);
    await repository.addWeightLog(user.id, data.weightKg, data.heightCm);
    res.json({ user: publicUser(user), message: "บันทึกข้อมูลส่วนตัวแล้ว" });
  });
  app.put("/api/goals", requireAuth, async (req, res) => {
    const user = await repository.updateGoals(
      res.locals.user.id,
      goalSchema.parse(req.body),
    );
    res.json({ user: publicUser(user), message: "บันทึกเป้าหมายแล้ว" });
  });
}
