import { createRegistryHandler } from './src/registryHandler';
import { createD1RegistryStore, type D1DatabaseLike } from './src/registryStore';

type Env = {
  DB: D1DatabaseLike;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  REGISTRY_ADMIN_GITHUB_LOGINS?: string;
  AI_PROVIDER?: string;
  AI_API_KEY?: string;
  AI_BASE_URL?: string;
  AI_MODEL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_MODEL?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_BASE_URL?: string;
  ANTHROPIC_MODEL?: string;
  GOOGLE_AI_API_KEY?: string;
  GOOGLE_AI_BASE_URL?: string;
  GOOGLE_AI_MODEL?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_BASE_URL?: string;
  OPENROUTER_MODEL?: string;
  CLOUDFLARE_AI_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_AI_BASE_URL?: string;
  CLOUDFLARE_AI_MODEL?: string;
  ASSETS?: {
    fetch(request: Request): Promise<Response>;
  };
};

export default {
  fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api') && env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return createRegistryHandler(createD1RegistryStore(env.DB), {
      githubClientId: env.GITHUB_CLIENT_ID,
      githubClientSecret: env.GITHUB_CLIENT_SECRET,
      adminGithubLogins: env.REGISTRY_ADMIN_GITHUB_LOGINS,
      aiProvider: env.AI_PROVIDER,
      aiApiKey: env.AI_API_KEY,
      aiBaseUrl: env.AI_BASE_URL,
      aiModel: env.AI_MODEL,
      openaiApiKey: env.OPENAI_API_KEY,
      openaiBaseUrl: env.OPENAI_BASE_URL,
      openaiModel: env.OPENAI_MODEL,
      anthropicApiKey: env.ANTHROPIC_API_KEY,
      anthropicBaseUrl: env.ANTHROPIC_BASE_URL,
      anthropicModel: env.ANTHROPIC_MODEL,
      googleAiApiKey: env.GOOGLE_AI_API_KEY,
      googleAiBaseUrl: env.GOOGLE_AI_BASE_URL,
      googleAiModel: env.GOOGLE_AI_MODEL,
      openrouterApiKey: env.OPENROUTER_API_KEY,
      openrouterBaseUrl: env.OPENROUTER_BASE_URL,
      openrouterModel: env.OPENROUTER_MODEL,
      cloudflareAiApiToken: env.CLOUDFLARE_AI_API_TOKEN,
      cloudflareAccountId: env.CLOUDFLARE_ACCOUNT_ID,
      cloudflareAiBaseUrl: env.CLOUDFLARE_AI_BASE_URL,
      cloudflareAiModel: env.CLOUDFLARE_AI_MODEL,
    })(request);
  },
};
