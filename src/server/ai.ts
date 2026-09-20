import { z } from 'zod';
import { mealIngredientSchema } from '../shared/contracts.js';

const MAX_IMAGE_DATA_CHARS = 300_000;
const MAX_PROVIDER_RESPONSE_CHARS = 32_000;
const MAX_COMPLETION_CHARS = 12_000;

export const analyzeMealRequestSchema = z.object({
  imageData: z.string()
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, 'รูปภาพไม่ถูกต้อง')
    .max(MAX_IMAGE_DATA_CHARS, 'รูปภาพมีขนาดใหญ่เกินไป'),
}).strict();

const estimateIngredientSchema = mealIngredientSchema.refine(value => value.unit === 'g' && value.referenceUnit === 'g' && value.source === 'ai-estimate', 'AI ingredients must use gram references');

const providerEstimateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  ingredients: z.array(estimateIngredientSchema).min(1).max(20),
  portionDescription: z.string().trim().min(1).max(240),
  notes: z.array(z.string().trim().min(1).max(240)).max(4),
}).strict();

// Some OpenAI-compatible providers return a lone note as a string. Accept only
// that documented shape and validate the converted value against every bound.
const normalizedProviderEstimateSchema = z.preprocess(value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  return typeof record.notes === 'string' ? { ...record, notes: [record.notes] } : value;
}, providerEstimateSchema);

const providerResponseSchema = z.union([
  normalizedProviderEstimateSchema,
  z.object({ error: z.literal('not-food') }).strict(),
]);

export type MealAnalysis = z.infer<typeof providerEstimateSchema> & {
  source: 'ai-estimate';
};

export type AiConfiguration = {
  /** OpenAI-compatible /v1 base URL or complete /chat/completions endpoint. */
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  dailyScanLimit?: number;
};

export class AiRequestError extends Error {
  constructor(public readonly status: 502 | 504, message: string) { super(message); }
}

export class NotFoodError extends Error {}

export function parseDailyScanLimit(value: string | undefined): number {
  if (value === undefined || value.trim() === '') return 50;
  if (!/^\d+$/.test(value)) throw new Error('AI_DAILY_SCAN_LIMIT must be a whole number from 1 to 50');
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) throw new Error('AI_DAILY_SCAN_LIMIT must be a whole number from 1 to 50');
  return limit;
}

function configured(config?: AiConfiguration): config is Required<Pick<AiConfiguration, 'baseUrl' | 'apiKey' | 'model'>> & AiConfiguration {
  return Boolean(config?.baseUrl?.trim() && config.apiKey?.trim() && config.model?.trim());
}

function endpoint(baseUrl: string): URL {
  const url = new URL(baseUrl);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname.toLowerCase());
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) throw new Error('Invalid AI endpoint');
  if (url.username || url.password || url.hash) throw new Error('Invalid AI endpoint');
  url.pathname = url.pathname.replace(/\/$/, '');
  if (!url.pathname.endsWith('/chat/completions')) url.pathname += '/chat/completions';
  return url;
}

async function limitedText(response: Response, maximum: number): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maximum) throw new AiRequestError(502, 'Provider response was too large');
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maximum) {
        await reader.cancel();
        throw new AiRequestError(502, 'Provider response was too large');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(output);
}

export function isAiConfigured(config?: AiConfiguration) { return configured(config); }

export async function analyzeMealImage(imageData: string, config?: AiConfiguration): Promise<MealAnalysis> {
  if (!configured(config)) throw new AiRequestError(502, 'AI is not configured');
  let url: URL;
  try { url = endpoint(config.baseUrl); } catch { throw new AiRequestError(502, 'AI endpoint is invalid'); }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(Math.max(config.timeoutMs ?? 15_000, 1_000), 30_000));
  try {
    const response = await (config.fetch ?? fetch)(url, {
      method: 'POST', signal: controller.signal,
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 800,
        temperature: 0,
        messages: [
          { role: 'system', content: 'You estimate food visible in a meal image. Return JSON only, with no Markdown. If the image does not clearly show food or a drink intended for consumption, return exactly {"error":"not-food"}. Otherwise return exactly this shape: {"name":"ชื่ออาหาร","mealType":"lunch","ingredients":[{"name":"ชื่อส่วนผสม","amount":150,"unit":"g","referenceAmount":150,"referenceUnit":"g","source":"ai-estimate","referenceNutrients":{"caloriesKcal":0,"carbsGrams":0,"sugarGrams":0,"proteinGrams":0,"fatGrams":0}}],"portionDescription":"คำอธิบายปริมาณ","notes":["หมายเหตุความไม่แน่นอน"]}. Every ingredient MUST estimate a positive amount in grams and use unit and referenceUnit exactly g. referenceAmount is the gram amount for which its nutrient values apply; it may equal the estimated portion. Never use serving and never invent a 100 gram portion. Nutrients are for the reference amount and may be null when unknown. notes MUST be an array of 0 to 4 strings. All human-readable values must be in Thai. Estimates are uncertain: include uncertainty in Thai notes. Do not claim database verification. Include only visible or clearly likely ingredients.' },
          { role: 'user', content: [{ type: 'text', text: 'วิเคราะห์ภาพอาหารนี้เพื่อให้ผู้ใช้ตรวจสอบก่อนบันทึก กรุณาตอบตาม JSON ที่กำหนดเท่านั้น' }, { type: 'image_url', image_url: { url: imageData } }] },
        ],
      }),
    });
    if (!response.ok) {
      // Do not expose provider response details, which can contain operational data.
      throw new AiRequestError(502, 'Provider rejected the request');
    }
    const raw = await limitedText(response, MAX_PROVIDER_RESPONSE_CHARS);
    let envelope: unknown;
    try { envelope = JSON.parse(raw); } catch { throw new AiRequestError(502, 'Provider returned invalid JSON'); }
    const content = (envelope as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.length > MAX_COMPLETION_CHARS) throw new AiRequestError(502, 'Provider returned an invalid completion');
    let payload: unknown;
    try { payload = JSON.parse(content); } catch { throw new AiRequestError(502, 'Provider completion was not JSON'); }
    const parsed = providerResponseSchema.safeParse(payload);
    if (!parsed.success) throw new AiRequestError(502, 'Provider completion did not match the expected format');
    if ('error' in parsed.data) throw new NotFoodError();
    const caveat = 'เป็นการประเมินจากภาพเท่านั้น โปรดตรวจสอบส่วนผสมและปริมาณก่อนบันทึก';
    return { ...parsed.data, source: 'ai-estimate', notes: [...new Set([...parsed.data.notes, caveat])].slice(0, 5) };
  } catch (error) {
    if (error instanceof NotFoodError) throw error;
    if (error instanceof AiRequestError) throw error;
    if (controller.signal.aborted) throw new AiRequestError(504, 'Provider timed out');
    throw new AiRequestError(502, 'Provider request failed');
  } finally { clearTimeout(timeout); }
}
