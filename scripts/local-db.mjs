import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// Optional Windows portable instance, kept outside Git in .local.
const action = process.argv[2] ?? 'start';
if (!['start', 'stop', 'status'].includes(action)) throw new Error('Use start, stop, or status');
const executable = resolve('.local/postgresql/pgsql/bin/pg_ctl.exe');
const data = resolve('.local/postgresql-data');
if (process.platform !== 'win32' || !existsSync(executable) || !existsSync(resolve(data, 'PG_VERSION'))) {
  throw new Error('Portable PostgreSQL is not initialized here. Use docker compose up -d db instead.');
}
const run = args => {
  const result = spawnSync(executable, ['-D', data, ...args], { windowsHide: true, stdio: 'ignore' });
  if (result.error) throw result.error;
  return result;
};
const status = run(['status']);
if (action === 'status') {
  console.log(status.status === 0 ? 'Local PostgreSQL is running' : 'Local PostgreSQL is stopped');
  process.exitCode = status.status === 0 ? 0 : 1;
} else if ((action === 'start' && status.status === 0) || (action === 'stop' && status.status !== 0)) {
  console.log(`Local PostgreSQL is already ${action === 'start' ? 'running' : 'stopped'}`);
} else {
  const result = run(action === 'start'
    ? ['-l', resolve('.local/postgresql.log'), '-w', 'start']
    : ['-m', 'fast', '-w', 'stop']);
  if (result.status !== 0) throw new Error('PostgreSQL action failed; inspect .local/postgresql.log');
  console.log(`Local PostgreSQL ${action === 'start' ? 'started' : 'stopped'}`);
}
