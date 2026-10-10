import {appendFile} from 'node:fs/promises';
const revision=process.env.RELEASE_REVISION;
const repository=process.env.GITHUB_REPOSITORY;
if(!/^[a-f0-9]{40}$/.test(revision??'')||repository!=='Software-Engineering-Concepts-2026/se-sec1-team-10')throw new Error('Unexpected release revision/repository');
try {
  const response=await fetch(`https://api.github.com/repos/${repository}/git/ref/heads/main`,{headers:{Accept:'application/vnd.github+json',...(process.env.GITHUB_TOKEN?{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`}:{})},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('Main reference unavailable');
  const current=(await response.json()).object?.sha===revision;
  if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,`current=${current}\n`);
  console.log(current?'Tested commit is current main.':'Newer main commit exists; skip stale deployment.');
} catch {console.error('Unable to verify current main; deployment stopped.');process.exitCode=1;}
