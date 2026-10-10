import {mkdir,writeFile} from 'node:fs/promises';
import {assetManifest} from './deploy-render.mjs';
const directory=process.argv[2];
if(!directory)throw new Error('Specify directory exported from the built image');
await mkdir('.local/cd',{recursive:true});
await writeFile('.local/cd/asset-manifest.json',JSON.stringify(await assetManifest(directory),null,2));
console.log('Public build asset hashes prepared.');
