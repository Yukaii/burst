import { createRegistryHandler } from './src/registryHandler';
import { createMemoryRegistryStore } from './src/registryStore';

const authConfig = {
  githubClientId: Bun.env.GITHUB_CLIENT_ID,
  githubClientSecret: Bun.env.GITHUB_CLIENT_SECRET,
  adminGithubLogins: Bun.env.REGISTRY_ADMIN_GITHUB_LOGINS,
  aiApiKey: Bun.env.AI_API_KEY,
  aiBaseUrl: Bun.env.AI_BASE_URL,
  aiModel: Bun.env.AI_MODEL,
};

const server = Bun.serve({
  port: 5175,
  fetch: createRegistryHandler(createMemoryRegistryStore(), authConfig),
});

console.log(`[Burst Registry API] Server started at http://localhost:${server.port}`);
