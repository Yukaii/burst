import { createServer as createViteServer } from 'vite';
import { createRegistryHandler } from './src/registryHandler';
import { createMemoryRegistryStore } from './src/registryStore';

const authConfig = {
  githubClientId: Bun.env.GITHUB_CLIENT_ID,
  githubClientSecret: Bun.env.GITHUB_CLIENT_SECRET,
};

const apiServer = Bun.serve({
  port: 5175,
  fetch: createRegistryHandler(createMemoryRegistryStore(), authConfig),
});

console.log(`[Burst Registry API] Server started at http://localhost:${apiServer.port}`);

const viteServer = await createViteServer({
  configFile: 'vite.config.ts',
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
  },
});

await viteServer.listen();
console.log('[Burst Registry UI] Server started at http://localhost:5174');

const cleanup = async () => {
  console.log('\n[Dev Runner] Shutting down servers...');
  await viteServer.close();
  apiServer.stop(true);
  process.exit(0);
};

process.on('SIGINT', () => {
  void cleanup();
});

process.on('SIGTERM', () => {
  void cleanup();
});

await new Promise(() => {});
