import { createRegistryHandler } from './src/registryHandler';
import { createD1RegistryStore, type D1DatabaseLike } from './src/registryStore';

type Env = {
  DB: D1DatabaseLike;
  ASSETS?: {
    fetch(request: Request): Promise<Response>;
  };
};

const handlerCache = new WeakMap<D1DatabaseLike, ReturnType<typeof createRegistryHandler>>();

function getApiHandler(db: D1DatabaseLike) {
  const cached = handlerCache.get(db);
  if (cached) return cached;

  const handler = createRegistryHandler(createD1RegistryStore(db));
  handlerCache.set(db, handler);
  return handler;
}

export default {
  fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api') && env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return getApiHandler(env.DB)(request);
  },
};
