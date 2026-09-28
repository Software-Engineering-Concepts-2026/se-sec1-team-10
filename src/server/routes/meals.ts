import type { Express, RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import {
  dailyExerciseQuerySchema,
  historyQuerySchema,
  mealSchema,
} from "../../shared/contracts.js";
import {
  analyzeMealImage,
  estimateIngredient,
  ingredientRequestSchema,
  analyzeMealRequestSchema,
  AiRequestError,
  isAiConfigured,
  NotFoodError,
} from "../ai.js";
import { calculateMeal, publicMeal } from "../meal.js";
import {
  foodSearchQuerySchema,
  isNutritionConfigured,
  NutritionRequestError,
  searchUsdaFoods,
} from "../nutrition.js";
import { dateBounds } from "../exercise.js";
import type { RouteContext } from "./context.js";

export function registerMealRoutes(
  app: Express,
  context: RouteContext,
  requireAuth: RequestHandler,
) {
  const { repository, config, now } = context;
  app.get("/api/meals/daily", requireAuth, async (req, res) => {
    const query = dailyExerciseQuerySchema.parse(req.query);
    const { start, end } = dateBounds(query.date);
    const meals = (
      await repository.listMeals(res.locals.user.id, start, end)
    ).map(publicMeal);
    res.json({
      date: query.date,
      meals,
      caloriesConsumed: meals.reduce(
        (total, meal) => total + meal.totalCalories,
        0,
      ),
    });
  });
  app.get("/api/meals/history", requireAuth, async (req, res) => {
    const query = historyQuerySchema.parse(req.query);
    const { start } = dateBounds(query.from);
    const { end } = dateBounds(query.to);
    const meals = (
      await repository.listMeals(res.locals.user.id, start, end)
    ).map(publicMeal);
    res.json({ meals });
  });
  app.post("/api/meals", requireAuth, async (req, res) => {
    const data = mealSchema.parse(req.body);
    const calculated = calculateMeal(data);
    const meal = await repository.createMeal(res.locals.user.id, data, calculated.totalCalories);
    res
      .status(201)
      .json({ meal: publicMeal(meal), message: "บันทึกอาหารแล้ว" });
  });
  const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (_req, res) =>
      String(res.locals.user?.id ?? "unauthenticated"),
    message: {
      message: "วิเคราะห์รูปภาพบ่อยเกินไป กรุณารอ 15 นาทีแล้วลองใหม่",
    },
  });
  app.post("/api/meals/analyze", requireAuth, aiLimiter, async (req, res) => {
    if (!isAiConfigured(config.ai)) {
      res
        .status(503)
        .json({ message: "ยังไม่ได้เปิดใช้การวิเคราะห์รูปภาพอาหาร" });
      return;
    }
    const { imageData } = analyzeMealRequestSchema.parse(req.body);
    if (
      !(await repository.claimDailyAiScan(
        res.locals.user.id,
        now(),
        config.ai.dailyScanLimit ?? 50,
      ))
    ) {
      res
        .status(429)
        .json({
          message:
            "ใช้โควต้าวิเคราะห์รูปภาพครบสำหรับวันนี้แล้ว กรุณาลองใหม่วันพรุ่งนี้",
        });
      return;
    }
    try {
      const analysis = await analyzeMealImage(imageData, config.ai);
      res.json({ analysis });
    } catch (error) {
      if (error instanceof NotFoodError) {
        res
          .status(422)
          .json({
            error: "not-food",
            message:
              "ไม่พบอาหารหรือเครื่องดื่มในรูปภาพ กรุณาเลือกรูปอาหารที่ชัดเจน",
          });
        return;
      }
      if (error instanceof AiRequestError) {
        const message =
          error.status === 504
            ? "การวิเคราะห์ใช้เวลานานเกินไป กรุณาลองใหม่"
            : "ไม่สามารถวิเคราะห์รูปภาพได้ในขณะนี้ กรุณาลองใหม่";
        res.status(error.status).json({ message });
        return;
      }
      throw error;
    }
  });
  app.post('/api/foods/estimate', requireAuth, aiLimiter, async (req, res) => {
    const input = ingredientRequestSchema.parse(req.body);
    if (!isAiConfigured(config.ai)) {
      res.status(503).json({ message: 'ยังไม่ได้ตั้งค่า AI สำหรับประมาณสารอาหาร กรุณาค้นหาจากฐานข้อมูลอาหาร' });
      return;
    }
    if (!(await repository.claimDailyAiScan(res.locals.user.id, now(), config.ai.dailyScanLimit ?? 50))) {
      res.status(429).json({ message: 'ใช้โควตา AI วันนี้ครบแล้ว กรุณาลองใหม่วันพรุ่งนี้' });
      return;
    }
    try {
      res.json({ ingredient: await estimateIngredient(input, config.ai) });
    } catch (error) {
      if (error instanceof NotFoodError) {
        res.status(422).json({ message: 'ไม่รู้จักส่วนประกอบนี้ กรุณาระบุชื่ออาหารและวิธีปรุงให้ชัดเจน' });
      } else if (error instanceof AiRequestError) {
        res.status(error.status).json({ message: 'ประมาณสารอาหารไม่สำเร็จ ข้อมูลที่กรอกยังอยู่ กรุณาลองใหม่หรือค้นหาจากฐานข้อมูล' });
      } else throw error;
    }
  });
  app.get("/api/foods/search", requireAuth, async (req, res) => {
    if (!isNutritionConfigured(config.nutrition)) {
      res
        .status(503)
        .json({ message: "ยังไม่ได้เปิดใช้การค้นหาข้อมูลโภชนาการ" });
      return;
    }
    const { q } = foodSearchQuerySchema.parse(req.query);
    try {
      res.json({ foods: await searchUsdaFoods(q, config.nutrition) });
    } catch (error) {
      if (error instanceof NutritionRequestError) {
        const message =
          error.status === 504
            ? "การค้นหาข้อมูลโภชนาการใช้เวลานานเกินไป กรุณาลองใหม่"
            : "ไม่สามารถค้นหาข้อมูลโภชนาการได้ในขณะนี้ กรุณาลองใหม่";
        res.status(error.status).json({ message });
        return;
      }
      throw error;
    }
  });
  app.put("/api/meals/:id", requireAuth, async (req, res) => {
    const data = mealSchema.parse(req.body);
    const calculated = calculateMeal(data);
    const meal = await repository.updateMeal(String(req.params.id), res.locals.user.id, data, calculated.totalCalories);
    if (!meal) {
      res.status(404).json({ message: "ไม่พบรายการอาหาร" });
      return;
    }
    res.json({ meal: publicMeal(meal), message: "แก้ไขอาหารแล้ว" });
  });
  app.delete("/api/meals/:id", requireAuth, async (req, res) => {
    const deleted = await repository.deleteMeal(
      String(req.params.id),
      res.locals.user.id,
    );
    if (!deleted) {
      res.status(404).json({ message: "ไม่พบรายการอาหาร" });
      return;
    }
    res.status(204).end();
  });
}
