import { spawnSync } from 'node:child_process';

// Local .env may set development for the API; release assets always use production React.
const result = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
