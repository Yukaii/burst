import { createRegistryHandler } from './src/registryHandler';
import { createMemoryRegistryStore } from './src/registryStore';

const authConfig = {
  githubClientId: Bun.env.GITHUB_CLIENT_ID,
  githubClientSecret: Bun.env.GITHUB_CLIENT_SECRET,
  adminGithubLogins: Bun.env.REGISTRY_ADMIN_GITHUB_LOGINS,
  aiProvider: Bun.env.AI_PROVIDER,
  aiApiKey: Bun.env.AI_API_KEY,
  aiBaseUrl: Bun.env.AI_BASE_URL,
  aiModel: Bun.env.AI_MODEL,
  openaiApiKey: Bun.env.OPENAI_API_KEY,
  openaiBaseUrl: Bun.env.OPENAI_BASE_URL,
  openaiModel: Bun.env.OPENAI_MODEL,
  anthropicApiKey: Bun.env.ANTHROPIC_API_KEY,
  anthropicBaseUrl: Bun.env.ANTHROPIC_BASE_URL,
  anthropicModel: Bun.env.ANTHROPIC_MODEL,
  googleAiApiKey: Bun.env.GOOGLE_AI_API_KEY,
  googleAiBaseUrl: Bun.env.GOOGLE_AI_BASE_URL,
  googleAiModel: Bun.env.GOOGLE_AI_MODEL,
  openrouterApiKey: Bun.env.OPENROUTER_API_KEY,
  openrouterBaseUrl: Bun.env.OPENROUTER_BASE_URL,
  openrouterModel: Bun.env.OPENROUTER_MODEL,
  cloudflareAiApiToken: Bun.env.CLOUDFLARE_AI_API_TOKEN,
  cloudflareAccountId: Bun.env.CLOUDFLARE_ACCOUNT_ID,
  cloudflareAiBaseUrl: Bun.env.CLOUDFLARE_AI_BASE_URL,
  cloudflareAiModel: Bun.env.CLOUDFLARE_AI_MODEL,
};

const server = Bun.serve({
  port: 5175,
  fetch: createRegistryHandler(createMemoryRegistryStore(), authConfig),
});

console.log(`[Burst Registry API] Server started at http://localhost:${server.port}`);
