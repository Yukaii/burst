import { createRegistryHandler } from './src/registryHandler';
import { createD1RegistryStore, type D1DatabaseLike } from './src/registryStore';

type Env = {
  DB: D1DatabaseLike;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  REGISTRY_ADMIN_GITHUB_LOGINS?: string;
  AI_API_KEY?: string;
  AI_BASE_URL?: string;
  AI_MODEL?: string;
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
      aiApiKey: env.AI_API_KEY,
      aiBaseUrl: env.AI_BASE_URL,
      aiModel: env.AI_MODEL,
    })(request);
  },
};
