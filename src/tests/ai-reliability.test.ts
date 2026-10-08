import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyzeMealImage, NotFoodError, parseAiTimeoutMs } from '../server/ai.js';

const image = 'data:image/png;base64,AAAA';
const estimate = {
  name: 'ข้าว', mealType: 'lunch', ingredients: [{ name: 'ข้าว', amount: 100, unit: 'g', referenceAmount: 100, referenceUnit: 'g', source: 'ai-estimate',
    referenceNutrients: { caloriesKcal: 130, carbsGrams: 28, sugarGrams: 0, proteinGrams: 3, fatGrams: 0.3 } }], portionDescription: 'หนึ่งจาน', notes: [],
};
const completion = (content: string, finish_reason = 'stop') => new Response(JSON.stringify({ choices: [{ finish_reason, message: { content } }] }));
const config = (fetch: typeof globalThis.fetch, timeoutMs?: number) => ({ baseUrl: 'https://private-provider.test/v1', apiKey: 'private-key', model: 'food', fetch, timeoutMs });
afterEach(() => vi.useRealTimers());

describe('AI response reliability', () => {
  it('validates the timeout range and defaults to 45 seconds', () => {
    for (const value of [undefined, '', ' ']) expect(parseAiTimeoutMs(value)).toBe(45_000);
    for (const value of ['1000', '45000', '60000']) expect(parseAiTimeoutMs(value)).toBe(Number(value));
    for (const value of ['999', '60001', '-1000', '1.5', '1e4', 'Infinity', 'NaN', '1000ms', ' 1000 ', '9007199254740993']) expect(() => parseAiTimeoutMs(value)).toThrow(/AI_TIMEOUT_MS/);
  });

  it('allows a delayed completion beyond the old 15-second budget without retrying', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const fetch = vi.fn<typeof globalThis.fetch>(async (_url, init) => {
      signal = init?.signal ?? undefined;
      return new Promise<Response>((resolve, reject) => {
        const timer = setTimeout(() => resolve(completion(JSON.stringify(estimate))), 20_000);
        signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('private transport details')); });
      });
    });
    const result = analyzeMealImage(image, config(fetch));
    await vi.advanceTimersByTimeAsync(16_000);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(4_000);
    await expect(result).resolves.toMatchObject({ name: estimate.name });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    const body = JSON.parse(String(fetch.mock.calls[0][1]?.body));
    expect(body.max_tokens).toBe(2400);
    expect(body.messages[0].content).toContain('compact minified JSON');
  });

  it('aborts exactly at an explicitly supplied budget and clears the timer', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const fetch = vi.fn<typeof globalThis.fetch>(async (_url, init) => new Promise((_resolve, reject) => {
      signal = init?.signal ?? undefined;
      signal?.addEventListener('abort', () => reject(new Error('private-key private-provider.test')));
    }));
    const result = analyzeMealImage(image, config(fetch, 1000));
    const assertion = expect(result).rejects.toMatchObject({ status: 504, reason: 'timeout', message: 'timeout' });
    await vi.advanceTimersByTimeAsync(999);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
    expect(signal?.aborted).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['json', ''])('accepts one enclosing %s fence and preserves non-food validation', async language => {
    const fence = (payload: unknown) => `  \x60\x60\x60${language}\n${JSON.stringify(payload)}\n\x60\x60\x60  `;
    await expect(analyzeMealImage(image, config(async () => completion(fence(estimate))))).resolves.toMatchObject({ ingredients: estimate.ingredients });
    await expect(analyzeMealImage(image, config(async () => completion(fence({ error: 'not-food' }))))).rejects.toBeInstanceOf(NotFoodError);
  });

  it.each([
    'Here is the JSON: ' + JSON.stringify(estimate),
    `\x60\x60\x60json\n${JSON.stringify(estimate)}\n\x60\x60\x60\nextra`,
    `\x60\x60\x60json\n${JSON.stringify(estimate)}\n\x60\x60\x60\n\x60\x60\x60json\n{}\n\x60\x60\x60`,
    JSON.stringify(estimate).slice(0, -1),
    '{/*comment*/"error":"not-food"}',
    JSON.stringify({ ...estimate, ingredients: [{ ...estimate.ingredients[0], amount: '100' }] }),
    JSON.stringify({ error: 'not-food', notes: [] }),
  ])('rejects malformed or nonconforming completions strictly', async content => {
    await expect(analyzeMealImage(image, config(async () => completion(content)))).rejects.toMatchObject({ status: 502, reason: 'invalid_response', upstreamStatus: 200 });
  });

  it('rejects length-truncated results even if the completion happens to be valid JSON', async () => {
    await expect(analyzeMealImage(image, config(async () => completion(JSON.stringify(estimate), 'length')))).rejects.toMatchObject({ reason: 'truncated_response' });
  });

  it.each([[429, 'upstream_rate_limit'], [503, 'upstream_unavailable'], [401, 'upstream_rejected']] as const)('sanitizes upstream HTTP %s', async (status, reason) => {
    await expect(analyzeMealImage(image, config(async () => new Response('private-key private-provider.test secret body', { status })))).rejects.toMatchObject({ status: 502, reason, message: reason, upstreamStatus: status });
  });

  it('sanitizes network exceptions', async () => {
    await expect(analyzeMealImage(image, config(async () => { throw new Error('private-key private-provider.test'); }))).rejects.toMatchObject({ reason: 'network', message: 'network' });
  });
});
