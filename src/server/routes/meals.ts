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
  type PhotoAnalysisTiming,
  type AiFailureReason,
} from "../ai.js";
import { calculateMeal, publicMeal } from "../meal.js";
import { matchCatalogIngredients } from "../catalogMatching.js";
import {
  foodSearchQuerySchema,
  isNutritionConfigured,
  NutritionRequestError,
  searchUsdaFoods,
} from "../nutrition.js";
import { dateBounds } from "../exercise.js";
import type { RouteContext } from "./context.js";

const photoFailureMessages: Record<AiFailureReason, string> = {
  timeout: 'การวิเคราะห์ใช้เวลานานเกินไป กรุณารอสักครู่แล้วกดลองใหม่',
  upstream_rate_limit: 'บริการ AI รับคำขอมากเกินไป กรุณารอสักครู่แล้วกดลองใหม่',
  upstream_unavailable: 'บริการ AI ไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่ภายหลัง',
  upstream_rejected: 'บริการ AI ไม่สามารถรับคำขอนี้ได้ กรุณาลองใหม่ภายหลังหรือติดต่อผู้ดูแล',
  invalid_response: 'ผลวิเคราะห์ไม่สมบูรณ์ กรุณากดลองใหม่หรือกรอกข้อมูลเอง',
  truncated_response: 'ผลวิเคราะห์ถูกตัดก่อนครบ กรุณากดลองใหม่หรือกรอกข้อมูลเอง',
  network: 'เชื่อมต่อบริการ AI ไม่สำเร็จ กรุณารอสักครู่แล้วกดลองใหม่',
  configuration: 'การตั้งค่าบริการ AI ไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลหรือกรอกข้อมูลเอง',
};

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
    const { imageData, correctedMealName } = analyzeMealRequestSchema.parse(req.body);
    const started = performance.now();
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
    const providerStarted = performance.now();
    const quotaElapsedMs = Math.round(providerStarted - started);
    let providerEnded: number | undefined;
    let catalogStarted: number | undefined;
    let catalogElapsedMs = 0;
    let providerStatus: number | null = null;
    let reason: PhotoAnalysisTiming['reason'] = 'success';
    try {
      const analysis = await analyzeMealImage(imageData, {
        ...config.ai,
        fetch: async (input, init) => {
          const response = await (config.ai?.fetch ?? fetch)(input, init);
          providerStatus = response.status;
          return response;
        },
      }, correctedMealName);
      providerEnded = performance.now();
      catalogStarted = performance.now();
      const references = await repository.lookupFoodReferences(res.locals.user.id, analysis.ingredients.map(item => item.name));
      const matched = matchCatalogIngredients(analysis.ingredients, references);
      catalogElapsedMs = Math.round(performance.now() - catalogStarted);
      const missingCount = matched.catalogMatches.filter(match => match.status !== 'matched').length;
      const note = missingCount
        ? 'ข้อมูลที่ตรงกันจากฐานข้อมูลไม่ครบทุกส่วนผสม; ส่วนที่ไม่ตรงยังเป็นค่าประเมินจาก AI โปรดตรวจสอบก่อนบันทึก'
        : 'สารอาหารของส่วนผสมที่ตรงกันมาจากฐานข้อมูล; โปรดตรวจสอบปริมาณก่อนบันทึก';
      res.json({ analysis: { ...analysis, ingredients: matched.ingredients, notes: [...analysis.notes, note], catalogMatches: matched.catalogMatches } });
    } catch (error) {
      if (error instanceof NotFoodError) {
        reason = 'not_food';
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
        reason = error.reason;
        providerStatus = error.upstreamStatus ?? providerStatus;
        res.status(error.status).json({ error: error.reason, message: photoFailureMessages[error.reason] });
        return;
      }
      reason = 'catalog_unavailable';
      throw error;
    } finally {
      const ended = performance.now();
      const timing: PhotoAnalysisTiming = {
        event: 'photo_analysis', quotaElapsedMs, providerElapsedMs: Math.round((providerEnded ?? ended) - providerStarted),
        providerStatus, reason,
        catalogElapsedMs: catalogStarted !== undefined && reason === 'catalog_unavailable' ? Math.round(ended - catalogStarted) : catalogElapsedMs,
        totalElapsedMs: Math.round(ended - started),
      };
      // Observability must never turn a successful preview into a failed attempt.
      try { (config.ai.photoTimingLogger ?? (value => console.info(JSON.stringify(value))))(timing); } catch { /* logger failure only */ }
    }
  });
  const resolveCatalogEstimate: RequestHandler = async (req, res, next) => {
    try {
      const input = ingredientRequestSchema.parse(req.body);
      const references = await repository.lookupFoodReferences(res.locals.user.id, [input.name]);
      const placeholder = {
        name: input.name, amount: input.amount, unit: 'g' as const, referenceAmount: 100,
        referenceUnit: 'g' as const, source: 'ai-estimate' as const,
        referenceNutrients: { caloriesKcal: null, carbsGrams: null, sugarGrams: null, proteinGrams: null, fatGrams: null },
      };
      const direct = matchCatalogIngredients([placeholder], references);
      const catalogMatch = direct.catalogMatches[0];
      if (catalogMatch.status === 'matched') {
        res.json({ ingredient: direct.ingredients[0], catalogMatch });
        return;
      }
      res.locals.estimateInput = input;
      res.locals.catalogMatch = catalogMatch;
      next();
    } catch (error) { next(error); }
  };
  app.post('/api/foods/estimate', requireAuth, resolveCatalogEstimate, aiLimiter, async (_req, res) => {
    const input = res.locals.estimateInput as ReturnType<typeof ingredientRequestSchema.parse>;
    const catalogMatch = res.locals.catalogMatch;
    if (!isAiConfigured(config.ai)) {
      res.status(503).json({ message: 'ยังไม่ได้ตั้งค่า AI สำหรับประมาณสารอาหาร กรุณาค้นหาจากฐานข้อมูลอาหาร' });
      return;
    }
    if (!(await repository.claimDailyAiScan(res.locals.user.id, now(), config.ai.dailyScanLimit ?? 50))) {
      res.status(429).json({ message: 'ใช้โควตา AI วันนี้ครบแล้ว กรุณาลองใหม่วันพรุ่งนี้' });
      return;
    }
    try {
      res.json({ ingredient: await estimateIngredient(input, config.ai), catalogMatch });
    } catch (error) {
      if (error instanceof NotFoodError) {
        res.status(422).json({ message: 'ไม่รู้จักส่วนประกอบนี้ กรุณาระบุชื่ออาหารและวิธีปรุงให้ชัดเจน' });
      } else if (error instanceof AiRequestError) {
        res.status(error.status).json({ message: 'ประมาณสารอาหารไม่สำเร็จ ข้อมูลที่กรอกยังอยู่ กรุณาลองใหม่หรือค้นหาจากฐานข้อมูล' });
      } else throw error;
    }
  });
  app.get('/api/foods/catalog', requireAuth, async (req, res) => {
    const { q } = foodSearchQuerySchema.parse(req.query);
    res.json({ foods: await repository.searchFoods(res.locals.user.id, q) });
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
