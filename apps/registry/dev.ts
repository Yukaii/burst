import { createServer as createViteServer } from 'vite';
import { createRegistryHandler } from './src/registryHandler';
import { createMemoryRegistryStore } from './src/registryStore';

const authConfig = {
  githubClientId: Bun.env.GITHUB_CLIENT_ID,
  githubClientSecret: Bun.env.GITHUB_CLIENT_SECRET,
  adminGithubLogins: Bun.env.REGISTRY_ADMIN_GITHUB_LOGINS,
};
const registryStore = createMemoryRegistryStore();
const registryHandler = createRegistryHandler(registryStore, authConfig);

const jsonHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': 'true',
};

const apiServer = Bun.serve({
  port: 5175,
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/api/editor/format-local-script' && request.method === 'POST') {
      try {
        const body = await request.json().catch(() => ({})) as { code?: unknown };
        if (typeof body.code !== 'string') {
          return new Response(JSON.stringify({ error: 'code is required' }), { status: 400, headers: jsonHeaders });
        }

        const { format } = await import('oxfmt');
        const result = await format('script.jsx', body.code, {
          printWidth: 100,
          semi: true,
          singleQuote: true,
          tabWidth: 2,
          trailingComma: 'all',
        });

        if (result.errors.length > 0) {
          return new Response(JSON.stringify({
            error: result.errors[0]?.message ?? 'Oxfmt formatting failed.',
          }), { status: 400, headers: jsonHeaders });
        }

        return new Response(JSON.stringify({ code: result.code }), { headers: jsonHeaders });
      } catch (error) {
        return new Response(JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        }), { status: 500, headers: jsonHeaders });
      }
    }

    return registryHandler(request);
  },
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
