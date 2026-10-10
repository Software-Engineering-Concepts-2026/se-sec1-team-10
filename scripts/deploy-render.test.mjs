import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {deployRender} from './deploy-render.mjs';
const revision='a'.repeat(40);
const image=`docker.io/chayakorn7777/lifebalance@sha256:${'b'.repeat(64)}`;
const hook='https://api.render.com/deploy/srv-db2d9jss728c73c1ks7g?key=test-only-key';
const site='https://lifebalance-8btj.onrender.com/';
const files={'release.json':JSON.stringify({revision}),'index.html':'built HTML','assets/app-test.js':'built JS'};
const manifest=Object.fromEntries(Object.entries(files).map(([file,bytes])=>[file,createHash('sha256').update(bytes).digest('hex')]));
const defaults={hook,image,revision,site,manifest};
test('deploys immutable image and verifies revision, health and exact asset bytes',async()=>{
  const requests=[];
  const result=await deployRender({...defaults,fetchImpl:async(url,options)=>{
    url=new URL(url);requests.push(url);
    if(options.method==='POST'){assert.equal(url.searchParams.get('imgURL'),image);return Response.json({deploy:{id:'dep-abc123'}});}
    if(url.pathname==='/api/health')return Response.json({status:'ok'});
    return new Response(files[url.pathname.slice(1)]);
  }});
  assert.equal(result.deployId,'dep-abc123');assert.equal(result.verifiedFiles,3);assert.ok(result.publicRevisionVerified);assert.equal(requests[0].origin,'https://api.render.com');
});
test('does not treat old healthy release as successful deployment',async()=>{
  let time=0;
  await assert.rejects(deployRender({...defaults,timeoutMs:20,now:()=>time,sleep:async()=>{time+=10;},fetchImpl:async(_url,options)=>options.method==='POST'?Response.json({deploy:{id:'dep-old'}}):Response.json({revision:'c'.repeat(40)})}),/Timed out/);
});
test('queued response requires verification; a matching build can finish without deploy ID',async()=>{
  const result=await deployRender({...defaults,fetchImpl:async(url,options)=>options.method==='POST'?new Response(null,{status:202}):new URL(url).pathname==='/api/health'?Response.json({status:'ok'}):new Response(files[new URL(url).pathname.slice(1)])});
  assert.equal(result.hookQueued,true);assert.equal(result.deployId,null);assert.ok(result.healthVerified);
});
test('wrong assets are never accepted even if revision and health match',async()=>{
  let time=0;
  await assert.rejects(deployRender({...defaults,timeoutMs:20,now:()=>time,sleep:async()=>{time+=10;},fetchImpl:async(url,options)=>options.method==='POST'?Response.json({deploy:{id:'dep-test'}}):new URL(url).pathname==='/api/health'?Response.json({status:'ok'}):new Response(new URL(url).pathname==='/release.json'?files['release.json']:'wrong')}),/Timed out/);
});
test('rejects other services, repositories, URLs and non-success hook statuses',async()=>{
  for(const overrides of [{hook:hook.replace('srv-db2d9jss728c73c1ks7g','srv-other')},{image:image.replace('chayakorn7777','other')},{site:'https://example.test/'},{revision:'main'}]) {
    await assert.rejects(deployRender({...defaults,...overrides,fetchImpl:async()=>{throw new Error('Must not make a request');}}));
  }
  await assert.rejects(deployRender({...defaults,fetchImpl:async()=>new Response('secret response',{status:401})}),/HTTP 401.*suppressed/);
});
test('transport failures do not expose the secret deploy URL',async()=>{
  await assert.rejects(deployRender({...defaults,fetchImpl:async()=>{throw new Error(hook);}}),error=>!error.message.includes('test-only-key')&&error.message.includes('suppressed'));
});
