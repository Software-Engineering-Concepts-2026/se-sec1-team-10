import type { Express, RequestHandler } from "express";
import {
  dailyExerciseQuerySchema,
  exerciseSchema,
  weightLogSchema,
} from "../../shared/contracts.js";
import {
  calculateExerciseCalories,
  dateBounds,
  weeklyDateWindow,
  publicExercise,
} from "../exercise.js";
import { calculateBmi } from "../health.js";
import type { RouteContext } from "./context.js";
import { publicWeightLog, weightDateIssue, weightHistoryStart, weightTimestamp } from '../weight.js';

export function registerActivityRoutes(
  app: Express,
  context: RouteContext,
  requireAuth: RequestHandler,
) {
  const { repository, now, publicUser } = context;
  app.get('/api/weight-logs', requireAuth, async (_req, res) => {
    const start = weightHistoryStart(now());
    const logs = await repository.listWeightLogs(res.locals.user.id, start);
    res.json({ logs: logs.map(publicWeightLog).reverse() });
  });
  app.post('/api/weight-logs', requireAuth, async (req, res) => {
    const input = weightLogSchema.parse(req.body);
    const issue = weightDateIssue(input.date, now());
    if (issue) { res.status(400).json(issue); return; }
    if (res.locals.user.heightCm == null) {
      res.status(409).json({ message: 'กรุณาเพิ่มส่วนสูงในข้อมูลส่วนตัวก่อนบันทึกน้ำหนัก' }); return;
    }
    const saved = await repository.createWeightLog(res.locals.user.id, input.weightKg, res.locals.user.heightCm, weightTimestamp(input.date, now()));
    res.status(201).json({ log: publicWeightLog(saved.log), user: publicUser(saved.user), message: 'บันทึกน้ำหนักแล้ว' });
  });
  app.put('/api/weight-logs/:id', requireAuth, async (req, res) => {
    const input = weightLogSchema.parse(req.body);
    const issue = weightDateIssue(input.date, now());
    if (issue) { res.status(400).json(issue); return; }
    const saved = await repository.updateWeightLog(String(req.params.id), res.locals.user.id, input.weightKg, weightTimestamp(input.date, now()));
    if (!saved) { res.status(404).json({ message: 'ไม่พบรายการน้ำหนัก' }); return; }
    res.json({ log: publicWeightLog(saved.log), user: publicUser(saved.user), message: 'แก้ไขน้ำหนักแล้ว' });
  });
  app.delete('/api/weight-logs/:id', requireAuth, async (req, res) => {
    const user = await repository.deleteWeightLog(String(req.params.id), res.locals.user.id);
    if (!user) { res.status(404).json({ message: 'ไม่พบรายการน้ำหนัก' }); return; }
    res.json({ user: publicUser(user), message: 'ลบรายการน้ำหนักแล้ว' });
  });
  app.get("/api/exercises/daily", requireAuth, async (req, res) => {
    const query = dailyExerciseQuerySchema.parse(req.query);
    const { start, end } = dateBounds(query.date);
    const [exerciseRecords, meals] = await Promise.all([
      repository.listExercises(res.locals.user.id, start, end),
      repository.listMeals(res.locals.user.id, start, end),
    ]);
    const exercises = exerciseRecords.map(publicExercise);
    const caloriesConsumed = meals.reduce((total, meal) => total + meal.totalCalories, 0);
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
    const start = weightHistoryStart(now());
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
    const { start, end, selectedEnd, dates } = weeklyDateWindow(date);
    const [meals, exercises] = await Promise.all([
      repository.listMeals(res.locals.user.id, start, end),
      repository.listExercises(res.locals.user.id, start, end),
    ]);
    // Index the selected days once instead of repeatedly scanning the full week.
    const totalsByDate = new Map(dates.map(day => [day, {
      date: day, mealCount: 0, caloriesConsumed: 0, caloriesBurned: 0,
    }]));
    for (const meal of meals) {
      const day = totalsByDate.get(meal.activityDate);
      if (day) {
        day.mealCount += 1;
        day.caloriesConsumed += meal.totalCalories;
      }
    }
    for (const exercise of exercises) {
      const day = totalsByDate.get(exercise.activityDate);
      if (day) day.caloriesBurned += exercise.caloriesBurned;
    }
    const days = [...totalsByDate.values()].map(day => ({
      ...day, netCalories: day.caloriesConsumed - day.caloriesBurned,
    }));
    res.json({
      startDate: dates[0],
      endDate: selectedEnd.toISOString().slice(0, 10),
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
          message: "กรุณาบันทึกน้ำหนักก่อนคำนวณการออกกำลังกาย",
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
          message: "กรุณาบันทึกน้ำหนักก่อนคำนวณการออกกำลังกาย",
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
