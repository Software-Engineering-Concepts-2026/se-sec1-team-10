import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const wait = ms => new Promise(resolve => setTimeout(resolve,ms));

export async function assetManifest(root) {
  const files=['index.html','release.json',...(await readdir(path.join(root,'assets'))).filter(x=>/\.(js|css)$/.test(x)).map(x=>`assets/${x}`)];
  return Object.fromEntries(await Promise.all(files.map(async file=>[file,hash(await readFile(path.join(root,file)))])));
}

// The caller is CI after successful trusted main tests. Never log the secret hook URL/response.
export async function deployRender({hook,image,revision,site,manifest,fetchImpl=fetch,sleep=wait,now=Date.now,timeoutMs=18*60*1000}) {
  const hookUrl=new URL(hook);
  if(hookUrl.origin!=='https://api.render.com'||hookUrl.pathname!=='/deploy/srv-db2d9jss728c73c1ks7g'||!hookUrl.searchParams.get('key')||hookUrl.username||hookUrl.password) throw new Error('Expected the existing LifeBalance service deploy hook');
  if(!/^docker\.io\/chayakorn7777\/lifebalance@sha256:[a-f0-9]{64}$/.test(image)) throw new Error('Expected immutable LifeBalance image digest');
  if(!/^[a-f0-9]{40}$/.test(revision)) throw new Error('Expected full tested main revision');
  const siteUrl=new URL(site);
  if(siteUrl.origin!=='https://lifebalance-8btj.onrender.com'||siteUrl.pathname!=='/'||siteUrl.search||siteUrl.hash||siteUrl.username||siteUrl.password) throw new Error('Expected existing LifeBalance public site');
  if(!manifest||!manifest['release.json']||!manifest['index.html']||Object.entries(manifest).some(([file,digest])=>!(/^(index\.html|release\.json|assets\/[\w.-]+\.(js|css))$/.test(file)&&/^[a-f0-9]{64}$/.test(digest)))) throw new Error('Invalid built asset manifest');
  hookUrl.searchParams.set('imgURL',image);
  let response;
  try {response=await fetchImpl(hookUrl,{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000)});} catch {throw new Error('Render deploy request failed; secret URL suppressed');}
  if(![200,202].includes(response.status)) throw new Error(`Render refused deployment (HTTP ${response.status}); response suppressed`);
  let deployId=null;
  if(response.status===200) {
    try {const data=await response.json();if(/^dep-[a-z0-9]+$/.test(data.deploy?.id))deployId=data.deploy.id;} catch {throw new Error('Invalid Render deployment response; content suppressed');}
    if(!deployId) throw new Error('Render deployment ID missing');
  }
  const started=now();
  while(now()-started<timeoutMs) {
    try {
      const release=await fetchImpl(new URL('release.json',siteUrl),{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
      if(release.status===200) {
        const bytes=new Uint8Array(await release.arrayBuffer());
        const published=JSON.parse(new TextDecoder().decode(bytes));
        if(published.revision===revision&&hash(bytes)===manifest['release.json']) {
          const health=await fetchImpl(new URL('api/health',siteUrl),{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
          if(health.status!==200||(await health.json()).status!=='ok') throw new Error('Health not ready');
          for(const [file,expected] of Object.entries(manifest)) {
            if(file==='release.json')continue;
            const asset=await fetchImpl(new URL(file,siteUrl),{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
            if(asset.status!==200||hash(new Uint8Array(await asset.arrayBuffer()))!==expected) throw new Error('Built assets not yet live');
          }
          return {requestedImage:image,revision,deployId,hookQueued:response.status===202,publicRevisionVerified:true,healthVerified:true,verifiedFiles:Object.keys(manifest).length,elapsedMs:now()-started};
        }
      }
    } catch { /* Transient deployment/network errors: wait for the exact requested public build. */ }
    await sleep(10000);
  }
  throw new Error('Timed out verifying requested revision and built assets; previous release may still be live. Inspect Render before retry or rollback.');
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const manifest=JSON.parse(await readFile(process.env.RELEASE_MANIFEST||'.local/cd/asset-manifest.json','utf8'));
    const result=await deployRender({hook:process.env.RENDER_DEPLOY_HOOK,image:process.env.RELEASE_IMAGE,revision:process.env.RELEASE_REVISION,site:'https://lifebalance-8btj.onrender.com/',manifest});
    await mkdir('.local/cd',{recursive:true});
    await writeFile('.local/cd/deployment-result.json',JSON.stringify(result,null,2));
    console.log(JSON.stringify(result));
  } catch(error) {
    // URL parsing errors can contain credentials; only our fixed sanitized errors are reported.
    console.error(error instanceof TypeError?'Invalid deployment configuration; secret values suppressed.':error.message);
    process.exitCode=1;
  }
}
