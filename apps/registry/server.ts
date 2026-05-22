import { createRegistryHandler } from './src/registryHandler';
import { createMemoryRegistryStore } from './src/registryStore';

const authConfig = {
  githubClientId: Bun.env.GITHUB_CLIENT_ID,
  githubClientSecret: Bun.env.GITHUB_CLIENT_SECRET,
};

const server = Bun.serve({
  port: 5175,
  fetch: createRegistryHandler(createMemoryRegistryStore(), authConfig),
});

console.log(`[Burst Registry API] Server started at http://localhost:${server.port}`);
