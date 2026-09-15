import { z } from 'zod';

const USDA_SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';
const MAX_RESPONSE_CHARS = 64_000;

export const foodSearchQuerySchema = z.object({
  q: z.string().trim().min(2, 'กรุณาระบุชื่ออาหารอย่างน้อย 2 ตัวอักษร').max(80, 'คำค้นหายาวเกินไป'),
}).strict();

export type NutritionConfiguration = {
  apiKey?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

export type FoodSearchResult = {
  fdcId: number;
  name: string;
  dataType: string | null;
  nutrientsPer100g: { caloriesKcal: number | null; carbsGrams: number | null; proteinGrams: number | null; fatGrams: number | null; sugarGrams: number | null };
  source: 'usda-fdc';
  url: string;
};

export class NutritionRequestError extends Error {
  constructor(public readonly status: 502 | 504, message: string) { super(message); }
}

export function isNutritionConfigured(config?: NutritionConfiguration): config is Required<Pick<NutritionConfiguration, 'apiKey'>> & NutritionConfiguration {
  return Boolean(config?.apiKey?.trim());
}

async function readLimited(response: Response): Promise<string> {
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_CHARS) throw new NutritionRequestError(502, 'Nutrition response was too large');
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_RESPONSE_CHARS) {
        await reader.cancel();
        throw new NutritionRequestError(502, 'Nutrition response was too large');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(output);
}

function nutrientValue(nutrients: unknown, ids: number[]): number | null {
  if (!Array.isArray(nutrients)) return null;
  for (const item of nutrients) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const nested = record.nutrient && typeof record.nutrient === 'object' ? record.nutrient as Record<string, unknown> : {};
    const id = record.nutrientId ?? nested.id;
    const value = record.value ?? record.amount;
    if (typeof id === 'number' && ids.includes(id) && typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  }
  return null;
}

export async function searchUsdaFoods(query: string, config?: NutritionConfiguration): Promise<FoodSearchResult[]> {
  if (!isNutritionConfigured(config)) throw new NutritionRequestError(502, 'Nutrition provider is not configured');
  const url = new URL(USDA_SEARCH_URL);
  url.searchParams.set('api_key', config.apiKey.trim());
  url.searchParams.set('query', query);
  url.searchParams.set('pageSize', '5');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(Math.max(config.timeoutMs ?? 10_000, 1_000), 30_000));
  try {
    const response = await (config.fetch ?? fetch)(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new NutritionRequestError(502, 'Nutrition provider rejected the request');
    let payload: unknown;
    try { payload = JSON.parse(await readLimited(response)); } catch (error) {
      if (error instanceof NutritionRequestError) throw error;
      throw new NutritionRequestError(502, 'Nutrition provider returned invalid JSON');
    }
    const foods = (payload as { foods?: unknown }).foods;
    if (!Array.isArray(foods)) throw new NutritionRequestError(502, 'Nutrition provider returned an invalid response');
    return foods.slice(0, 5).flatMap(food => {
      if (!food || typeof food !== 'object') return [];
      const record = food as Record<string, unknown>;
      if (typeof record.fdcId !== 'number' || !Number.isSafeInteger(record.fdcId) || typeof record.description !== 'string' || !record.description.trim()) return [];
      return [{
        fdcId: record.fdcId,
        name: record.description.trim().slice(0, 240),
        dataType: typeof record.dataType === 'string' ? record.dataType.slice(0, 80) : null,
        nutrientsPer100g: {
          caloriesKcal: nutrientValue(record.foodNutrients, [1008, 2047, 2048]),
          carbsGrams: nutrientValue(record.foodNutrients, [1005]),
          proteinGrams: nutrientValue(record.foodNutrients, [1003]),
          fatGrams: nutrientValue(record.foodNutrients, [1004]),
          sugarGrams: nutrientValue(record.foodNutrients, [2000, 1063]),
        },
        source: 'usda-fdc' as const,
        url: `https://fdc.nal.usda.gov/food-details/${record.fdcId}/nutrients`,
      }];
    });
  } catch (error) {
    if (error instanceof NutritionRequestError) throw error;
    if (controller.signal.aborted) throw new NutritionRequestError(504, 'Nutrition provider timed out');
    throw new NutritionRequestError(502, 'Nutrition provider request failed');
  } finally { clearTimeout(timeout); }
}
