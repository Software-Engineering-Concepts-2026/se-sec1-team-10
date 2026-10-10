import { spawnSync } from 'node:child_process';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import v8ToIstanbul from 'v8-to-istanbul';
import coverageLib from 'istanbul-lib-coverage';
import report from 'istanbul-lib-report';
import reports from 'istanbul-reports';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { createCoverageMap } = coverageLib;
const coverageDir = path.join(projectRoot, 'coverage');
const rawDir = path.join(coverageDir, 'browser', 'raw');
const unitCoveragePath = path.join(coverageDir, 'unit-coverage.json');
const summarizeOnly = process.argv.includes('--summarize-only');

function runNode(args, env = process.env) {
  const result = spawnSync(process.execPath, args, { cwd: projectRoot, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

let playwrightStatus = 0;
if (summarizeOnly) {
  try {
    const previous = JSON.parse(await readFile(path.join(coverageDir, 'summary.json'), 'utf8'));
    playwrightStatus = Number.isInteger(previous.result?.playwrightExitCode) ? previous.result.playwrightExitCode : null;
  } catch {
    playwrightStatus = null;
  }
}
if (!summarizeOnly) {
  const coverageRoot = path.resolve(coverageDir);
  const resolvedRawDir = path.resolve(rawDir);
  if (!resolvedRawDir.startsWith(`${coverageRoot}${path.sep}`)) {
    throw new Error('Refusing to clear browser coverage outside the coverage output directory.');
  }
  await rm(rawDir, { recursive: true, force: true });
  const vitestStatus = runNode(['node_modules/vitest/vitest.mjs', 'run', '--coverage']);
  if (vitestStatus !== 0) process.exit(vitestStatus);
  const freshUnitCoverage = await readFile(path.join(coverageDir, 'coverage-final.json'), 'utf8');
  await writeFile(unitCoveragePath, freshUnitCoverage);

  const browserEnv = { ...process.env, LIFEBALANCE_BROWSER_COVERAGE: '1' };
  playwrightStatus = runNode(['node_modules/@playwright/test/cli.js', 'test', '--workers=1'], browserEnv);
}

const unitCoverage = JSON.parse(await readFile(unitCoveragePath, 'utf8'));
const merged = createCoverageMap(structuredClone(unitCoverage));
const unitMap = createCoverageMap(unitCoverage);
const unitSourcePaths = new Set(unitMap.files().map(file => path.normalize(file)));
const rawFiles = (await readdir(rawDir).catch(() => [])).filter(file => file.endsWith('.json'));
if (rawFiles.length === 0) throw new Error('Browser coverage produced no raw coverage files.');

let convertedScripts = 0;
let mappedSources = 0;
const mappedSourceFiles = new Set();
for (const file of rawFiles) {
  const entries = JSON.parse(await readFile(path.join(rawDir, file), 'utf8'));
  for (const entry of entries) {
    const sourcePath = path.resolve(projectRoot, entry.url);
    const converter = v8ToIstanbul(sourcePath, 0, { source: entry.source });
    await converter.load();
    if (!converter.sourceMap) {
      throw new Error(`Missing Vite source map for browser script ${entry.url}; refusing to count generated JavaScript lines as TypeScript coverage.`);
    }
    converter.applyCoverage(entry.functions);
    const converted = converter.toIstanbul();
    const convertedPaths = Object.keys(converted);
    if (convertedPaths.length === 0 || convertedPaths.some(filePath => !unitSourcePaths.has(path.normalize(filePath)))) {
      throw new Error(`Vite source map for ${entry.url} did not resolve exclusively to the TypeScript source files already included by Vitest.`);
    }
    mappedSources += converter.sourceMap.sources.length;
    for (const filePath of convertedPaths) mappedSourceFiles.add(path.normalize(filePath));
    merged.merge(converted);
    convertedScripts += 1;
    converter.destroy();
  }
}
if (convertedScripts === 0) throw new Error('No Vite client/shared scripts were converted from browser coverage.');

const mergedJsonPath = path.join(coverageDir, 'coverage-final.json');
await writeFile(mergedJsonPath, JSON.stringify(merged.toJSON()));
const htmlDir = path.join(coverageDir, 'merged-html');
await mkdir(htmlDir, { recursive: true });
const context = report.createContext({ dir: htmlDir, coverageMap: merged, defaultSummarizer: 'nested' });
reports.create('text').execute(context);
reports.create('html').execute(context);
reports.create('lcovonly', { file: 'merged-lcov.info' }).execute(context);

const overall = merged.getCoverageSummary().toJSON();
const corePaths = [
  'src/server/health.ts',
  'src/server/meal.ts',
  'src/server/routes/activity.ts',
  'src/shared/contracts.ts',
].map(file => path.resolve(projectRoot, file));
function lineCounts(map, files) {
  let covered = 0;
  let total = 0;
  const byFile = files.map(file => {
    const lines = map.fileCoverageFor(file).getLineCoverage();
    const values = Object.values(lines);
    const fileTotal = values.length;
    const fileCovered = values.filter(count => count > 0).length;
    covered += fileCovered;
    total += fileTotal;
    return { file: path.relative(projectRoot, file).split(path.sep).join('/'), covered: fileCovered, total: fileTotal };
  });
  return { covered, total, pct: total ? covered / total * 100 : 0, files: byFile };
}
const unitCoreLines = lineCounts(unitMap, corePaths);
const mergedCoreLines = lineCounts(merged, corePaths);
const unexpectedFiles = merged.files().filter(file => !unitSourcePaths.has(path.normalize(file)));
if (unexpectedFiles.length > 0) {
  throw new Error(`Merged report contains paths outside the Vitest TypeScript denominator: ${unexpectedFiles.join(', ')}`);
}
const sourceFiles = [...unitSourcePaths];
if (sourceFiles.length === 0 || sourceFiles.some(file => !/src[\\/]((client|shared|server)[\\/]).+\.(ts|tsx)$/i.test(file))) {
  throw new Error('Vitest source denominator contains an unexpected path.');
}

const wholePass = overall.statements.pct >= 60 && overall.lines.pct >= 60;
const corePass = unitCoreLines.pct >= 80;
const summary = {
  command: 'npm run test:coverage:all',
  generatedAt: new Date().toISOString(),
  result: { vitest: 'passed', playwright: playwrightStatus === null ? 'not-run (summary-only)' : playwrightStatus === 0 ? 'passed' : 'failed', playwrightExitCode: playwrightStatus },
  sourceFiles: { total: sourceFiles.length, includedByVitest: sourceFiles.length, additionalMergedFiles: unexpectedFiles.length },
  coverage: {
    wholeSource: { statements: overall.statements, lines: overall.lines, branches: overall.branches, functions: overall.functions },
    nfr08BusinessLogic: { method: 'Vitest unit/API line coverage before browser merge', lines: unitCoreLines, mergedLines: mergedCoreLines },
  },
  browserSourceMaps: { e2eRuns: rawFiles.length, convertedViteScripts: convertedScripts, sourceMapEntries: mappedSources, uniqueTypeScriptFiles: mappedSourceFiles.size },
  thresholds: { wholeSourceStatements: 60, wholeSourceLines: 60, nfr08BusinessLogicLines: 80 },
  gates: { wholeSource: wholePass, nfr08BusinessLogic: corePass, tests: playwrightStatus === null ? null : playwrightStatus === 0 },
};
await writeFile(path.join(coverageDir, 'summary.json'), JSON.stringify(summary, null, 2));

const coreLines = unitCoreLines.pct;
const coreCovered = unitCoreLines.covered;
const coreTotal = unitCoreLines.total;
const mergedCorePct = mergedCoreLines.pct;
const expectedFilesCount = sourceFiles.length;
if (merged.files().length !== expectedFilesCount) {
  throw new Error(`Merged coverage has ${merged.files().length} files, expected the same ${expectedFilesCount} production TypeScript files as Vitest.`);
}

console.log(`\nBrowser coverage converted: ${convertedScripts} Vite scripts from ${rawFiles.length} E2E runs.`);
console.log(`Browser source maps resolved ${mappedSources} source entries across ${mappedSourceFiles.size} TypeScript files; the ${expectedFilesCount}-file denominator has no generated extras.`);
console.log(`NFR-08 business-logic line coverage: ${coreLines.toFixed(2)}% (${coreCovered}/${coreTotal}, unit/API tests); merged view ${mergedCorePct.toFixed(2)}%.`);
console.log(`Coverage gate: whole-source statements ${overall.statements.pct.toFixed(2)}% and lines ${overall.lines.pct.toFixed(2)}% (60% each); NFR-08 core lines ${coreLines.toFixed(2)}% (80%).`);

if (playwrightStatus !== null && playwrightStatus !== 0) process.exit(playwrightStatus);
if (!wholePass || !corePass) process.exit(1);
