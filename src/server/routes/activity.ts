import type { Express, RequestHandler } from "express";
import {
  dailyExerciseQuerySchema,
  exerciseSchema,
} from "../../shared/contracts.js";
import {
  calculateExerciseCalories,
  dateBounds,
  publicExercise,
} from "../exercise.js";
import { calculateBmi } from "../health.js";
import type { RouteContext } from "./context.js";

export function registerActivityRoutes(
  app: Express,
  context: RouteContext,
  requireAuth: RequestHandler,
) {
  const { repository } = context;
  app.get("/api/exercises/daily", requireAuth, async (req, res) => {
    const query = dailyExerciseQuerySchema.parse(req.query);
    const { start, end } = dateBounds(query.date);
    const exercises = (
      await repository.listExercises(res.locals.user.id, start, end)
    ).map(publicExercise);
    const caloriesConsumed = (
      await repository.listMeals(res.locals.user.id, start, end)
    ).reduce((total, meal) => total + meal.totalCalories, 0);
    const caloriesBurned = exercises.reduce(
      (total, exercise) => total + exercise.caloriesBurned,
      0,
    );
    res.json({
      date: query.date,
      exercises,
      caloriesConsumed,
      caloriesBurned,
      netCalories: caloriesConsumed - caloriesBurned,
    });
  });
  app.get("/api/health-history", requireAuth, async (_req, res) => {
    const start = new Date();
    start.setFullYear(start.getFullYear() - 1);
    const points = (
      await repository.listWeightLogs(res.locals.user.id, start)
    ).map((point) => ({
      date: point.loggedAt.toISOString().slice(0, 10),
      weightKg: point.weightKg,
      bmi: calculateBmi(point.weightKg, point.heightCm),
    }));
    res.json({ points, rangeDays: 365, performanceTargetMs: 1500 });
  });
  app.get("/api/summary/weekly", requireAuth, async (req, res) => {
    const { date } = dailyExerciseQuerySchema.parse(req.query);
    const { end } = dateBounds(date);
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    const [meals, exercises] = await Promise.all([
      repository.listMeals(res.locals.user.id, start, end),
      repository.listExercises(res.locals.user.id, start, end),
    ]);
    const dates = Array.from({ length: 7 }, (_, index) =>
      new Date(start.getTime() + index * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10),
    );
    const days = dates.map((day) => {
      const caloriesConsumed = meals
        .filter((meal) => meal.activityDate === day)
        .reduce((total, meal) => total + meal.totalCalories, 0);
      const caloriesBurned = exercises
        .filter((exercise) => exercise.activityDate === day)
        .reduce((total, exercise) => total + exercise.caloriesBurned, 0);
      return {
        date: day,
        caloriesConsumed,
        caloriesBurned,
        netCalories: caloriesConsumed - caloriesBurned,
      };
    });
    res.json({
      startDate: dates[0],
      endDate: date,
      days,
      caloriesConsumed: days.reduce(
        (total, day) => total + day.caloriesConsumed,
        0,
      ),
      caloriesBurned: days.reduce(
        (total, day) => total + day.caloriesBurned,
        0,
      ),
    });
  });
  app.post("/api/exercises", requireAuth, async (req, res) => {
    const data = exerciseSchema.parse(req.body);
    const weightKg = res.locals.user.weightKg;
    if (weightKg === null) {
      res
        .status(409)
        .json({
          message: "กรุณาบันทึกน้ำหนักในข้อมูลส่วนตัวก่อนคำนวณการออกกำลังกาย",
        });
      return;
    }
    const caloriesBurned = calculateExerciseCalories(
      data.activityType,
      weightKg,
      data.durationMinutes,
    );
    const exercise = await repository.createExercise(
      res.locals.user.id,
      data,
      weightKg,
      caloriesBurned,
    );
    res
      .status(201)
      .json({
        exercise: publicExercise(exercise),
        message: "บันทึกการออกกำลังกายแล้ว",
      });
  });
  app.put("/api/exercises/:id", requireAuth, async (req, res) => {
    const data = exerciseSchema.parse(req.body);
    const weightKg = res.locals.user.weightKg;
    if (weightKg === null) {
      res
        .status(409)
        .json({
          message: "กรุณาบันทึกน้ำหนักในข้อมูลส่วนตัวก่อนคำนวณการออกกำลังกาย",
        });
      return;
    }
    const caloriesBurned = calculateExerciseCalories(
      data.activityType,
      weightKg,
      data.durationMinutes,
    );
    const exercise = await repository.updateExercise(
      String(req.params.id),
      res.locals.user.id,
      data,
      weightKg,
      caloriesBurned,
    );
    if (!exercise) {
      res.status(404).json({ message: "ไม่พบรายการออกกำลังกาย" });
      return;
    }
    res.json({
      exercise: publicExercise(exercise),
      message: "แก้ไขการออกกำลังกายแล้ว",
    });
  });
  app.delete("/api/exercises/:id", requireAuth, async (req, res) => {
    const deleted = await repository.deleteExercise(
      String(req.params.id),
      res.locals.user.id,
    );
    if (!deleted) {
      res.status(404).json({ message: "ไม่พบรายการออกกำลังกาย" });
      return;
    }
    res.status(204).end();
  });
}
