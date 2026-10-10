import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { expect, test as base, type Response } from '@playwright/test';

type BrowserCoverage = {
  url: string;
  functions: Array<{ functionName: string; ranges: Array<{ startOffset: number; endOffset: number; count: number }>; isBlockCoverage: boolean }>;
  source: string;
};

const coverageEnabled = process.env.LIFEBALANCE_BROWSER_COVERAGE === '1';
const sourcePath = (url: string) => {
  try {
    const pathname = new URL(url).pathname;
    if (!/^\/src\/(?:client|shared)\/.+\.(?:ts|tsx)$/.test(pathname)) return null;
    return pathname;
  } catch {
    return null;
  }
};

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    if (!coverageEnabled) {
      await use(page);
      return;
    }

    const cdp = await page.context().newCDPSession(page);
    const sources = new Map<string, string>();
    const pendingResponses: Promise<void>[] = [];
    const onResponse = (response: Response) => {
      const pathname = sourcePath(response.url());
      if (!pathname || !response.headers()['content-type']?.includes('javascript')) return;
      pendingResponses.push(response.text().then(source => { sources.set(pathname, source); }).catch(() => {}));
    };

    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
    page.on('response', onResponse);
    try {
      await use(page);
    } finally {
      const { result } = await cdp.send('Profiler.takePreciseCoverage');
      await Promise.all(pendingResponses);
      const entries: BrowserCoverage[] = result.flatMap((script: { url: string; functions: BrowserCoverage['functions'] }) => {
        const pathname = sourcePath(script.url);
        const source = pathname && sources.get(pathname);
        return pathname && source ? [{ url: `src${pathname.slice('/src'.length)}`, functions: script.functions, source }] : [];
      });

      const rawDir = path.join(process.cwd(), 'coverage', 'browser', 'raw');
      await mkdir(rawDir, { recursive: true });
      await writeFile(path.join(rawDir, `${testInfo.testId}-${randomUUID()}.json`), JSON.stringify(entries));
      page.off('response', onResponse);
      await cdp.send('Profiler.stopPreciseCoverage');
      await cdp.detach();
    }
  },
});

export { expect };
export type { Page, Route } from '@playwright/test';
