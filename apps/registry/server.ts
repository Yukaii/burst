import { createRegistryHandler } from './src/registryHandler';
import { createMemoryRegistryStore } from './src/registryStore';

const server = Bun.serve({
  port: 5175,
  fetch: createRegistryHandler(createMemoryRegistryStore()),
});

console.log(`[Burst Registry API] Server started at http://localhost:${server.port}`);
