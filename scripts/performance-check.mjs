import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { availableParallelism, totalmem, platform, arch } from 'node:os';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../dist/server/security.js';

// All writes target a database created by this process. No .env or external URL is accepted.
const image = process.argv[2];
assert.ok(image, 'Usage: node scripts/performance-check.mjs <locally-built-image>');
const id = randomUUID().slice(0, 8);
const network = `lifebalance-perf-${id}`;
const containers = [];
const database = `${network}-db`;
const application = `${network}-app`;
const password = randomUUID();
const origin = 'https://lifebalance-performance.invalid';
const results = {
  image, measuredAt: new Date().toISOString(),
  environment: { hostPlatform: platform(), hostArchitecture: arch(), cpuParallelism: availableParallelism(), hostMemoryGiB: +(totalmem()/2**30).toFixed(1), database: 'disposable PostgreSQL 17', app: 'production Docker image', network: 'loopback / Docker bridge' },
  scope: { users: 100, recordsPerUser: 1000, records: { meals: 500, weights: 300, exercises: 200 }, imagePayloads: false, aiCalls: 0, productionRequests: 0, databaseMocked: false },
  metrics: {}, passed: false, cleanup: false,
};
let networkCreated = false;
let db;
let migrationDirectory;
let phase = 'inspect image';
const keepAlive = setInterval(() => {}, 1000);
function docker(...args) {
  return execFileSync(process.env.DOCKER_EXECUTABLE || 'docker', args, {encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:120000,windowsHide:true}).trim();
}
const pause = () => new Promise(resolve => setTimeout(resolve, 300));
async function ready(check) {
  for(let i=0;i<100;i++) { try { if(await check()) return; } catch {} await pause(); }
  throw new Error('Readiness timeout');
}
const day = new Date().toISOString().slice(0,10);
const endDate = new Date(`${day}T00:00:00.000Z`);
function dateAt(offset) { return new Date(endDate.getTime() - offset*86400000); }
function summary(samples, thresholdMs) {
  const sorted = samples.map(x=>x.ms).sort((a,b)=>a-b);
  const percentile = p => +sorted[Math.max(0,Math.ceil(sorted.length*p)-1)].toFixed(2);
  const successful = samples.filter(x=>x.ok);
  return {count:samples.length,errors:samples.length-successful.length,errorRatePct:+((samples.length-successful.length)/samples.length*100).toFixed(2),p50Ms:percentile(.5),p95Ms:percentile(.95),maxMs:percentile(1),thresholdMs,withinThresholdPct:+(samples.filter(x=>x.ok&&x.ms<=thresholdMs).length/samples.length*100).toFixed(2),samples:samples.map(x=>({ms:+x.ms.toFixed(2),ok:x.ok}))};
}
try {
  results.imageId = docker('image','inspect','--format','{{.Id}}',image);
  const revision = docker('image','inspect','--format','{{index .Config.Labels "org.opencontainers.image.revision"}}',image);
  results.sourceRevision = /^[a-f0-9]{40}$/.test(revision) ? revision : null;
  phase = 'create disposable database';
  docker('network','create',network); networkCreated=true;
  docker('run','-d','--name',database,'--network',network,'-p','127.0.0.1::5432','--label','lifebalance.test=performance',
    '-e','POSTGRES_USER=performance','-e',`POSTGRES_PASSWORD=${password}`,'-e','POSTGRES_DB=lifebalance','postgres:17-alpine');
  containers.push(database);
  await ready(()=>{docker('exec',database,'pg_isready','-U','performance','-d','lifebalance');return true;});
  const dbPort=JSON.parse(docker('inspect',database))[0].NetworkSettings.Ports['5432/tcp'][0].HostPort;
  const databaseUrl=`postgresql://performance:${password}@127.0.0.1:${dbPort}/lifebalance`;
  phase='apply existing migrations to disposable database';
  // Prisma searches upward to the nearest package.json before discovering .env. Give this
  // isolated directory its own package boundary so it cannot reach the developer's .env.
  await mkdir('.local',{recursive:true});
  migrationDirectory=await mkdtemp(path.resolve('.local/performance-migrations-'));
  await writeFile(path.join(migrationDirectory,'package.json'),JSON.stringify({name:'lifebalance-isolated-migration',private:true}));
  await cp('prisma/schema.prisma',path.join(migrationDirectory,'schema.prisma'));
  await cp('prisma/migrations',path.join(migrationDirectory,'migrations'),{recursive:true});
  execFileSync(process.execPath,[path.resolve('node_modules/prisma/build/index.js'),'migrate','deploy','--schema','schema.prisma'],{cwd:migrationDirectory,env:{...process.env,DATABASE_URL:databaseUrl},stdio:['ignore','pipe','pipe'],timeout:120000,windowsHide:true});
  db=new PrismaClient({datasourceUrl:databaseUrl});
  phase='seed synthetic users and 1000 records each';
  const sharedHash=await hashPassword(password);
  const users=Array.from({length:100},(_,index)=>({id:randomUUID(),email:`performance-${id}-${index}@example.test`,displayName:'Synthetic performance user',passwordHash:sharedHash,age:30,heightCm:175,weightKg:70,dailyCalorieTarget:2000}));
  await db.user.createMany({data:users});
  for(const user of users) {
    const meals=Array.from({length:500},(_,i)=>({id:randomUUID(),userId:user.id,name:'Synthetic rice meal',mealType:['breakfast','lunch','dinner'][i%3],totalCalories:260,activityDate:dateAt(i%365)}));
    await db.mealLog.createMany({data:meals});
    await db.mealIngredient.createMany({data:meals.map(meal=>({mealLogId:meal.id,name:'Synthetic rice',amount:200,unit:'g',referenceAmount:100,referenceUnit:'g',source:'manual',carbsGrams:56,sugarGrams:0,proteinGrams:6,fatGrams:2,referenceCaloriesKcal:130,referenceCarbsGrams:28,referenceSugarGrams:0,referenceProteinGrams:3,referenceFatGrams:1}))});
    await db.weightLog.createMany({data:Array.from({length:300},(_,i)=>({userId:user.id,weightKg:70+i%3*.1,heightCm:175,loggedAt:dateAt(i)}))});
    await db.exerciseLog.createMany({data:Array.from({length:200},(_,i)=>({userId:user.id,activityType:'walking',durationMinutes:30,weightKg:70,caloriesBurned:100,activityDate:dateAt(i)}))});
  }
  phase='start isolated production container';
  docker('run','-d','--name',application,'--network',network,'-p','127.0.0.1::10000','--label','lifebalance.test=performance',
    '-e','NODE_ENV=production','-e','PORT=10000','-e','HOST=0.0.0.0','-e',`APP_ORIGIN=${origin}`,'-e','TRUST_PROXY_HOPS=1',
    '-e',`JWT_SECRET=${randomUUID()}${randomUUID()}`,'-e',`DATABASE_URL=postgresql://performance:${password}@${database}:5432/lifebalance`,image);
  containers.push(application);
  const appPort=JSON.parse(docker('inspect',application))[0].NetworkSettings.Ports['10000/tcp'][0].HostPort;
  const base=`http://127.0.0.1:${appPort}`;
  await ready(async()=> (await fetch(`${base}/api/health`,{signal:AbortSignal.timeout(1000)})).ok);
  const httpSamples=[];
  async function request(path,index,{method='GET',body,cookie,status=200}={}) {
    const start=performance.now();let ok=false;
    try {
      const response=await fetch(`${base}/api${path}`,{method,headers:{Origin:origin,'Content-Type':'application/json',
        // Synthetic distinct clients arrive through the same trusted proxy hop as production.
        'X-Forwarded-For':`203.0.113.${index+1}`,...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
      assert.equal(response.status,status,`${method} ${path} HTTP ${response.status}`);
      const result={data:response.status===204?null:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
      ok=true;return result;
    } finally {httpSamples.push({ms:performance.now()-start,ok});}
  }
  const sessions=[];
  const loginSamples=[];
  // Exercise the real login route without disabling its per-IP limiter.
  phase='100 concurrent logins';
  await Promise.all(users.map(async(user,index)=>{
    const start=performance.now();
    try { const login=await request('/auth/login',index,{method:'POST',body:{email:user.email,password}});assert.ok(login.cookie);sessions[index]=login.cookie;loginSamples.push({ms:performance.now()-start,ok:true}); }
    catch {loginSamples.push({ms:performance.now()-start,ok:false});}
  }));
  results.metrics.concurrentLogin=summary(loginSamples,2000);
  assert.equal(sessions.filter(Boolean).length,100,'All synthetic users must authenticate successfully');
  async function dashboard(index,{history=false}={}) {
    const paths=[`/exercises/daily?date=${day}`,`/meals/daily?date=${day}`];
    if(history) paths.push('/health-history','/weight-logs',`/summary/weekly?date=${day}`);
    const settled=await Promise.allSettled(paths.map(path=>request(path,index,{cookie:sessions[index]})));
    assert.ok(settled.every(item=>item.status==='fulfilled'),'Dashboard bundle must finish every request');
    const responses=settled.map(item=>item.value);
    assert.equal(responses[0].data.caloriesConsumed,responses[1].data.caloriesConsumed);
    if(history) assert.equal(responses[2].data.points.length,300);
  }
  phase='warm and measure year-history API bundles';
  await dashboard(0,{history:true});
  const historySamples=[];
  for(let i=0;i<20;i++) {
    const start=performance.now();
    try {await dashboard(0,{history:true});historySamples.push({ms:performance.now()-start,ok:true});}
    catch {historySamples.push({ms:performance.now()-start,ok:false});}
  }
  results.metrics.yearHistoryApiBundle=summary(historySamples,1500);
  phase='save and verify refreshed daily totals';
  const updateSamples=[];
  const readAfterSaveSamples=[];
  for(let i=0;i<20;i++) {
    const before=(await request(`/meals/daily?date=${day}`,0,{cookie:sessions[0]})).data.caloriesConsumed;
    const body={name:'Synthetic update measurement',mealType:'snack',activityDate:day,ingredients:[{name:'Synthetic rice',amount:100,unit:'g',referenceAmount:100,referenceUnit:'g',source:'manual',referenceNutrients:{caloriesKcal:130,carbsGrams:28,sugarGrams:0,proteinGrams:3,fatGrams:1}}]};
    const start=performance.now();
    try {
      await request('/meals',0,{method:'POST',body,cookie:sessions[0],status:201});
      const acknowledged=performance.now();
      await dashboard(0);
      const after=(await request(`/meals/daily?date=${day}`,0,{cookie:sessions[0]})).data.caloriesConsumed;
      assert.equal(after,before+130);
      const end=performance.now();
      updateSamples.push({ms:end-start,ok:true});readAfterSaveSamples.push({ms:end-acknowledged,ok:true});
    } catch {updateSamples.push({ms:performance.now()-start,ok:false});readAfterSaveSamples.push({ms:performance.now()-start,ok:false});}
  }
  results.metrics.saveThenReadApi=summary(updateSamples,2000);
  results.metrics.afterSaveReadApi=summary(readAfterSaveSamples,2000);
  phase='100 concurrent user journeys: view, save, refresh';
  const loadSamples=[];
  const loadDashboardSamples=[];
  for(let round=0;round<3;round++) {
    await Promise.all(users.map(async(_user,index)=>{
      const start=performance.now();
      let dashboardRecorded=false;
      try {
        await dashboard(index);
        const viewed=performance.now();
        loadDashboardSamples.push({ms:viewed-start,ok:true});
        dashboardRecorded=true;
        const body={name:'Synthetic load meal',mealType:'lunch',activityDate:day,ingredients:[{name:'Synthetic rice',amount:100,unit:'g',referenceAmount:100,referenceUnit:'g',source:'manual',referenceNutrients:{caloriesKcal:130,carbsGrams:28,sugarGrams:0,proteinGrams:3,fatGrams:1}}]};
        await request('/meals',index,{method:'POST',body,cookie:sessions[index],status:201});
        await dashboard(index);
        loadSamples.push({ms:performance.now()-start,ok:true});
      } catch {
        if(!dashboardRecorded)loadDashboardSamples.push({ms:performance.now()-start,ok:false});
        loadSamples.push({ms:performance.now()-start,ok:false});
      }
    }));
  }
  results.metrics.concurrentDashboardApi=summary(loadDashboardSamples,3000);
  results.metrics.concurrentUserJourney=summary(loadSamples,3000);
  results.metrics.httpResponses=summary(httpSamples,2000);
  results.criteria={
    normalApiUnder2s:results.metrics.yearHistoryApiBundle.p95Ms<=1500&&results.metrics.saveThenReadApi.p95Ms<=2000&&historySamples.every(x=>x.ok)&&updateSamples.every(x=>x.ok),
    concurrentUsers100:loadSamples.length===300&&loadDashboardSamples.length===300&&results.metrics.concurrentUserJourney.errorRatePct<1&&results.metrics.concurrentDashboardApi.p95Ms<=3000&&results.metrics.httpResponses.errorRatePct<1&&loginSamples.every(x=>x.ok),
    browserRenderTiming:'not measured; these are HTTP/API response measurements',
    productionAndAiTiming:'not measured; local isolated baseline only',
  };
  results.passed=results.criteria.normalApiUnder2s&&results.criteria.concurrentUsers100;
  for(const [name,metric] of Object.entries(results.metrics)) console.log(`${name}: p95 ${metric.p95Ms} ms; errors ${metric.errors}/${metric.count}`);
  if(!results.passed) process.exitCode=1;
} catch {
  results.failure={phase,message:`Performance check failed during ${phase}; credential-bearing process output suppressed.`};
  console.error(results.failure.message);process.exitCode=1;
} finally {
  if(db) {try{await db.$disconnect();}catch{}}
  let cleaned=true;
  for(const name of containers.reverse()) {try{docker('rm','-f','-v',name);}catch{cleaned=false;}}
  if(networkCreated) {try{docker('network','rm',network);}catch{cleaned=false;}}
  if(migrationDirectory) {
    const target=path.resolve(migrationDirectory);
    if(path.dirname(target)===path.resolve('.local')&&path.basename(target).startsWith('performance-migrations-')) {
      try{await rm(target,{recursive:true,force:true});}catch{cleaned=false;}
    } else cleaned=false;
  }
  results.cleanup=cleaned;
  if(!cleaned) process.exitCode=1;
  clearInterval(keepAlive);
  await mkdir('.local/performance',{recursive:true});
  await writeFile('.local/performance/result.json',JSON.stringify(results,null,2));
  console.log(`Passed: ${results.passed}; own disposable resources cleaned: ${cleaned}`);
}
