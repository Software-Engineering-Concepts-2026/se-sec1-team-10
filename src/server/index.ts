import express from 'express';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { createApp } from './app.js';
import { prismaRepository } from './repository.js';
import { parseDailyScanLimit, parseAiTimeoutMs } from './ai.js';

const db = new PrismaClient();
const production = process.env.NODE_ENV === 'production';
const appOrigin = process.env.APP_ORIGIN ?? (production ? '' : 'http://localhost:5173');
if (production) {
  let origin: URL;
  try {
    origin = new URL(appOrigin);
  } catch {
    throw new Error('APP_ORIGIN must be the HTTPS origin of the public LifeBalance deployment');
  }
  if (origin.protocol !== 'https:' || origin.hostname === 'localhost' || origin.hostname === '127.0.0.1' || origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password) {
    throw new Error('APP_ORIGIN must be the HTTPS origin of the public LifeBalance deployment (for example, https://lifebalance.example.com)');
  }
}
const app = createApp(prismaRepository(db), {
  jwtSecret: process.env.JWT_SECRET ?? '',
  appOrigin, production,
  trustProxyHops: process.env.TRUST_PROXY_HOPS === undefined
    ? undefined
    : Number(process.env.TRUST_PROXY_HOPS),
  ai: {
    baseUrl: process.env.AI_BASE_URL,
    apiKey: process.env.AI_API_KEY,
    model: process.env.AI_MODEL,
    dailyScanLimit: parseDailyScanLimit(process.env.AI_DAILY_SCAN_LIMIT),
    timeoutMs: parseAiTimeoutMs(process.env.AI_TIMEOUT_MS),
  },
  nutrition: { apiKey: process.env.NUTRITION_API_KEY },
});
if (production) {
  app.use(express.static(resolve('dist/client')));
  app.get('/{*path}', (_req, res) => { res.sendFile(resolve('dist/client/index.html')); });
}
await db.$connect();
const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? 3000);
const server = app.listen(port, host, () => {
  console.log(`LifeBalance API listening on http://${host}:${port}`);
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { server.close(() => { void db.$disconnect().then(() => process.exit(0)); }); });
}
