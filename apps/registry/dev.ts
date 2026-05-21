import { spawn } from 'bun';

console.log('[Dev Runner] Starting API server on port 5175...');
const apiServer = spawn(['bun', 'run', 'apps/registry/server.ts'], {
  stdout: 'inherit',
  stderr: 'inherit',
});

console.log('[Dev Runner] Starting Vite dev server on port 5174...');
const viteServer = spawn(['bun', 'run', 'vite', '--host', '127.0.0.1', '--port', '5174', '--strictPort'], {
  cwd: 'apps/registry',
  stdout: 'inherit',
  stderr: 'inherit',
});

const cleanup = () => {
  console.log('\n[Dev Runner] Shutting down servers...');
  try {
    apiServer.kill();
  } catch {}
  try {
    viteServer.kill();
  } catch {}
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Wait for both to exit
await Promise.all([apiServer.exited, viteServer.exited]);
