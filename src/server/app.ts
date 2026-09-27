import express, { type ErrorRequestHandler } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { ZodError } from "zod";
import type { PublicUser } from "../shared/contracts.js";
import { DuplicateEmailError, type Repository } from "./repository.js";
import { tokenService } from "./security.js";
import { calculateBmi } from "./health.js";
import { registerAccountRoutes } from "./routes/account.js";
import { registerActivityRoutes } from "./routes/activity.js";
import { createRequireAuth, type RouteContext } from "./routes/context.js";
import { registerMealRoutes } from "./routes/meals.js";
import type { AiConfiguration } from "./ai.js";
import type { NutritionConfiguration } from "./nutrition.js";

export type AppConfig = {
  jwtSecret: string;
  appOrigin: string;
  production?: boolean;
  now?: () => Date;
  /** Optional so applications without an AI provider keep the feature disabled. */
  ai?: AiConfiguration;
  nutrition?: NutritionConfiguration;
};

const publicUser = (user: Omit<PublicUser, "bmi">): PublicUser => ({
  id: user.id,
  email: user.email,
  displayName: user.displayName,
  age: user.age,
  weightKg: user.weightKg,
  heightCm: user.heightCm,
  targetWeightKg: user.targetWeightKg,
  dailyCalorieTarget: user.dailyCalorieTarget,
  bmi: calculateBmi(user.weightKg, user.heightCm),
});

export function createApp(repository: Repository, config: AppConfig) {
  if (
    config.jwtSecret.length < 32 ||
    config.jwtSecret.startsWith("replace-this")
  ) {
    throw new Error(
      "JWT_SECRET must be a randomly generated secret of at least 32 characters",
    );
  }
  const origin = new URL(config.appOrigin).origin;
  const now = config.now ?? (() => new Date());
  const tokens = tokenService(config.jwtSecret);
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: !!config.production,
    path: "/api",
  };
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  // Mutations must originate in our own UI. Requiring JSON prevents simple cross-site form posts.
  app.use("/api", (req, res, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      (req.get("origin") !== origin || !req.is("application/json"))
    ) {
      res.status(403).json({ message: "ไม่อนุญาตคำขอจากเว็บไซต์นี้" });
      return;
    }
    next();
  });
  app.use(express.json({ limit: "320kb" }));
  app.use(cookieParser());
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  const routeContext: RouteContext = {
    repository,
    config,
    now,
    tokens,
    cookieOptions,
    publicUser,
  };
  const requireAuth = createRequireAuth(routeContext);
  registerAccountRoutes(app, routeContext, requireAuth);
  registerMealRoutes(app, routeContext, requireAuth);
  registerActivityRoutes(app, routeContext, requireAuth);
  app.use("/api", (_req, res) => {
    res.status(404).json({ message: "ไม่พบ API ที่ร้องขอ" });
  });
  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof ZodError) {
      res
        .status(400)
        .json({
          message: "กรุณาตรวจสอบข้อมูลที่กรอก",
          errors: error.flatten().fieldErrors,
        });
      return;
    }
    if (error instanceof DuplicateEmailError) {
      res
        .status(409)
        .json({
          message: "อีเมลนี้ถูกใช้แล้ว กรุณาเข้าสู่ระบบหรือใช้อีเมลอื่น",
        });
      return;
    }
    if (error instanceof SyntaxError && "body" in error) {
      res.status(400).json({ message: "รูปแบบข้อมูลไม่ถูกต้อง" });
      return;
    }
    if (error?.type === "entity.too.large") {
      res.status(413).json({ message: "ข้อมูลมีขนาดใหญ่เกินไป" });
      return;
    }
    console.error(
      "Request failed:",
      error instanceof Error ? error.name : "UnknownError",
    );
    res.status(500).json({ message: "ระบบขัดข้องชั่วคราว กรุณาลองใหม่" });
  };
  app.use(errorHandler);
  return app;
}
