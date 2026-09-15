import express from 'express';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { createApp } from './app.js';
import { prismaRepository } from './repository.js';
import { parseDailyScanLimit } from './ai.js';

const db = new PrismaClient();
const production = process.env.NODE_ENV === 'production';
const app = createApp(prismaRepository(db), {
  jwtSecret: process.env.JWT_SECRET ?? '',
  appOrigin: process.env.APP_ORIGIN ?? 'http://localhost:5173', production,
  ai: {
    baseUrl: process.env.AI_BASE_URL,
    apiKey: process.env.AI_API_KEY,
    model: process.env.AI_MODEL,
    dailyScanLimit: parseDailyScanLimit(process.env.AI_DAILY_SCAN_LIMIT),
  },
  nutrition: { apiKey: process.env.NUTRITION_API_KEY },
});
if (production) {
  app.use(express.static(resolve('dist/client')));
  app.get('/{*path}', (_req, res) => { res.sendFile(resolve('dist/client/index.html')); });
}
await db.$connect();
const server = app.listen(Number(process.env.PORT ?? 3000), '127.0.0.1', () => {
  console.log(`LifeBalance API listening on http://localhost:${process.env.PORT ?? 3000}`);
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { server.close(() => { void db.$disconnect().then(() => process.exit(0)); }); });
}
